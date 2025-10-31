import {
  OAuth2Client,
  OAuth2Token,
  generateCodeVerifier,
} from '@badgateway/oauth2-client';
import {
  CredentialType,
  OAUTH_PROVIDERS,
  type OAuthProvider,
} from '@bubblelab/shared-schemas';
import { db } from '../db/index.js';
import { userCredentials } from '../db/schema.js';
import { CredentialEncryption } from '../utils/encryption.js';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';

export interface OAuthAuthorizationUrl {
  authUrl: string;
  state: string;
}

export interface OAuthCallbackResult {
  credentialId: number;
  token: OAuth2Token;
}

export interface StoredOAuthCredential {
  id: number;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scopes: string[];
  provider: string;
}

/**
 * OAuth service that handles OAuth flows, token management, and refresh
 * Uses @badgateway/oauth2-client for OAuth 2.0 operations
 */
export class OAuthService {
  private clients: Map<string, OAuth2Client> = new Map();
  private stateStore: Map<
    string,
    {
      userId: string;
      provider: string;
      credentialType: CredentialType;
      credentialName?: string;
      timestamp: number;
      scopes: string[];
      codeVerifier?: string; // For PKCE (required by X/Twitter)
    }
  > = new Map();

  constructor() {
    this.setupOAuthClients();

    // Clean up expired states every 10 minutes
    setInterval(() => this.cleanupExpiredStates(), 10 * 60 * 1000);
  }

  /**
   * Initialize OAuth clients for supported providers
   */
  private setupOAuthClients(): void {
    // Google OAuth 2.0 configuration
    if (env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) {
      this.clients.set(
        'google',
        new OAuth2Client({
          server: 'https://oauth2.googleapis.com',
          clientId: env.GOOGLE_OAUTH_CLIENT_ID,
          clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenEndpoint: '/token',
        })
      );
    } else {
      console.warn(
        'Google OAuth credentials not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET'
      );
    }

    // X (Twitter) OAuth 2.0 configuration with PKCE
    if (env.X_OAUTH_CLIENT_ID && env.X_OAUTH_CLIENT_SECRET) {
      this.clients.set(
        'x',
        new OAuth2Client({
          server: 'https://api.twitter.com',
          clientId: env.X_OAUTH_CLIENT_ID,
          clientSecret: env.X_OAUTH_CLIENT_SECRET,
          authorizationEndpoint: 'https://twitter.com/i/oauth2/authorize',
          tokenEndpoint: '/2/oauth2/token',
          // PKCE is automatically handled by @badgateway/oauth2-client
        })
      );
    } else {
      console.warn(
        'X OAuth credentials not configured. Set X_OAUTH_CLIENT_ID and X_OAUTH_CLIENT_SECRET'
      );
    }
  }

  /**
   * Initiate OAuth authorization flow for a specific credential type
   */
  async initiateOAuth(
    provider: OAuthProvider,
    userId: string,
    credentialType: CredentialType,
    credentialName?: string,
    scopes?: string[]
  ): Promise<OAuthAuthorizationUrl> {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(
        `OAuth provider '${provider}' not supported, please ensure OAUTH CLIENTS and SECRETS are configured`
      );
    }

    // Generate secure state parameter
    const state = crypto.randomUUID();
    const timestamp = Date.now();

    // Validate that the credential type is supported by this provider
    this.getCredentialConfig(provider, credentialType);

    const redirectUri = `${env.NODEX_API_URL || 'http://localhost:3001'}/oauth/${provider}/callback`;
    const defaultScopes = this.getDefaultScopes(provider, credentialType);
    const requestedScopes = scopes || defaultScopes;

    // For X (Twitter), generate PKCE code_verifier using library's helper
    let codeVerifier: string | undefined;

    if (provider === 'x') {
      // Use the library's built-in PKCE code verifier generator
      codeVerifier = await generateCodeVerifier();
      console.log(`Generated PKCE code_verifier for X OAuth`);
    }

    // Store state for CSRF protection with requested scopes (expires in 10 minutes)
    this.stateStore.set(state, {
      userId,
      provider,
      credentialType,
      credentialName,
      timestamp,
      scopes: requestedScopes,
      codeVerifier, // Store for token exchange
    });

    try {
      // Get provider-specific authorization parameters from centralized config
      const providerConfig = OAUTH_PROVIDERS[provider];
      const authorizationParams = providerConfig?.authorizationParams || {};

      // Build authorization options - library handles PKCE automatically when codeVerifier is provided
      const authOptions: {
        redirectUri: string;
        scope: string[];
        state: string;
        codeVerifier?: string;
        [key: string]: string | string[] | undefined;
      } = {
        redirectUri,
        scope: requestedScopes,
        state,
        ...authorizationParams,
      };

      // For X, pass codeVerifier - library automatically generates code_challenge and adds PKCE params
      if (provider === 'x' && codeVerifier) {
        authOptions.codeVerifier = codeVerifier;
      }

      const authUrl =
        await client.authorizationCode.getAuthorizeUri(authOptions);

      // For X (Twitter), ensure scopes are space-separated (X API requirement)
      // Library might use comma-separated, so we fix it if needed
      const urlObj = new URL(authUrl);
      if (provider === 'x') {
        const scopeParam = urlObj.searchParams.get('scope');
        if (scopeParam && scopeParam.includes(',')) {
          const spaceSeparatedScopes = scopeParam
            .split(',')
            .map((s) => s.trim())
            .join(' ');
          urlObj.searchParams.set('scope', spaceSeparatedScopes);
        }
      }

      // For Google, ensure access_type and prompt are present if specified
      if (provider === 'google') {
        if (
          !urlObj.searchParams.has('access_type') &&
          authorizationParams.access_type
        ) {
          urlObj.searchParams.set(
            'access_type',
            authorizationParams.access_type
          );
        }
        if (!urlObj.searchParams.has('prompt') && authorizationParams.prompt) {
          urlObj.searchParams.set('prompt', authorizationParams.prompt);
        }
      }

      return { authUrl: urlObj.toString(), state };
    } catch (error) {
      // Clean up state on error
      this.stateStore.delete(state);
      throw new Error(
        `Failed to generate OAuth authorization URL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleOAuthCallback(
    provider: string,
    code: string,
    state: string,
    credentialName?: string
  ): Promise<OAuthCallbackResult> {
    // Validate state parameter
    const stateData = this.stateStore.get(state);
    if (!stateData || stateData.provider !== provider) {
      throw new Error('Invalid or expired state parameter');
    }

    // Check state expiration (10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      this.stateStore.delete(state);
      throw new Error('State parameter expired');
    }

    // Clean up state
    this.stateStore.delete(state);

    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(`OAuth provider '${provider}' not supported`);
    }

    const redirectUri = `${env.NODEX_API_URL || 'http://localhost:3001'}/oauth/${provider}/callback`;

    try {
      // Exchange authorization code for tokens
      // Library requires code_verifier for PKCE (X/Twitter) - pass it if we have it
      const tokenOptions: {
        code: string;
        redirectUri: string;
        codeVerifier?: string;
      } = {
        code,
        redirectUri,
      };

      // For X (Twitter), include code_verifier for PKCE token exchange
      if (provider === 'x' && stateData.codeVerifier) {
        tokenOptions.codeVerifier = stateData.codeVerifier;
      }

      const token = await client.authorizationCode.getToken(tokenOptions);

      if (!token.refreshToken) {
        console.warn(
          'No refresh token received - user may need to re-authorize'
        );
      }

      // Store token in database
      const credentialId = await this.storeOAuthToken(
        stateData.userId,
        provider,
        stateData.credentialType,
        token,
        stateData.scopes,
        stateData.credentialName || credentialName
      );

      return { credentialId, token };
    } catch (error) {
      console.error('OAuth token exchange failed:', error);

      throw new Error(
        `OAuth token exchange failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidToken(credentialId: number): Promise<string | null> {
    const credential = await db.query.userCredentials.findFirst({
      where: eq(userCredentials.id, credentialId),
    });

    if (!credential || !credential.isOauth || !credential.oauthAccessToken) {
      return null;
    }

    const now = new Date();
    const expiresAt = credential.oauthExpiresAt;

    // Check if token needs refresh (5 minute buffer)
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (
      expiresAt &&
      expiresAt < fiveMinutesFromNow &&
      credential.oauthRefreshToken
    ) {
      try {
        console.info(
          `[oauthService] Refreshing OAuth token for credential ${credentialId}`
        );
        const newToken = await this.refreshToken(credentialId);
        return newToken;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return null;
      }
    }

    // Token is still valid, decrypt and return
    try {
      return await CredentialEncryption.decrypt(credential.oauthAccessToken);
    } catch (error) {
      console.error('Failed to decrypt OAuth token:', error);
      return null;
    }
  }

  /**
   * Refresh an OAuth token using the refresh token
   */
  async refreshToken(credentialId: number): Promise<string> {
    const credential = await db.query.userCredentials.findFirst({
      where: eq(userCredentials.id, credentialId),
    });

    if (
      !credential ||
      !credential.isOauth ||
      !credential.oauthRefreshToken ||
      !credential.oauthProvider ||
      !credential.oauthAccessToken ||
      !credential.oauthExpiresAt
    ) {
      throw new Error('OAuth credential not found or missing refresh token');
    }

    const client = this.clients.get(credential.oauthProvider);
    if (!client) {
      throw new Error(
        `OAuth provider '${credential.oauthProvider}' not supported`
      );
    }

    const decryptedRefreshToken = await CredentialEncryption.decrypt(
      credential.oauthRefreshToken
    );

    try {
      const newToken = await client.refreshToken({
        refreshToken: decryptedRefreshToken,
        accessToken: credential.oauthAccessToken,
        expiresAt: credential.oauthExpiresAt.getTime(),
      });

      // Update stored token
      await this.updateStoredToken(credentialId, newToken);

      return newToken.accessToken;
    } catch (error) {
      throw new Error(
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Store OAuth token in database
   */
  private async storeOAuthToken(
    userId: string,
    provider: string,
    credentialType: CredentialType,
    token: OAuth2Token,
    requestedScopes?: string[],
    credentialName?: string
  ): Promise<number> {
    // Encrypt tokens
    const encryptedAccessToken = await CredentialEncryption.encrypt(
      token.accessToken
    );
    const encryptedRefreshToken = token.refreshToken
      ? await CredentialEncryption.encrypt(token.refreshToken)
      : null;

    // Use expiration from token (already a timestamp in milliseconds)
    const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;

    // Note: @badgateway/oauth2-client doesn't include scope in token response
    // We'll use the scopes that were requested during authorization
    const scopes =
      requestedScopes ||
      this.getDefaultScopes(provider as OAuthProvider, credentialType);

    const [result] = await db
      .insert(userCredentials)
      .values({
        userId,
        credentialType,
        name:
          credentialName ||
          this.getCredentialConfig(provider as OAuthProvider, credentialType)
            .displayName,
        isOauth: true,
        oauthAccessToken: encryptedAccessToken,
        oauthRefreshToken: encryptedRefreshToken,
        oauthExpiresAt: expiresAt,
        oauthScopes: scopes,
        oauthTokenType: 'Bearer', // OAuth2 tokens are typically Bearer tokens
        oauthProvider: provider,
        metadata: null, // OAuth credentials don't have database metadata
      })
      .returning({ id: userCredentials.id });

    return result.id;
  }

  /**
   * Update stored OAuth token
   */
  private async updateStoredToken(
    credentialId: number,
    token: OAuth2Token
  ): Promise<void> {
    const encryptedAccessToken = await CredentialEncryption.encrypt(
      token.accessToken
    );
    const encryptedRefreshToken = token.refreshToken
      ? await CredentialEncryption.encrypt(token.refreshToken)
      : undefined;

    const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;

    await db
      .update(userCredentials)
      .set({
        oauthAccessToken: encryptedAccessToken,
        oauthRefreshToken: encryptedRefreshToken,
        oauthExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(userCredentials.id, credentialId));
  }

  /**
   * Get default scopes for a specific credential type under a provider
   */
  private getDefaultScopes(
    provider: OAuthProvider,
    credentialType: CredentialType
  ): string[] {
    const providerConfig = OAUTH_PROVIDERS[provider];
    const credentialConfig = providerConfig?.credentialTypes[credentialType];
    return credentialConfig?.defaultScopes || [];
  }

  /**
   * Get credential configuration for a specific credential type
   */
  private getCredentialConfig(
    provider: OAuthProvider,
    credentialType: CredentialType
  ) {
    const providerConfig = OAUTH_PROVIDERS[provider];
    const credentialConfig = providerConfig?.credentialTypes[credentialType];
    if (!credentialConfig) {
      throw new Error(
        `Credential type ${credentialType} not supported by provider ${provider}`
      );
    }
    return credentialConfig;
  }

  /**
   * Clean up expired state parameters
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    const expiredStates: string[] = [];

    for (const [state, data] of this.stateStore.entries()) {
      if (now - data.timestamp > 10 * 60 * 1000) {
        // 10 minutes
        expiredStates.push(state);
      }
    }

    for (const state of expiredStates) {
      this.stateStore.delete(state);
    }

    if (expiredStates.length > 0) {
      console.info(
        `[oauthService] Cleaned up ${expiredStates.length} expired OAuth states`
      );
    }
  }

  /**
   * Revoke OAuth token and remove from database
   */
  async revokeCredential(credentialId: number): Promise<void> {
    const credential = await db.query.userCredentials.findFirst({
      where: eq(userCredentials.id, credentialId),
    });

    if (!credential || !credential.isOauth) {
      throw new Error('OAuth credential not found');
    }

    // Try to revoke token with provider (best effort)
    if (credential.oauthAccessToken && credential.oauthProvider) {
      try {
        const client = this.clients.get(credential.oauthProvider);
        if (client) {
          // const accessToken = await CredentialEncryption.decrypt(
          //   credential.oauthAccessToken
          // );
          // Note: Not all providers support token revocation via @badgateway/oauth2-client
          // This would need to be implemented per-provider if needed
          console.debug(
            `[oauthService] Would revoke token for ${credential.oauthProvider} (not implemented)`
          );
        }
      } catch (error) {
        console.error(
          'Token revocation failed (continuing with deletion):',
          error
        );
      }
    }

    // Delete credential from database
    await db
      .delete(userCredentials)
      .where(eq(userCredentials.id, credentialId));
  }
}

// Export singleton instance
export const oauthService = new OAuthService();
