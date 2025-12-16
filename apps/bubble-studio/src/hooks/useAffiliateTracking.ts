import { useEffect } from 'react';
import { analytics } from '@/services/analytics';

/**
 * Hook to handle affiliate referral tracking.
 * Captures the `ref` URL parameter and stores it for attribution.
 *
 * Usage: useAffiliateTracking({ ref: 'anubhav' })
 *
 * What it does:
 * - Stores affiliate code in localStorage (first-touch attribution)
 * - Sets `referred_by` as a PostHog user property
 * - Fires an `affiliate_visit` event for tracking
 */
export function useAffiliateTracking({ ref }: { ref?: string }) {
  useEffect(() => {
    if (!ref) return;

    const affiliateCode = ref.toLowerCase();

    // Store for attribution (only if not already set, preserves first touch)
    const isFirstVisit = !localStorage.getItem('affiliate_code');
    if (isFirstVisit) {
      localStorage.setItem('affiliate_code', affiliateCode);
      localStorage.setItem('affiliate_timestamp', new Date().toISOString());
    }

    // Track affiliate visit event (visible in PostHog Activity)
    analytics.track('affiliate_visit', {
      affiliate_code: affiliateCode,
      is_first_visit: isFirstVisit,
      referrer: document.referrer || undefined,
    });

    // Set as PostHog user property for attribution
    analytics.setUserProperties({ referred_by: affiliateCode });
  }, [ref]);
}

/**
 * Get the stored affiliate code (useful for server-side attribution)
 */
export function getStoredAffiliateCode(): string | null {
  return localStorage.getItem('affiliate_code');
}
