import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiHttpError } from '../lib/api';
import type { RedeemCouponResponse } from '@bubblelab/shared-schemas';

interface RedeemCouponRequest {
  code: string;
}

interface UseRedeemCouponResult {
  mutate: (request: RedeemCouponRequest) => void;
  mutateAsync: (request: RedeemCouponRequest) => Promise<RedeemCouponResponse>;
  isLoading: boolean;
  error: Error | null;
  data: RedeemCouponResponse | undefined;
  reset: () => void;
}

export function useRedeemCoupon(): UseRedeemCouponResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: ['redeemCoupon'],
    mutationFn: async (
      request: RedeemCouponRequest
    ): Promise<RedeemCouponResponse> => {
      console.log('[useRedeemCoupon] Redeeming coupon code');
      try {
        const response = await api.post<RedeemCouponResponse>(
          '/subscription/redeem',
          request
        );
        console.log('[useRedeemCoupon] Redemption response:', response);
        return response;
      } catch (error) {
        // Handle API errors and extract the response data
        if (error instanceof ApiHttpError && error.data) {
          const errorData = error.data as RedeemCouponResponse;
          // If the error response has a valid structure, return it instead of throwing
          if (
            typeof errorData === 'object' &&
            'success' in errorData &&
            'message' in errorData
          ) {
            console.log('[useRedeemCoupon] Error response:', errorData);
            return errorData;
          }
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data.success) {
        // Invalidate subscription query to refresh data with new offer
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        console.log(
          '[useRedeemCoupon] Coupon redeemed, subscription data invalidated'
        );
      }
    },
    onError: (error) => {
      console.error('[useRedeemCoupon] Redemption failed:', error);
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
