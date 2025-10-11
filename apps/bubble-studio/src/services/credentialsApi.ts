import { api } from '../lib/api';
import type {
  CredentialResponse,
  CreateCredentialRequest,
  UpdateCredentialRequest,
} from '@bubblelab/shared-schemas';

export const credentialsApi = {
  getCredentials: async (): Promise<CredentialResponse[]> => {
    return api.get<CredentialResponse[]>('/credentials');
  },

  initiateOAuth: async (
    provider: string,
    credentialType: string,
    name?: string
  ): Promise<{ authUrl: string; state: string }> => {
    return api.post<{ authUrl: string; state: string }>(
      `/oauth/${provider}/initiate`,
      {
        credentialType,
        name,
      }
    );
  },

  refreshOAuthToken: async (
    credentialId: number,
    provider: string
  ): Promise<{ message: string }> => {
    return api.post<{ message: string }>(`/oauth/${provider}/refresh`, {
      credentialId,
    });
  },

  createCredential: async (
    data: CreateCredentialRequest
  ): Promise<CredentialResponse> => {
    return api.post<CredentialResponse>('/credentials', data);
  },

  updateCredential: async (
    id: number,
    data: UpdateCredentialRequest
  ): Promise<CredentialResponse> => {
    return api.put<CredentialResponse>(`/credentials/${id}`, data);
  },

  deleteCredential: async (_apiBaseUrl: string, id: number): Promise<void> => {
    return api.delete<void>(`/credentials/${id}`);
  },
};
