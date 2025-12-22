import React, { useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useRedeemCoupon } from '../hooks/useRedeemCoupon';
import { useSubscription } from '../hooks/useSubscription';

export const RedeemCouponSection: React.FC = () => {
  const [code, setCode] = useState('');
  const {
    mutateAsync: redeemCoupon,
    isLoading,
    data,
    reset,
  } = useRedeemCoupon();
  const { data: subscription, loading: subscriptionLoading } =
    useSubscription();
  const [error, setError] = useState<string | null>(null);

  // Show loading state while fetching subscription
  if (subscriptionLoading) {
    return (
      <div className="rounded-lg bg-[#1a1a1a] border border-white/5 p-4">
        <h3 className="text-sm font-medium text-gray-200 mb-3">
          Redeem Promo Code
        </h3>
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Check if user already has an active offer
  const hasActiveOffer = subscription?.hackathonOffer?.isActive;
  const offerExpiresAt = subscription?.hackathonOffer?.expiresAt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    reset();

    if (!code.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    try {
      const response = await redeemCoupon({ code: code.trim() });
      if (!response.success) {
        setError(response.message);
      } else {
        setCode(''); // Clear input on success
      }
    } catch {
      setError('Failed to redeem coupon. Please try again.');
    }
  };

  const formatExpirationDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="rounded-lg bg-[#1a1a1a] border border-white/5 p-4">
      <h3 className="text-sm font-medium text-gray-200 mb-3">
        Redeem Promo Code
      </h3>

      {hasActiveOffer && offerExpiresAt ? (
        // Show active offer status
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-300">
              Promotional offer active until{' '}
              {formatExpirationDate(offerExpiresAt)}
            </span>
          </div>
        </div>
      ) : (
        // Show redemption form
        <>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-[#0f1115] border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redeeming...
                </>
              ) : (
                'Redeem'
              )}
            </button>
          </form>

          {/* Success message */}
          {data?.success && (
            <div className="mt-3 flex items-center gap-2 text-sm text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>{data.message}</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
              <XCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <p className="mt-3 text-xs text-gray-500">
            Have a promotional code? Enter it above to unlock temporary Pro
            features.
          </p>
        </>
      )}
    </div>
  );
};

export default RedeemCouponSection;
