import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { credentialsApi } from '../services/credentialsApi';
import type {
  CreateCredentialRequest,
  UpdateCredentialRequest,
} from '@bubblelab/shared-schemas';

export const useCredentials = (apiBaseUrl: string) => {
  return useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialsApi.getCredentials(),
    enabled: !!apiBaseUrl,
  });
};

export const useCreateCredential = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCredentialRequest) =>
      credentialsApi.createCredential(data),
    onSuccess: () => {
      // Invalidate and refetch credentials
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
  });
};

export const useUpdateCredential = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCredentialRequest }) =>
      credentialsApi.updateCredential(id, data),
    onSuccess: () => {
      // Invalidate and refetch credentials
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
  });
};

export const useDeleteCredential = (apiBaseUrl: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => credentialsApi.deleteCredential(apiBaseUrl, id),
    onSuccess: () => {
      // Invalidate and refetch credentials
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
  });
};
