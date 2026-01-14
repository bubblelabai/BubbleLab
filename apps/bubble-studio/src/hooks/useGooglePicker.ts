import { useState, useEffect, useCallback } from 'react';
import { credentialsApi } from '../services/credentialsApi';
import { GOOGLE_API_KEY, GOOGLE_OAUTH_CLIENT_ID } from '../env';

// Extract the App ID (project number) from the OAuth Client ID
// OAuth Client ID format: "123456789-xxx.apps.googleusercontent.com"
// App ID is the numeric prefix: "123456789"
function getAppIdFromClientId(
  clientId: string | undefined
): string | undefined {
  if (!clientId) return undefined;
  const match = clientId.match(/^(\d+)-/);
  return match ? match[1] : undefined;
}

export interface GooglePickerFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}

interface UseGooglePickerOptions {
  credentialId: number | null;
  onFilePicked: (file: GooglePickerFile) => void;
  onError?: (error: Error) => void;
}

interface UseGooglePickerReturn {
  openPicker: () => Promise<void>;
  isLoading: boolean;
  isScriptLoaded: boolean;
  error: Error | null;
}

// Singleton promise for script loading to avoid multiple loads
let scriptLoadPromise: Promise<void> | null = null;

function loadGooglePickerScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.picker) {
      resolve();
      return;
    }

    // Check if gapi is loaded but picker isn't
    if (window.gapi) {
      window.gapi.load('picker', { callback: resolve, onerror: reject });
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.gapi) {
        window.gapi.load('picker', { callback: resolve, onerror: reject });
      } else {
        reject(new Error('Failed to load Google API'));
      }
    };
    script.onerror = () => {
      scriptLoadPromise = null; // Reset so retry is possible
      reject(new Error('Failed to load Google Picker script'));
    };
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

export function useGooglePicker({
  credentialId,
  onFilePicked,
  onError,
}: UseGooglePickerOptions): UseGooglePickerReturn {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load Google Picker script on mount
  useEffect(() => {
    loadGooglePickerScript()
      .then(() => setIsScriptLoaded(true))
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      });
  }, [onError]);

  const openPicker = useCallback(async () => {
    // Validate prerequisites
    if (!credentialId) {
      const err = new Error('No Google Drive credential connected');
      setError(err);
      onError?.(err);
      return;
    }

    const appId = getAppIdFromClientId(GOOGLE_OAUTH_CLIENT_ID);
    if (!GOOGLE_API_KEY || !appId) {
      const err = new Error('Google API key or OAuth Client ID not configured');
      setError(err);
      onError?.(err);
      return;
    }

    if (!isScriptLoaded) {
      const err = new Error('Google Picker script not loaded yet');
      setError(err);
      onError?.(err);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch fresh access token from backend
      const { accessToken } = await credentialsApi.getPickerToken(credentialId);

      // Build and show picker
      const picker = new google.picker.PickerBuilder()
        .addView(google.picker.ViewId.DOCS)
        .addView(google.picker.ViewId.SPREADSHEETS)
        .addView(google.picker.ViewId.RECENTLY_PICKED)
        .setOAuthToken(accessToken)
        .setDeveloperKey(GOOGLE_API_KEY)
        .setAppId(appId)
        .setTitle('Select a file from Google Drive')
        .setCallback((data: google.picker.ResponseObject) => {
          if (
            data.action === google.picker.Action.PICKED &&
            data.docs.length > 0
          ) {
            const doc = data.docs[0];
            onFilePicked({
              id: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              url: doc.url,
            });
          }
          // Note: CANCEL action doesn't require any handling
        })
        .build();

      picker.setVisible(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [credentialId, isScriptLoaded, onFilePicked, onError]);

  return { openPicker, isLoading, isScriptLoaded, error };
}
