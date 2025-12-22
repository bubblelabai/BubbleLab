/**
 * Google Picker Service
 *
 * Handles OAuth flows and Picker initialization for Google Drive file selection.
 */

import { credentialsApi } from './credentialsApi';
import { cachePickerToken } from '../utils/googlePickerCache';
import { GOOGLE_API_KEY, GOOGLE_OAUTH_CLIENT_ID } from '../env';
import type { CredentialResponse } from '@bubblelab/shared-schemas';

// Google Picker API types
declare global {
  interface Window {
    gapi: any;
    google: any;
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
 * Get the appropriate Google Picker View ID based on file type
 */
export const getPickerViewId = (fileType: GooglePickerFileType): any => {
  if (!window.google?.picker) return null;

  switch (fileType) {
    case 'spreadsheet':
      return window.google.picker.ViewId.SPREADSHEETS;
    case 'document':
      return window.google.picker.ViewId.DOCUMENTS;
    case 'folder':
      return window.google.picker.ViewId.FOLDERS;
    default:
      return window.google.picker.ViewId.DOCS;
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
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_OAUTH_CLIENT_ID!,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
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

          // Got the token! Cache it for future use
          const accountEmail = response.hd || response.email || 'default';
          cachePickerToken(response.access_token, accountEmail);

          resolve(response.access_token);
        },
        error_callback: (error: any) => {
          console.error('Token client error:', error);
          onLoadingChange(false);
          reject(new Error('Failed to initialize token client'));
        },
      });

      // Request the token - Google will show account picker
      tokenClient.requestAccessToken({ prompt: '' });
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
    const viewId = getPickerViewId(fileType);
    if (!viewId) {
      throw new Error('Invalid file type');
    }

    // Create the picker
    const picker = new window.google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(GOOGLE_API_KEY!)
      .setAppId(GOOGLE_OAUTH_CLIENT_ID!)
      .addView(viewId)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const file = data.docs[0];
          const fileId = file.id;
          const fileName = file.name;

          console.log('File selected:', { fileId, fileName });
          onSelect(fileId, fileName);
          onLoadingChange(false);
        } else if (data.action === window.google.picker.Action.CANCEL) {
          onLoadingChange(false);
        }
      })
      .build();

    // Show the picker
    picker.setVisible(true);
  } catch (error) {
    console.error('Error showing picker:', error);
    onLoadingChange(false);
    throw error;
  }
};
