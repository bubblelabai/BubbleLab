import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface OnboardingStatus {
  onboardingCompleted: boolean;
}

interface OnboardingData {
  persona: string;
  personaOther?: string;
  referralSource: string;
  referralSourceOther?: string;
  interestedInInterview: boolean;
}

/**
 * Hook to fetch and manage onboarding status
 */
export function useOnboarding() {
  const queryClient = useQueryClient();

  // Fetch onboarding status
  const {
    data: status,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      return api.get<OnboardingStatus>('/onboarding/status');
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1, // Only retry once
  });

  // Submit onboarding questionnaire
  const submitOnboarding = useMutation({
    mutationFn: async (data: OnboardingData) => {
      return api.post('/onboarding/complete', data);
    },
    onSuccess: () => {
      // Invalidate the onboarding status query to refetch
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
  });

  return {
    onboardingCompleted: status?.onboardingCompleted ?? false,
    isLoading,
    error,
    submitOnboarding: submitOnboarding.mutateAsync,
    isSubmitting: submitOnboarding.isPending,
  };
}
