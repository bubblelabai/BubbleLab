import { useState, useEffect } from 'react';
import { credentialsApi } from '../services/credentialsApi';
import { useGooglePicker } from '../hooks/useGooglePicker';
import { GOOGLE_API_KEY, GOOGLE_OAUTH_CLIENT_ID } from '../env';
import { getCachedPickerToken } from '../utils/googlePickerCache';
import {
  requestPickerAccessToken,
  showPicker,
  type GooglePickerFileType,
} from '../services/googlePickerService';
import { CreateCredentialModal } from '../pages/CredentialsPage';
import { useCreateCredential } from '../hooks/useCredentials';
import type {
  CredentialResponse,
  CredentialType,
} from '@bubblelab/shared-schemas';

interface GoogleFilePickerProps {
  onSelect: (fileId: string, fileName: string) => void;
  fileType: GooglePickerFileType;
  disabled?: boolean;
  className?: string;
}

export const GoogleFilePicker: React.FC<GoogleFilePickerProps> = ({
  onSelect,
  fileType,
  disabled = false,
  className = '',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [googleCredentials, setGoogleCredentials] = useState<
    CredentialResponse[]
  >([]);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const { apiLoaded, error: apiError } = useGooglePicker();
  const createCredentialMutation = useCreateCredential();

  useEffect(() => {
    // Fetch user's Google credentials (for backend API calls)
    const fetchCredentials = async () => {
      try {
        const credentials = await credentialsApi.getCredentials();
        const googleCreds = credentials.filter(
          (cred) => cred.oauthProvider === 'google' && cred.isOauth
        );
        setGoogleCredentials(googleCreds);
      } catch (error) {
        console.error('Failed to fetch Google credentials:', error);
      }
    };

    fetchCredentials();
  }, []);

  const handleOpenPicker = async () => {
    // Check if API is loaded
    if (!apiLoaded || !window.google?.picker) {
      console.error('Google Picker API not loaded');
      alert(
        apiError ||
          'Google Picker API is not available. Please check your internet connection.'
      );
      return;
    }

    // Check if API key is configured
    if (!GOOGLE_API_KEY) {
      console.error('Google API key not configured');
      alert(
        'Google Picker is not configured. Please add VITE_GOOGLE_API_KEY to your .env file.\n\n' +
          'See .env file for setup instructions.'
      );
      return;
    }

    // Check if OAuth Client ID is configured
    if (!GOOGLE_OAUTH_CLIENT_ID) {
      console.error('Google OAuth Client ID not configured');
      alert(
        'Google OAuth is not configured. Please add VITE_GOOGLE_OAUTH_CLIENT_ID to your .env file.\n\n' +
          'Copy the value from GOOGLE_OAUTH_CLIENT_ID in the backend .env file.'
      );
      return;
    }

    try {
      // Check for cached token first
      const cachedToken = getCachedPickerToken();
      if (cachedToken) {
        // Use cached token - open Picker immediately (NO Google UI!)
        showPicker(cachedToken, {
          fileType,
          onSelect,
          onLoadingChange: setIsLoading,
        });
        return;
      }

      // No cached token - need to request one
      // Check if user has Google credentials (for backend API calls)
      if (googleCredentials.length === 0) {
        // No credentials - show modal to create one
        console.log(
          'No credentials found. Opening credential creation modal...'
        );
        setShowCredentialModal(true);
        return;
      }

      // User has credentials - request Picker token
      const accessToken = await requestPickerAccessToken(setIsLoading);

      // Show picker with token
      showPicker(accessToken, {
        fileType,
        onSelect,
        onLoadingChange: setIsLoading,
      });
    } catch (error) {
      console.error('Error opening picker:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to open Google Picker. Please try again.'
      );
      setIsLoading(false);
    }
  };

  const handleCredentialCreated = async (created: CredentialResponse) => {
    console.log('✅ Google credential created!', created);

    // Update local credentials list
    setGoogleCredentials([...googleCredentials, created]);

    // Close modal
    setShowCredentialModal(false);

    // Now request Picker token and show picker
    try {
      const accessToken = await requestPickerAccessToken(setIsLoading);
      showPicker(accessToken, {
        fileType,
        onSelect,
        onLoadingChange: setIsLoading,
      });
    } catch (error) {
      console.error('Error after credential creation:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to open Google Picker. Please try again.'
      );
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={`w-full h-9/10 ${className}`}>
        <button
          type="button"
          onClick={handleOpenPicker}
          disabled={disabled || isLoading || !apiLoaded}
          className="w-full h-full flex items-center justify-center bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded border border-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !apiLoaded
              ? apiError || 'Google Picker API loading...'
              : !GOOGLE_API_KEY
                ? 'Google API key not configured'
                : 'Browse Google Drive files'
          }
        >
          <img
            src="/integrations/google-drive.svg"
            alt="Google Drive"
            className="w-4 h-4"
          />
        </button>
      </div>

      {/* Create Credential Modal */}
      {showCredentialModal && (
        <CreateCredentialModal
          isOpen={showCredentialModal}
          onClose={() => setShowCredentialModal(false)}
          onSubmit={(data) => createCredentialMutation.mutateAsync(data)}
          isLoading={createCredentialMutation.isPending}
          lockedCredentialType={'GOOGLE_DRIVE_CRED' as CredentialType}
          lockType
          onSuccess={handleCredentialCreated}
        />
      )}
    </>
  );
};
