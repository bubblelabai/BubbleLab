import { OAuth2Client, OAuth2Token } from '@badgateway/oauth2-client';
import {
  CredentialType,
  OAUTH_PROVIDERS,
  type OAuthProvider,
  type JiraOAuthMetadata,
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

    // Follow Up Boss OAuth 2.0 configuration
    if (env.FUB_OAUTH_CLIENT_ID && env.FUB_OAUTH_CLIENT_SECRET) {
      this.clients.set(
        'followupboss',
        new OAuth2Client({
          server: 'https://app.followupboss.com',
          clientId: env.FUB_OAUTH_CLIENT_ID,
          clientSecret: env.FUB_OAUTH_CLIENT_SECRET,
          authorizationEndpoint: '/oauth/authorize',
          tokenEndpoint: '/oauth/token',
        })
      );
    } else {
      console.warn(
        'Follow Up Boss OAuth credentials not configured. Set FUB_OAUTH_CLIENT_ID and FUB_OAUTH_CLIENT_SECRET'
      );
    }

    // Notion OAuth 2.0 configuration
    if (env.NOTION_OAUTH_CLIENT_ID && env.NOTION_OAUTH_CLIENT_SECRET) {
      this.clients.set(
        'notion',
        new OAuth2Client({
          server: 'https://api.notion.com',
          clientId: env.NOTION_OAUTH_CLIENT_ID,
          clientSecret: env.NOTION_OAUTH_CLIENT_SECRET,
          authorizationEndpoint: '/v1/oauth/authorize',
          tokenEndpoint: '/v1/oauth/token',
        })
      );
    } else {
      console.warn(
        'Notion OAuth credentials not configured. Set NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET'
      );
    }

    // Jira OAuth 2.0 configuration (Atlassian Cloud)
    if (env.JIRA_OAUTH_CLIENT_ID && env.JIRA_OAUTH_CLIENT_SECRET) {
      this.clients.set(
        'jira',
        new OAuth2Client({
          server: 'https://auth.atlassian.com',
          clientId: env.JIRA_OAUTH_CLIENT_ID,
          clientSecret: env.JIRA_OAUTH_CLIENT_SECRET,
          authorizationEndpoint: '/authorize',
          tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
        })
      );
    } else {
      console.warn(
        'Jira OAuth credentials not configured. Set JIRA_OAUTH_CLIENT_ID and JIRA_OAUTH_CLIENT_SECRET'
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

    console.log(
      '[OAuthService] Requested redirect URI, default scopes, and requested scopes:',
      redirectUri,
      defaultScopes,
      requestedScopes
    );

    // Store state for CSRF protection with requested scopes (expires in 10 minutes)
    this.stateStore.set(state, {
      userId,
      provider,
      credentialType,
      credentialName,
      timestamp,
      scopes: requestedScopes,
    });

    try {
      // Get provider-specific authorization parameters from centralized config
      const providerConfig = OAUTH_PROVIDERS[provider];
      const authorizationParams = providerConfig?.authorizationParams || {};

      const authUrl = await client.authorizationCode.getAuthorizeUri({
        redirectUri,
        scope: requestedScopes,
        state,
        ...authorizationParams,
      });

      // Check if our parameters are actually in the URL and manually add if missing
      const urlObj = new URL(authUrl);

      // If parameters are missing or need to be overridden, set them
      if (
        !urlObj.searchParams.has('access_type') &&
        authorizationParams.access_type
      ) {
        urlObj.searchParams.set('access_type', authorizationParams.access_type);
      }
      if (!urlObj.searchParams.has('prompt') && authorizationParams.prompt) {
        urlObj.searchParams.set('prompt', authorizationParams.prompt);
      }
      // FUB uses non-standard 'auth_code' instead of 'code'
      if (authorizationParams.response_type) {
        urlObj.searchParams.set(
          'response_type',
          authorizationParams.response_type
        );
      }

      const finalAuthUrl = urlObj.toString();

      return { authUrl: finalAuthUrl, state };
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
      let token;

      // FUB requires manual token exchange due to non-standard requirements
      if (provider === 'followupboss') {
        const basicAuth = Buffer.from(
          `${env.FUB_OAUTH_CLIENT_ID}:${env.FUB_OAUTH_CLIENT_SECRET}`
        ).toString('base64');

        const tokenResponse = await fetch(
          'https://app.followupboss.com/oauth/token',
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${basicAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              redirect_uri: redirectUri,
              state,
            }).toString(),
          }
        );

        const responseText = await tokenResponse.text();
        console.log('[FUB OAuth] Token response status:', tokenResponse.status);
        console.log('[FUB OAuth] Token response body:', responseText);

        if (!tokenResponse.ok) {
          throw new Error(
            `FUB token exchange failed: ${tokenResponse.status} - ${responseText}`
          );
        }

        const tokenData = JSON.parse(responseText);
        token = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: tokenData.expires_in
            ? Date.now() + tokenData.expires_in * 1000
            : undefined,
        };
      } else {
        // Standard OAuth flow for other providers
        token = await client.authorizationCode.getToken({
          code,
          redirectUri,
        });
      }

      if (!token.refreshToken) {
        console.warn(
          'No refresh token received - user may need to re-authorize'
        );
      }

      // For Jira, fetch accessible resources to get Cloud ID
      let jiraMetadata: JiraOAuthMetadata | undefined;
      if (provider === 'jira') {
        jiraMetadata = await this.fetchJiraCloudId(token.accessToken);
      }

      // Store token in database
      const credentialId = await this.storeOAuthToken(
        stateData.userId,
        provider,
        stateData.credentialType,
        token,
        stateData.scopes,
        stateData.credentialName || credentialName,
        jiraMetadata
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
   * Get a valid access token, always refreshing to ensure freshest credentials
   */
  async getValidToken(credentialId: number): Promise<string | null> {
    const credential = await db.query.userCredentials.findFirst({
      where: eq(userCredentials.id, credentialId),
    });

    if (!credential || !credential.isOauth || !credential.oauthAccessToken) {
      return null;
    }

    // Always refresh if we have a refresh token to ensure we use the freshest credentials
    if (credential.oauthRefreshToken) {
      try {
        console.info(
          `[oauthService] Refreshing OAuth token for credential ${credentialId}`
        );
        const newToken = await this.refreshToken(credentialId);
        return newToken;
      } catch (error) {
        console.error(
          'Token refresh failed, falling back to stored token:',
          error
        );
        // Fall through to return stored token if refresh fails
      }
    }

    // Return stored token if no refresh token or refresh failed
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
   * Fetch Jira Cloud ID from accessible resources endpoint
   * This must be called after OAuth token exchange to get the Cloud ID needed for API calls
   */
  private async fetchJiraCloudId(
    accessToken: string
  ): Promise<JiraOAuthMetadata> {
    const response = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch Jira accessible resources: ${response.status} - ${errorText}`
      );
    }

    const resources = (await response.json()) as Array<{
      id: string;
      url: string;
      name: string;
      scopes: string[];
      avatarUrl?: string;
    }>;

    if (!resources || resources.length === 0) {
      throw new Error(
        'No Jira sites accessible with this account. Please ensure you have access to at least one Jira Cloud site.'
      );
    }

    // Use the first accessible site (most common case)
    // TODO: If user has multiple sites, we could let them choose
    const site = resources[0];
    console.log(
      `[Jira OAuth] Found ${resources.length} accessible site(s). Using: ${site.name} (${site.url})`
    );

    return {
      cloudId: site.id,
      siteUrl: site.url,
      siteName: site.name,
    };
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
    credentialName?: string,
    providerMetadata?: JiraOAuthMetadata
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
        metadata: providerMetadata ?? null, // Store provider-specific metadata (e.g., Jira cloudId)
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
