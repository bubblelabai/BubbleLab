/**
 * Google Picker Service
 *
 * Handles OAuth flows and Picker initialization for Google Drive file selection.
 */

import { cachePickerToken } from '../utils/googlePickerCache';
import { GOOGLE_API_KEY, GOOGLE_OAUTH_CLIENT_ID } from '../env';

// Google Picker API types
declare global {
  interface Window {
    gapi: unknown;
    google: {
      picker?: unknown;
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              error?: string;
              access_token?: string;
              hd?: string;
              email?: string;
            }) => void;
            error_callback: (error: unknown) => void;
          }) => { requestAccessToken: (options: { prompt: string }) => void };
        };
      };
    };
  }
}

export type GooglePickerFileType =
  | 'spreadsheet'
  | 'document'
  | 'folder'
  | 'any';

export interface GooglePickerConfig {
  fileType: GooglePickerFileType;
  onSelect: (fileId: string, fileName: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

/**
 * Get the appropriate Google Picker View based on file type
 * For folders, returns a configured DocsView with folder selection enabled
 * For other types, returns the ViewId
 */
export const getPickerView = (fileType: GooglePickerFileType): unknown => {
  if (!window.google?.picker) return null;

  const picker = window.google.picker as {
    ViewId: {
      SPREADSHEETS: unknown;
      DOCUMENTS: unknown;
      FOLDERS: unknown;
      DOCS: unknown;
    };
    DocsView: new (viewId?: unknown) => {
      setIncludeFolders: (include: boolean) => DocsViewInstance;
      setSelectFolderEnabled: (enabled: boolean) => DocsViewInstance;
    };
  };

  type DocsViewInstance = {
    setIncludeFolders: (include: boolean) => DocsViewInstance;
    setSelectFolderEnabled: (enabled: boolean) => DocsViewInstance;
  };

  switch (fileType) {
    case 'spreadsheet':
      return picker.ViewId.SPREADSHEETS;
    case 'document':
      return picker.ViewId.DOCUMENTS;
    case 'folder':
      // For folders, create a DocsView with folder selection enabled
      return new picker.DocsView(picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);
    default:
      return picker.ViewId.DOCS;
  }
};

/**
 * Request Google access token for Picker
 */
export const requestPickerAccessToken = async (
  onLoadingChange: (isLoading: boolean) => void
): Promise<string> => {
  onLoadingChange(true);

  return new Promise((resolve, reject) => {
    try {
      // Check if Google Sign-In API is loaded
      if (!window.google?.accounts?.oauth2) {
        onLoadingChange(false);
        reject(new Error('Google Sign-In API not loaded'));
        return;
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_OAUTH_CLIENT_ID!,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: {
          error?: string;
          access_token?: string;
          hd?: string;
          email?: string;
        }) => {
          if (response.error) {
            console.error('Token request error:', response);
            onLoadingChange(false);

            if (response.error === 'access_denied') {
              reject(
                new Error(
                  'Access denied. Please authorize access to Google Drive.'
                )
              );
            } else {
              reject(
                new Error(`Failed to get access token: ${response.error}`)
              );
            }
            return;
          }

          // Success case - loading state will be managed by the picker

          // Got the token! Cache it for future use
          const accountEmail = response.hd || response.email || 'default';
          cachePickerToken(response.access_token!, accountEmail);

          resolve(response.access_token!);
        },
        error_callback: (error: unknown) => {
          console.error('Token client error:', error);
          onLoadingChange(false);
          reject(new Error('Failed to initialize token client'));
        },
      });

      // Request the token - explicitly show Google account picker
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (error) {
      onLoadingChange(false);
      reject(error);
    }
  });
};

/**
 * Show Google Picker with the provided access token
 */
export const showPicker = (
  accessToken: string,
  config: GooglePickerConfig
): void => {
  const { fileType, onSelect, onLoadingChange } = config;

  try {
    const view = getPickerView(fileType);
    if (!view) {
      throw new Error('Invalid file type');
    }

    type PickerBuilder = {
      setOAuthToken: (token: string) => PickerBuilder;
      setDeveloperKey: (key: string) => PickerBuilder;
      setAppId: (id: string) => PickerBuilder;
      addView: (view: unknown) => PickerBuilder;
      setCallback: (
        callback: (data: {
          action: string;
          docs?: Array<{ id: string; name: string }>;
        }) => void
      ) => PickerBuilder;
      build: () => { setVisible: (visible: boolean) => void };
    };

    const googlePicker = window.google.picker as {
      PickerBuilder: new () => PickerBuilder;
      Action: {
        PICKED: string;
        CANCEL: string;
      };
    };

    // Extract project number from OAuth Client ID for setAppId()
    // Client ID format: {project_number}.apps.googleusercontent.com
    const projectNumber = GOOGLE_OAUTH_CLIENT_ID?.split('.')[0];

    // Create the picker
    const pickerBuilder = new googlePicker.PickerBuilder();
    const builtPicker = pickerBuilder
      .setOAuthToken(accessToken)
      .setDeveloperKey(GOOGLE_API_KEY!)
      .setAppId(projectNumber!)
      .addView(view)
      .setCallback(
        (data: {
          action: string;
          docs?: Array<{ id: string; name: string }>;
        }) => {
          if (
            data.action === googlePicker.Action.PICKED &&
            data.docs &&
            data.docs.length > 0
          ) {
            const file = data.docs[0];
            const fileId = file.id;
            const fileName = file.name;

            console.log('File selected:', { fileId, fileName });
            onSelect(fileId, fileName);
            onLoadingChange(false);
          } else if (data.action === googlePicker.Action.CANCEL) {
            onLoadingChange(false);
          }
        }
      )
      .build();

    // Show the picker
    builtPicker.setVisible(true);
  } catch (error) {
    console.error('Error showing picker:', error);
    onLoadingChange(false);
    throw error;
  }
};
