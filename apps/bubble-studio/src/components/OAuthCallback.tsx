import { useEffect } from 'react';
import { getOAuthProvider } from '@bubblelab/shared-schemas';
import { api } from '../lib/api';

interface OAuthCallbackProps {
  apiBaseUrl: string;
}

export function OAuthCallback({ apiBaseUrl }: OAuthCallbackProps) {
  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        const success = urlParams.get('success');

        // Check for OAuth errors first
        if (error) {
          const result = {
            success: false,
            error: errorDescription || error,
          };

          // Store result for parent window to read
          if (window.opener) {
            window.opener.sessionStorage.setItem(
              'oauthResult',
              JSON.stringify(result)
            );
            window.close();
          }
          return;
        }

        // If backend redirected here with success/error params (GET redirect path)
        if (success || error) {
          const result = success
            ? { success: true }
            : {
                success: false,
                error: errorDescription || error || 'OAuth failed',
              };

          if (window.opener) {
            window.opener.sessionStorage.setItem(
              'oauthResult',
              JSON.stringify(result)
            );
            window.close();
          }
          return;
        }

        // Check for required parameters for POST completion path
        if (!code || !state) {
          const result = {
            success: false,
            error: 'Missing authorization code or state parameter',
          };

          if (window.opener) {
            window.opener.sessionStorage.setItem(
              'oauthResult',
              JSON.stringify(result)
            );
            window.close();
          }
          return;
        }

        // Get pending credential data from session storage
        const pendingCredentialData = window.opener?.sessionStorage.getItem(
          'pendingOAuthCredential'
        );
        if (!pendingCredentialData) {
          const result = {
            success: false,
            error: 'No pending credential data found',
          };

          if (window.opener) {
            window.opener.sessionStorage.setItem(
              'oauthResult',
              JSON.stringify(result)
            );
            window.close();
          }
          return;
        }

        const pendingCredential = JSON.parse(pendingCredentialData);

        // Verify state matches
        if (pendingCredential.state !== state) {
          const result = {
            success: false,
            error: 'Invalid state parameter - possible CSRF attack',
          };

          if (window.opener) {
            window.opener.sessionStorage.setItem(
              'oauthResult',
              JSON.stringify(result)
            );
            window.close();
          }
          return;
        }

        // Get provider from credential type using safe mapping
        const provider = getOAuthProvider(pendingCredential.credentialType);
        if (!provider) {
          throw new Error(
            `No OAuth provider found for credential type: ${pendingCredential.credentialType}`
          );
        }

        try {
          // Complete OAuth flow by exchanging code for tokens
          const result = await api.post(`/oauth/${provider}/callback`, {
            code,
            state,
            name: pendingCredential.name,
            description: pendingCredential.description,
          });

          // OAuth completed successfully
          const oauthResult = {
            success: true,
            credential: result, // result already contains the parsed JSON response
          };

          if (window.opener) {
            window.opener.sessionStorage.setItem(
              'oauthResult',
              JSON.stringify(oauthResult)
            );
            window.close();
          }
        } catch (error) {
          const oauthResult = {
            success: false,
            error:
              error instanceof Error ? error.message : 'Unknown error occurred',
          };

          if (window.opener) {
            window.opener.sessionStorage.setItem(
              'oauthResult',
              JSON.stringify(oauthResult)
            );
            window.close();
          }
        }
      } catch (outerError) {
        console.error('OAuth callback error:', outerError);
        const result = {
          success: false,
          error:
            outerError instanceof Error
              ? outerError.message
              : 'OAuth callback failed',
        };

        if (window.opener) {
          window.opener.sessionStorage.setItem(
            'oauthResult',
            JSON.stringify(result)
          );
          window.close();
        }
      }
    };

    handleOAuthCallback();
  }, [apiBaseUrl]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Completing OAuth Connection...
        </h2>
        <p className="text-sm text-muted-foreground">
          Please wait while we finalize your credential setup.
        </p>
      </div>
    </div>
  );
}
