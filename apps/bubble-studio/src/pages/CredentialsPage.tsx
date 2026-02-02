import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  CogIcon,
  ChevronDownIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import {
  CredentialType,
  getOAuthProvider,
  isOAuthCredential,
  isBrowserSessionCredential,
  BROWSER_SESSION_PROVIDERS,
  getScopeDescriptions,
  CREDENTIAL_TYPE_CONFIG,
} from '@bubblelab/shared-schemas';
import type {
  ScopeDescription,
  CredentialResponse,
  CreateCredentialRequest,
} from '@bubblelab/shared-schemas';
import {
  useCredentials,
  useCreateCredential,
  useUpdateCredential,
  useDeleteCredential,
} from '../hooks/useCredentials';
import { credentialsApi } from '../services/credentialsApi';
import { resolveLogoByName } from '../lib/integrations';

// Helper to extract error message from API error
const getErrorMessage = (error: unknown): string => {
  const errorStr = error instanceof Error ? error.message : String(error);

  // Extract JSON from "HTTP 400: {...}" format
  const jsonMatch = errorStr.match(/HTTP \d+:\s*(\{.*\})/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      return data.error || data.message || errorStr;
    } catch {
      return errorStr;
    }
  }

  return errorStr || 'An unexpected error occurred';
};

// Helper function to map credential types to service names for icon resolution
const getServiceNameForCredentialType = (
  credentialType: CredentialType
): string => {
  const typeToServiceMap: Record<CredentialType, string> = {
    [CredentialType.OPENAI_CRED]: 'OpenAI',
    [CredentialType.AGI_API_KEY]: 'AGI Inc',
    [CredentialType.GOOGLE_GEMINI_CRED]: 'Google',
    [CredentialType.TELEGRAM_BOT_TOKEN]: 'Telegram',
    [CredentialType.ANTHROPIC_CRED]: 'Anthropic',
    [CredentialType.DATABASE_CRED]: 'Postgres',
    [CredentialType.FIRECRAWL_API_KEY]: 'Firecrawl',
    [CredentialType.SLACK_CRED]: 'Slack',
    [CredentialType.RESEND_CRED]: 'Resend',
    [CredentialType.OPENROUTER_CRED]: 'OpenRouter',
    [CredentialType.CLOUDFLARE_R2_ACCESS_KEY]: 'Cloudflare',
    [CredentialType.CLOUDFLARE_R2_SECRET_KEY]: 'Cloudflare',
    [CredentialType.CLOUDFLARE_R2_ACCOUNT_ID]: 'Cloudflare',
    [CredentialType.APIFY_CRED]: 'Apify',
    [CredentialType.GOOGLE_DRIVE_CRED]: 'Google Drive',
    [CredentialType.GMAIL_CRED]: 'Gmail',
    [CredentialType.GOOGLE_SHEETS_CRED]: 'Google Sheets',
    [CredentialType.GOOGLE_CALENDAR_CRED]: 'Google Calendar',
    [CredentialType.FUB_CRED]: 'Follow Up Boss',
    [CredentialType.GITHUB_TOKEN]: 'GitHub',
    [CredentialType.ELEVENLABS_API_KEY]: 'ElevenLabs',
    [CredentialType.AIRTABLE_CRED]: 'Airtable',
    [CredentialType.AIRTABLE_OAUTH]: 'Airtable',
    [CredentialType.NOTION_OAUTH_TOKEN]: 'Notion',
    [CredentialType.INSFORGE_BASE_URL]: 'InsForge',
    [CredentialType.INSFORGE_API_KEY]: 'InsForge',
    [CredentialType.CUSTOM_AUTH_KEY]: 'Custom',
    [CredentialType.AMAZON_CRED]: 'Amazon',
    [CredentialType.CRUSTDATA_API_KEY]: 'Crustdata',
    [CredentialType.JIRA_CRED]: 'Jira',
    [CredentialType.ASHBY_CRED]: 'Ashby',
    [CredentialType.FULLENRICH_API_KEY]: 'FullEnrich',
    [CredentialType.LINKEDIN_CRED]: 'LinkedIn',
    [CredentialType.STRIPE_CRED]: 'Stripe',
  };

  return typeToServiceMap[credentialType] || credentialType;
};

// Interfaces moved to credentialsApi.ts

interface CredentialsPageProps {
  apiBaseUrl: string;
}

interface CreateCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCredentialRequest) => Promise<CredentialResponse>;
  isLoading: boolean;
  lockedCredentialType?: CredentialType;
  lockType?: boolean;
  onSuccess?: (credential: CredentialResponse) => void;
}

export function CreateCredentialModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  lockedCredentialType,
  lockType,
  onSuccess,
}: CreateCredentialModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateCredentialRequest>({
    name: '',
    credentialType: CredentialType.OPENAI_CRED,
    value: '',
    credentialConfigurations: {},
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOAuthConnecting, setIsOAuthConnecting] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  // Browser session state
  const [isBrowserSessionConnecting, setIsBrowserSessionConnecting] =
    useState(false);
  const [browserSessionState, setBrowserSessionState] = useState<{
    sessionId: string;
    debugUrl: string;
    state: string;
  } | null>(null);

  // Check if the current credential type is OAuth or Browser Session
  const isOAuthCredentialType = isOAuthCredential(
    formData.credentialType as CredentialType
  );
  const isBrowserSessionCredentialType = isBrowserSessionCredential(
    formData.credentialType as CredentialType
  );

  // Initialize selected scopes based on defaultEnabled when credential type changes
  useEffect(() => {
    if (isOAuthCredentialType) {
      const scopeDescriptions = getScopeDescriptions(
        formData.credentialType as CredentialType
      );
      const enabledScopes = new Set(
        scopeDescriptions
          .filter((desc) => desc.defaultEnabled)
          .map((desc) => desc.scope)
      );
      setSelectedScopes(enabledScopes);
    } else {
      setSelectedScopes(new Set());
    }
  }, [formData.credentialType, isOAuthCredentialType]);

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: '',
        credentialType: CredentialType.OPENAI_CRED,
        value: '',
      });
      setShowPassword(false);
      setError(null);
      setIsOAuthConnecting(false);
      setSelectedScopes(new Set());
      setIsBrowserSessionConnecting(false);
      setBrowserSessionState(null);
    }
  }, [isOpen]);

  // If a locked type is provided, set it when opening the modal
  useEffect(() => {
    if (isOpen && lockedCredentialType) {
      setFormData((prev) => ({
        ...prev,
        credentialType: lockedCredentialType,
      }));
    }
  }, [isOpen, lockedCredentialType]);

  const handleOAuthConnect = async () => {
    setIsOAuthConnecting(true);
    setError(null);

    try {
      // Get provider from credential type using safe mapping
      const provider = getOAuthProvider(
        formData.credentialType as CredentialType
      );
      if (!provider) {
        throw new Error(
          `No OAuth provider found for credential type: ${formData.credentialType}`
        );
      }

      // Get selected scopes as array
      const scopesArray = Array.from(selectedScopes);

      // Get available scopes for this credential type
      const availableScopes = getScopeDescriptions(
        formData.credentialType as CredentialType
      );

      // Validate at least one scope is selected (only if scopes are available)
      if (availableScopes.length > 0 && scopesArray.length === 0) {
        setError('Please select at least one permission');
        setIsOAuthConnecting(false);
        return;
      }

      // Initiate OAuth flow with selected scopes
      const { authUrl, state } = await credentialsApi.initiateOAuth(
        provider,
        formData.credentialType,
        formData.name,
        scopesArray
      );

      // Store the credential name and state for when the OAuth callback completes
      const oauthData = {
        name: formData.name,
        credentialType: formData.credentialType,
        state,
      };
      sessionStorage.setItem(
        'pendingOAuthCredential',
        JSON.stringify(oauthData)
      );

      // Open OAuth URL in a new popup window
      const popup = window.open(
        authUrl,
        'oauth-popup',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Monitor the popup for completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          setIsOAuthConnecting(false);

          // Check if OAuth was successful by looking for the stored result
          const oauthResult = sessionStorage.getItem('oauthResult');
          if (oauthResult) {
            sessionStorage.removeItem('oauthResult');
            sessionStorage.removeItem('pendingOAuthCredential');

            const result = JSON.parse(oauthResult);
            if (result.success) {
              // Refresh credentials list
              queryClient.invalidateQueries({ queryKey: ['credentials'] });
              // Notify caller with created credential if available
              if (result.credential && onSuccess) {
                try {
                  onSuccess(result.credential as CredentialResponse);
                } catch (error) {
                  console.error('Error calling onSuccess:', error);
                }
              }
              // OAuth was successful, close the modal
              onClose();
            } else {
              setError(result.error || 'OAuth connection failed');
            }
          } else {
            // Popup was closed without completing OAuth
            setError('OAuth connection was cancelled');
          }
        }
      }, 1000);
    } catch (error) {
      setIsOAuthConnecting(false);
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to initiate OAuth connection'
      );
    }
  };

  // Browser session handlers
  const handleBrowserSessionConnect = async () => {
    setIsBrowserSessionConnecting(true);
    setError(null);

    // Open window immediately to avoid popup blocker (must be in direct user action context)
    const browserWindow = window.open('about:blank', '_blank');

    try {
      const result = await credentialsApi.createBrowserbaseSession(
        formData.credentialType,
        formData.name
      );

      setBrowserSessionState({
        sessionId: result.sessionId,
        debugUrl: result.debugUrl,
        state: result.state,
      });

      // Navigate the already-opened window to the debug URL
      if (browserWindow) {
        browserWindow.location.href = result.debugUrl;

        // Poll to detect when popup is closed without completing
        const pollInterval = setInterval(async () => {
          if (browserWindow.closed) {
            clearInterval(pollInterval);
            // Only close session if user didn't complete (browserSessionState still exists)
            setBrowserSessionState((currentState) => {
              if (currentState && currentState.sessionId === result.sessionId) {
                console.log(
                  'Browser window closed without completing, releasing session...'
                );
                credentialsApi
                  .closeBrowserbaseSession(result.sessionId)
                  .catch((err) =>
                    console.error('Failed to close session:', err)
                  );
                setIsBrowserSessionConnecting(false);
                return null;
              }
              return currentState;
            });
          }
        }, 1000);
      } else {
        // Fallback: if popup was blocked, show the URL
        console.warn('Popup blocked. Debug URL:', result.debugUrl);
      }
    } catch (error) {
      // Close the blank window if there was an error
      if (browserWindow) {
        browserWindow.close();
      }
      setIsBrowserSessionConnecting(false);
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to create browser session'
      );
    }
  };

  const handleBrowserSessionComplete = async () => {
    if (!browserSessionState) return;

    setError(null);

    try {
      const result = await credentialsApi.completeBrowserbaseSession(
        browserSessionState.sessionId,
        browserSessionState.state,
        formData.name
      );

      // Success - refresh credentials and close modal
      queryClient.invalidateQueries({ queryKey: ['credentials'] });

      if (onSuccess) {
        onSuccess({
          id: result.id,
          credentialType: formData.credentialType,
          name: formData.name,
          createdAt: new Date().toISOString(),
          isBrowserSession: true,
        } as CredentialResponse);
      }

      setIsBrowserSessionConnecting(false);
      setBrowserSessionState(null);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to capture credentials'
      );
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // For OAuth credentials, use the OAuth flow instead
    if (isOAuthCredentialType) {
      if (!formData.name) {
        setError('Name is required');
        return;
      }
      await handleOAuthConnect();
      return;
    }

    // For Browser Session credentials, use the browser session flow
    if (isBrowserSessionCredentialType) {
      if (!formData.name) {
        setError('Name is required');
        return;
      }
      await handleBrowserSessionConnect();
      return;
    }

    // Regular credential flow
    if (!formData.name || !formData.credentialType || !formData.value) {
      setError('Name, type, and value are required');
      return;
    }

    try {
      const created = await onSubmit(formData);
      if (onSuccess) {
        onSuccess(created);
      }
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to create credential'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      <div className="relative bg-[#1a1a1a] rounded-lg shadow-xl max-w-md w-full mx-4 border border-[#30363d] max-h-[90vh] flex flex-col">
        <div className="bg-[#1a1a1a] px-6 py-4 border-b border-[#30363d] rounded-t-lg flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-100">
            Add New Credential
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-200">{getErrorMessage(error)}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={
                  CREDENTIAL_TYPE_CONFIG[
                    formData.credentialType as CredentialType
                  ].namePlaceholder
                }
                className="w-full bg-[#1a1a1a] text-gray-100 px-3 py-2 rounded-lg border border-[#30363d] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Type *
              </label>
              <div className="relative">
                <select
                  title="Credential Type"
                  value={formData.credentialType}
                  onChange={(e) => {
                    const newCredentialType = e.target.value as CredentialType;
                    setFormData((prev) => ({
                      ...prev,
                      credentialType: newCredentialType,
                      name:
                        prev.name ||
                        CREDENTIAL_TYPE_CONFIG[newCredentialType]
                          .namePlaceholder,
                      credentialConfigurations:
                        CREDENTIAL_TYPE_CONFIG[newCredentialType]
                          .credentialConfigurations,
                    }));
                    setError(null);
                  }}
                  className="w-full bg-[#1a1a1a] text-gray-100 pl-3 py-2 pr-16 rounded-lg border border-[#30363d] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 appearance-none"
                  disabled={!!lockType || !!lockedCredentialType}
                  required
                >
                  {Object.entries(CREDENTIAL_TYPE_CONFIG).map(
                    ([type, config]) => (
                      <option key={type} value={type}>
                        {config.label}
                      </option>
                    )
                  )}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                </div>
                <div className="absolute right-10 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  {(() => {
                    const serviceName = getServiceNameForCredentialType(
                      formData.credentialType as CredentialType
                    );
                    const logo = resolveLogoByName(serviceName);
                    return logo ? (
                      <img
                        src={logo.file}
                        alt={`${logo.name} logo`}
                        className="h-5 w-5 object-contain"
                      />
                    ) : (
                      <CogIcon className="h-5 w-5 text-gray-400" />
                    );
                  })()}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {
                  CREDENTIAL_TYPE_CONFIG[
                    formData.credentialType as CredentialType
                  ].description
                }
              </p>
            </div>

            {!isOAuthCredentialType && !isBrowserSessionCredentialType && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Value *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.value}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        value: e.target.value,
                      }))
                    }
                    placeholder={
                      CREDENTIAL_TYPE_CONFIG[
                        formData.credentialType as CredentialType
                      ].placeholder
                    }
                    className="w-full bg-gray-700 text-gray-100 px-3 py-2 pr-10 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {isOAuthCredentialType && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  OAuth Connection
                </label>
                <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#30363d]">
                  <div className="flex items-center gap-3 mb-3">
                    <ArrowTopRightOnSquareIcon className="h-5 w-5 text-blue-400" />
                    <span className="text-sm text-gray-300">
                      This will open a secure OAuth connection window
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">
                    You'll be redirected to authorize access to your account.
                    Once completed, the connection will be saved automatically.
                  </p>

                  {/* Scope Descriptions with Checkboxes - only show if scopes are available */}
                  {getScopeDescriptions(
                    formData.credentialType as CredentialType
                  ).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#30363d]">
                      <p className="text-xs font-medium text-gray-300 mb-3">
                        Select permissions to request:
                      </p>
                      <div className="space-y-2">
                        {getScopeDescriptions(
                          formData.credentialType as CredentialType
                        ).map((scopeDesc: ScopeDescription) => (
                          <label
                            key={scopeDesc.scope}
                            className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedScopes.has(scopeDesc.scope)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedScopes);
                                if (e.target.checked) {
                                  newSelected.add(scopeDesc.scope);
                                } else {
                                  newSelected.delete(scopeDesc.scope);
                                }
                                setSelectedScopes(newSelected);
                              }}
                              className="mt-0.5 w-4 h-4 rounded border-[#30363d] bg-[#1a1a1a] text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0 cursor-pointer"
                            />
                            <span className="flex-1">
                              {scopeDesc.description}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isBrowserSessionCredentialType && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Browser Session Authentication
                </label>
                <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#30363d]">
                  {!browserSessionState ? (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <ArrowTopRightOnSquareIcon className="h-5 w-5 text-purple-400" />
                        <span className="text-sm text-gray-300">
                          This will open a browser window for manual login
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        A remote browser session will open where you can log
                        into the service. Once you've completed login, click
                        "Done" to capture and save your session.
                      </p>
                      {(() => {
                        const providerConfig =
                          BROWSER_SESSION_PROVIDERS.browserbase.credentialTypes[
                            formData.credentialType as CredentialType
                          ];
                        return providerConfig ? (
                          <p className="text-xs text-purple-400 mt-2">
                            Target: {providerConfig.targetUrl}
                          </p>
                        ) : null;
                      })()}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm text-green-300 font-medium">
                          Browser Session Active
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed mb-4">
                        Complete your login in the browser window, then click
                        "Done - Capture Credentials" below.
                      </p>
                      <button
                        type="button"
                        onClick={handleBrowserSessionComplete}
                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Done - Capture Credentials
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-[#30363d] flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#30363d] hover:bg-[#444c56] text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isLoading ||
                isOAuthConnecting ||
                isBrowserSessionConnecting ||
                !!browserSessionState
              }
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isOAuthConnecting
                ? 'Connecting...'
                : isBrowserSessionConnecting
                  ? 'Opening Browser...'
                  : browserSessionState
                    ? 'Session Active'
                    : isLoading
                      ? 'Creating...'
                      : isOAuthCredentialType
                        ? 'Connect with OAuth'
                        : isBrowserSessionCredentialType
                          ? 'Authenticate via Browser'
                          : 'Create Credential'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string }) => Promise<void>;
  credential: CredentialResponse | null;
  isLoading: boolean;
}

function EditCredentialModal({
  isOpen,
  onClose,
  onSubmit,
  credential,
  isLoading,
}: EditCredentialModalProps) {
  const [formData, setFormData] = useState({
    name: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (credential && isOpen) {
      setFormData({
        name: credential.name || '',
      });
      setError(null);
    } else if (!isOpen) {
      setFormData({ name: '' });
      setError(null);
    }
  }, [credential, isOpen]);

  if (!isOpen || !credential) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name) {
      setError('Name is required');
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to update credential'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      <div className="relative bg-[#1a1a1a] rounded-lg shadow-xl max-w-md w-full mx-4 border border-[#30363d]">
        <div className="bg-[#1a1a1a] px-6 py-4 border-b border-[#30363d] rounded-t-lg">
          <h2 className="text-lg font-semibold text-gray-100">
            Edit Credential
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
              <p className="text-sm text-red-200">{getErrorMessage(error)}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Type
            </label>
            <div className="relative">
              <input
                title="Credential Type"
                type="text"
                value={
                  CREDENTIAL_TYPE_CONFIG[
                    credential.credentialType as CredentialType
                  ]?.label || credential.credentialType
                }
                disabled
                className="w-full bg-[#30363d] text-gray-400 px-3 py-2 pr-10 rounded-lg border border-[#30363d] cursor-not-allowed"
              />
              {/* Icon preview next to the input */}
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                {(() => {
                  const serviceName = getServiceNameForCredentialType(
                    credential.credentialType as CredentialType
                  );
                  const logo = resolveLogoByName(serviceName);
                  return logo ? (
                    <img
                      src={logo.file}
                      alt={`${logo.name} logo`}
                      className="h-5 w-5 object-contain"
                    />
                  ) : (
                    <CogIcon className="h-5 w-5 text-gray-400" />
                  );
                })()}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Credential type cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Name *
            </label>
            <input
              title="Name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full bg-[#1a1a1a] text-gray-100 px-3 py-2 rounded-lg border border-[#30363d] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
              required
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#30363d] hover:bg-[#444c56] text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Updating...' : 'Update Credential'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CredentialCard({
  credential,
  onEdit,
  onDelete,
  isDeleting,
  onRefreshOAuth,
  isRefreshing,
  onReopenBrowserSession,
  isReopening,
}: {
  credential: CredentialResponse;
  onEdit: (credential: CredentialResponse) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  onRefreshOAuth?: (credential: CredentialResponse) => void;
  isRefreshing?: boolean;
  onReopenBrowserSession?: (credential: CredentialResponse) => void;
  isReopening?: boolean;
}) {
  const [logoError, setLogoError] = useState(false);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${credential.name}"?`)) {
      onDelete(credential.id);
    }
  };

  const isOAuthCredentialType = isOAuthCredential(
    credential.credentialType as CredentialType
  );
  const isBrowserSessionCredentialType =
    credential.isBrowserSession ||
    isBrowserSessionCredential(credential.credentialType as CredentialType);
  const credentialConfig =
    CREDENTIAL_TYPE_CONFIG[credential.credentialType as CredentialType];

  // Get the service name and resolve the logo
  const serviceName = getServiceNameForCredentialType(
    credential.credentialType as CredentialType
  );
  const logo = useMemo(() => resolveLogoByName(serviceName), [serviceName]);

  return (
    <div className="bg-[#1a1a1a] rounded-lg border border-[#30363d] p-4 hover:border-[#444c56] transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {/* Icon and Basic Info Row */}
          <div className="flex items-start gap-3 w-full">
            {/* Left Icon/Logo */}
            <div className="flex-shrink-0">
              {logo && !logoError ? (
                <img
                  src={logo.file}
                  alt={`${logo.name} logo`}
                  className="h-8 w-8 object-contain"
                  loading="lazy"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-600">
                  <CogIcon className="h-4 w-4 text-white" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-gray-100 truncate">
                  {credential.name}
                </h3>
                {isOAuthCredentialType && (
                  <div className="flex items-center gap-1">
                    <ArrowTopRightOnSquareIcon className="h-3 w-3 text-blue-400" />
                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                      OAuth
                    </span>
                  </div>
                )}
                {isBrowserSessionCredentialType && !isOAuthCredentialType && (
                  <div className="flex items-center gap-1">
                    <ArrowTopRightOnSquareIcon className="h-3 w-3 text-purple-400" />
                    <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                      Browser
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {credentialConfig?.label || credential.credentialType}
              </p>
              {(isOAuthCredentialType || isBrowserSessionCredentialType) && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs text-green-400">Connected</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          {isOAuthCredentialType && onRefreshOAuth && (
            <button
              onClick={() => onRefreshOAuth(credential)}
              disabled={isRefreshing}
              className="text-gray-400 hover:text-blue-400 p-1.5 hover:bg-blue-900/20 rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh OAuth token"
            >
              {isRefreshing ? (
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <ArrowPathIcon className="h-4 w-4" />
              )}
            </button>
          )}
          {isBrowserSessionCredentialType &&
            !isOAuthCredentialType &&
            onReopenBrowserSession && (
              <button
                onClick={() => onReopenBrowserSession(credential)}
                disabled={isReopening}
                className="text-gray-400 hover:text-purple-400 p-1.5 hover:bg-purple-900/20 rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Open browser session"
              >
                {isReopening ? (
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <ArrowPathIcon className="h-4 w-4" />
                )}
              </button>
            )}
          <button
            onClick={() => onEdit(credential)}
            className="text-gray-400 hover:text-gray-300 p-1.5 hover:bg-[#30363d] rounded transition-all duration-200"
            title="Edit credential"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-gray-400 hover:text-red-400 p-1.5 hover:bg-red-900/20 rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete credential"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Created: {new Date(credential.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export function CredentialsPage({ apiBaseUrl }: CredentialsPageProps) {
  const queryClient = useQueryClient();

  // Use React Query for credentials data
  const {
    data: credentials = [],
    isLoading,
    error: queryError,
  } = useCredentials(apiBaseUrl);

  const createCredentialMutation = useCreateCredential();
  const updateCredentialMutation = useUpdateCredential();
  const deleteCredentialMutation = useDeleteCredential(apiBaseUrl);

  const refreshOAuthMutation = useMutation({
    mutationFn: async (credential: CredentialResponse) => {
      const provider = getOAuthProvider(
        credential.credentialType as CredentialType
      );
      if (!provider) {
        throw new Error(
          `No OAuth provider found for credential type: ${credential.credentialType}`
        );
      }
      return credentialsApi.refreshOAuthToken(credential.id, provider);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
  });

  const reopenBrowserSessionMutation = useMutation({
    mutationFn: async (credential: CredentialResponse) => {
      return credentialsApi.reopenBrowserbaseSession(credential.id);
    },
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCredential, setEditingCredential] =
    useState<CredentialResponse | null>(null);

  // Convert React Query error to string
  const error = queryError ? queryError.message : null;

  const handleCreateCredential = async (data: CreateCredentialRequest) => {
    const created = await createCredentialMutation.mutateAsync(data);
    // Only close modal after successful creation and cache invalidation
    setShowCreateModal(false);
    return created;
  };

  const handleEditCredential = (credential: CredentialResponse) => {
    setEditingCredential(credential);
    setShowEditModal(true);
  };

  const handleUpdateCredential = async (data: { name: string }) => {
    if (!editingCredential) return;

    await updateCredentialMutation.mutateAsync({
      id: editingCredential.id,
      data,
    });
    // Only close modal after successful update and cache invalidation
    setShowEditModal(false);
    setEditingCredential(null);
  };

  const handleDeleteCredential = async (id: number) => {
    try {
      await deleteCredentialMutation.mutateAsync(id);
      // Cache will be invalidated automatically
    } catch (error) {
      console.error('Failed to delete credential:', error);
    }
  };

  const handleRefreshOAuth = async (credential: CredentialResponse) => {
    try {
      await refreshOAuthMutation.mutateAsync(credential);
      console.log(`OAuth token refreshed for ${credential.name}`);
    } catch (error) {
      console.error('Failed to refresh OAuth token:', error);
    }
  };

  const handleReopenBrowserSession = async (credential: CredentialResponse) => {
    // Open window immediately to avoid popup blocker
    const browserWindow = window.open('about:blank', '_blank');

    try {
      const result = await reopenBrowserSessionMutation.mutateAsync(credential);
      console.log(`Browser session reopened for ${credential.name}`);

      // Navigate the already-opened window to the debug URL
      if (browserWindow && result.debugUrl) {
        browserWindow.location.href = result.debugUrl;

        // Poll to detect when popup is closed, then close the session
        const pollInterval = setInterval(async () => {
          if (browserWindow.closed) {
            clearInterval(pollInterval);
            console.log('Browser window closed, releasing session...');
            try {
              await credentialsApi.closeBrowserbaseSession(result.sessionId);
              console.log('Session closed successfully');
            } catch (err) {
              console.error('Failed to close session:', err);
            }
          }
        }, 1000);
      }
    } catch (error) {
      // Close the blank window if there was an error
      if (browserWindow) {
        browserWindow.close();
      }
      console.error('Failed to reopen browser session:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-400">Loading credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0a0a0a] overflow-auto font-mono">
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white font-sans">
                Credentials
              </h1>
              <p className="text-gray-400 mt-2 text-sm font-sans">
                Manage your API keys and authentication credentials
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-white text-black hover:bg-gray-200 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-2 shadow-lg hover:scale-105"
            >
              <PlusIcon className="h-5 w-5" />
              <span className="font-bold font-sans">Add Credential</span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8">
            <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <p className="text-sm text-red-200 font-sans">{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="pb-12">
          {credentials.length === 0 ? (
            <div className="text-center py-16 border border-[#30363d] border-dashed rounded-2xl bg-[#1a1a1a]/30">
              <div className="bg-[#1a1a1a] p-4 rounded-full inline-flex mb-4 border border-[#30363d]">
                <KeyIcon className="h-8 w-8 text-gray-500" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">
                No credentials yet
              </h3>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Add your first credential to authenticate with external
                services.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-white text-black hover:bg-gray-200 font-medium rounded-full transition-all duration-200 shadow-lg hover:scale-105 flex items-center gap-2 mx-auto"
              >
                <PlusIcon className="h-5 w-5" />
                <span className="font-sans font-bold">Add Credential</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {credentials.map((credential) => (
                <CredentialCard
                  key={credential.id}
                  credential={credential}
                  onEdit={handleEditCredential}
                  onDelete={handleDeleteCredential}
                  isDeleting={deleteCredentialMutation.isPending}
                  onRefreshOAuth={handleRefreshOAuth}
                  isRefreshing={
                    refreshOAuthMutation.isPending &&
                    refreshOAuthMutation.variables?.id === credential.id
                  }
                  onReopenBrowserSession={handleReopenBrowserSession}
                  isReopening={
                    reopenBrowserSessionMutation.isPending &&
                    reopenBrowserSessionMutation.variables?.id === credential.id
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateCredentialModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateCredential}
        isLoading={createCredentialMutation.isPending}
      />

      <EditCredentialModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCredential(null);
        }}
        onSubmit={handleUpdateCredential}
        credential={editingCredential}
        isLoading={updateCredentialMutation.isPending}
      />
    </div>
  );
}
