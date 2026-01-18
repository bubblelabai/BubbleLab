// @ts-expect-error - Bun test types
import { describe, it, expect } from 'bun:test';
import {
  checkHackathonOffer,
  checkPrivateMetadataOverrides,
  resolveEffectiveSubscription,
  ClerkPrivateMetadata,
} from './offer-helper';
import { APP_PLAN_TO_MONTHLY_LIMITS } from './subscription-validation';
import { AppType } from '../config/clerk-apps';

/**
 * Helper to create a date relative to a base date
 */
function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

describe('offer-helper', () => {
  // Base date for testing
  const NOW = new Date('2024-06-15T12:00:00Z');

  describe('Free Tier (no subscription)', () => {
    const FREE_BASE_PLAN = 'free_user' as const;
    const FREE_BASE_FEATURES = ['base_usage' as const];

    describe('1. No metadata, no subscription', () => {
      it('should return free plan when no private metadata exists', () => {
        const privateMetadata: ClerkPrivateMetadata = {};

        const result = resolveEffectiveSubscription(
          {
            basePlan: FREE_BASE_PLAN,
            baseFeatures: FREE_BASE_FEATURES,
            privateMetadata,
            appType: AppType.BUBBLE_LAB,
          },
          NOW
        );

        expect(result.plan).toBe('free_user');
        expect(result.source).toBe('jwt');
      });

      it('should get free tier limits', () => {
        const limits = APP_PLAN_TO_MONTHLY_LIMITS['free_user'];

        expect(limits.executionLimit).toBe(100);
        expect(limits.creditLimit).toBe(5);
        expect(limits.webhookLimit).toBe(1);
      });
    });

    describe('2. Private metadata with no expiration', () => {
      it('should be valid 10 years from now', () => {
        const privateMetadata: ClerkPrivateMetadata = {
          plan: 'pro_plus',
          // No planExpiresAt - never expires
        };

        const futureDate = addYears(NOW, 10);
        const result = resolveEffectiveSubscription(
          {
            basePlan: FREE_BASE_PLAN,
            baseFeatures: FREE_BASE_FEATURES,
            privateMetadata,
            appType: AppType.BUBBLE_LAB,
          },
          futureDate
        );

        expect(result.plan).toBe('pro_plus');
        expect(result.source).toBe('private_metadata_override');
      });

      it('should be valid 10 years before now (retroactive check)', () => {
        const privateMetadata: ClerkPrivateMetadata = {
          plan: 'pro_plus',
          // No planExpiresAt - never expires
        };

        const pastDate = addYears(NOW, -10);
        const result = resolveEffectiveSubscription(
          {
            basePlan: FREE_BASE_PLAN,
            baseFeatures: FREE_BASE_FEATURES,
            privateMetadata,
            appType: AppType.BUBBLE_LAB,
          },
          pastDate
        );

        expect(result.plan).toBe('pro_plus');
        expect(result.source).toBe('private_metadata_override');
      });
    });

    describe('3. Private metadata with expiration (no subscription)', () => {
      const expirationDate = addDays(NOW, 30); // Expires 30 days from NOW

      it('should be valid within expiration date', () => {
        const privateMetadata: ClerkPrivateMetadata = {
          plan: 'pro_plus',
          planExpiresAt: expirationDate.toISOString(),
        };

        // Check 15 days before expiration (still valid)
        const checkDate = addDays(NOW, 15);
        const result = resolveEffectiveSubscription(
          {
            basePlan: FREE_BASE_PLAN,
            baseFeatures: FREE_BASE_FEATURES,
            privateMetadata,
            appType: AppType.BUBBLE_LAB,
          },
          checkDate
        );

        expect(result.plan).toBe('pro_plus');
        expect(result.source).toBe('private_metadata_override');
      });

      it('should fall back to free plan after expiration', () => {
        const privateMetadata: ClerkPrivateMetadata = {
          plan: 'pro_plus',
          planExpiresAt: expirationDate.toISOString(),
        };

        // Check 31 days after NOW (1 day after expiration)
        const checkDate = addDays(NOW, 31);
        const result = resolveEffectiveSubscription(
          {
            basePlan: FREE_BASE_PLAN,
            baseFeatures: FREE_BASE_FEATURES,
            privateMetadata,
            appType: AppType.BUBBLE_LAB,
          },
          checkDate
        );

        expect(result.plan).toBe('free_user');
        expect(result.source).toBe('jwt');
      });

      it('should get free tier limits after expiration', () => {
        const limits = APP_PLAN_TO_MONTHLY_LIMITS['free_user'];

        expect(limits.executionLimit).toBe(100);
        expect(limits.creditLimit).toBe(5);
        expect(limits.webhookLimit).toBe(1);
      });
    });
  });

  describe('Paid Tier (pro_plan subscription)', () => {
    const PAID_BASE_PLAN = 'pro_plan' as const;
    const PAID_BASE_FEATURES = ['base_usage' as const, 'pro_usage' as const];

    describe('1. No metadata', () => {
      it('should return the paid plan from JWT', () => {
        const privateMetadata: ClerkPrivateMetadata = {};

        const result = resolveEffectiveSubscription(
          {
            basePlan: PAID_BASE_PLAN,
            baseFeatures: PAID_BASE_FEATURES,
            privateMetadata,
            appType: AppType.BUBBLE_LAB,
          },
          NOW
        );

        expect(result.plan).toBe('pro_plan');
        expect(result.features).toEqual(PAID_BASE_FEATURES);
        expect(result.source).toBe('jwt');
      });

      it('should get pro_plan limits', () => {
        const limits = APP_PLAN_TO_MONTHLY_LIMITS['pro_plan'];

        expect(limits.executionLimit).toBe(6000);
        expect(limits.creditLimit).toBe(20);
        expect(limits.webhookLimit).toBe(10);
      });
    });

    describe('2. Private metadata with no expiration', () => {
      it('should override the paid tier to unlimited', () => {
        const privateMetadata: ClerkPrivateMetadata = {
          plan: 'unlimited',
          // No planExpiresAt - never expires
        };

        const result = resolveEffectiveSubscription(
          {
            basePlan: PAID_BASE_PLAN,
            baseFeatures: PAID_BASE_FEATURES,
            privateMetadata,
            appType: AppType.BUBBLE_LAB,
          },
          NOW
        );

        expect(result.plan).toBe('unlimited');
        expect(result.source).toBe('private_metadata_override');
      });

      it('should remain valid 10 years from now', () => {
        const privateMetadata: ClerkPrivateMetadata = {
          plan: 'unlimited',
        };

        const futureDate = addYears(NOW, 10);
        const result = resolveEffectiveSubscription(
          {
            basePlan: PAID_BASE_PLAN,
            baseFeatures: PAID_BASE_FEATURES,
            privateMetadata,
            appType: AppType.BUBBLE_LAB,
          },
          futureDate
        );

        expect(result.plan).toBe('unlimited');
        expect(result.source).toBe('private_metadata_override');
      });
    });

    describe('3. Private metadata with expiration', () => {
      const expirationDate = addDays(NOW, 30); // Expires 30 days from NOW

      it('should override within expiration date', () => {
        const privateMetadata: ClerkPrivateMetadata = {
          plan: 'unlimited',
          planExpiresAt: expirationDate.toISOString(),
        };

        // Check 15 days before expiration (still valid)
        const checkDate = addDays(NOW, 15);
        const result = resolveEffectiveSubscription(
          {
            basePlan: PAID_BASE_PLAN,
            baseFeatures: PAID_BASE_FEATURES,
            privateMetadata,
            appType: AppType.BUBBLE_LAB,
          },
          checkDate
        );

        expect(result.plan).toBe('unlimited');
        expect(result.source).toBe('private_metadata_override');
      });

      it('should fall back to paid tier after expiration', () => {
        const privateMetadata: ClerkPrivateMetadata = {
          plan: 'unlimited',
          planExpiresAt: expirationDate.toISOString(),
        };

        // Check 31 days after NOW (1 day after expiration)
        const checkDate = addDays(NOW, 31);
        const result = resolveEffectiveSubscription(
          {
            basePlan: PAID_BASE_PLAN,
            baseFeatures: PAID_BASE_FEATURES,
            privateMetadata,
            appType: AppType.BUBBLE_LAB,
          },
          checkDate
        );

        expect(result.plan).toBe('pro_plan');
        expect(result.source).toBe('jwt');
      });

      it('should get pro_plan limits after expiration', () => {
        const limits = APP_PLAN_TO_MONTHLY_LIMITS['pro_plan'];

        expect(limits.executionLimit).toBe(6000);
        expect(limits.creditLimit).toBe(20);
        expect(limits.webhookLimit).toBe(10);
      });
    });
  });

  describe('Hackathon Offer', () => {
    const FREE_BASE_PLAN = 'free_user' as const;
    const FREE_BASE_FEATURES = ['base_usage' as const];

    it('should apply hackathon offer when active', () => {
      const expirationDate = addDays(NOW, 1); // Expires 1 day from NOW
      const privateMetadata: ClerkPrivateMetadata = {
        hackathonOffer: {
          expiresAt: expirationDate.toISOString(),
          redeemedAt: NOW.toISOString(),
          code: 'HACKATHON2024',
        },
      };

      const result = resolveEffectiveSubscription(
        {
          basePlan: FREE_BASE_PLAN,
          baseFeatures: FREE_BASE_FEATURES,
          privateMetadata,
          appType: AppType.BUBBLE_LAB,
        },
        NOW
      );

      expect(result.plan).toBe('pro_plus');
      expect(result.source).toBe('hackathon_offer');
      expect(result.hackathonOffer?.isActive).toBe(true);
    });

    it('should not apply hackathon offer when expired', () => {
      const expirationDate = addDays(NOW, -1); // Expired 1 day ago
      const privateMetadata: ClerkPrivateMetadata = {
        hackathonOffer: {
          expiresAt: expirationDate.toISOString(),
          redeemedAt: addDays(NOW, -2).toISOString(),
          code: 'HACKATHON2024',
        },
      };

      const result = resolveEffectiveSubscription(
        {
          basePlan: FREE_BASE_PLAN,
          baseFeatures: FREE_BASE_FEATURES,
          privateMetadata,
          appType: AppType.BUBBLE_LAB,
        },
        NOW
      );

      expect(result.plan).toBe('free_user');
      expect(result.source).toBe('jwt');
      expect(result.hackathonOffer?.isActive).toBe(false);
    });
  });

  describe('Priority: Private metadata overrides hackathon offer', () => {
    const FREE_BASE_PLAN = 'free_user' as const;
    const FREE_BASE_FEATURES = ['base_usage' as const];

    it('should use private metadata override over active hackathon offer', () => {
      const hackathonExpiration = addDays(NOW, 1);
      const metadataExpiration = addDays(NOW, 30);

      const privateMetadata: ClerkPrivateMetadata = {
        // Active hackathon offer
        hackathonOffer: {
          expiresAt: hackathonExpiration.toISOString(),
          code: 'HACKATHON2024',
        },
        // Active private metadata override (should take precedence)
        plan: 'unlimited',
        planExpiresAt: metadataExpiration.toISOString(),
      };

      const result = resolveEffectiveSubscription(
        {
          basePlan: FREE_BASE_PLAN,
          baseFeatures: FREE_BASE_FEATURES,
          privateMetadata,
          appType: AppType.BUBBLE_LAB,
        },
        NOW
      );

      expect(result.plan).toBe('unlimited');
      expect(result.source).toBe('private_metadata_override');
    });

    it('should fall back to hackathon offer when private metadata expires', () => {
      const hackathonExpiration = addDays(NOW, 60); // Still active
      const metadataExpiration = addDays(NOW, 10); // Expires soon

      const privateMetadata: ClerkPrivateMetadata = {
        hackathonOffer: {
          expiresAt: hackathonExpiration.toISOString(),
          code: 'HACKATHON2024',
        },
        plan: 'unlimited',
        planExpiresAt: metadataExpiration.toISOString(),
      };

      // Check after metadata expires but hackathon is still active
      const checkDate = addDays(NOW, 30);
      const result = resolveEffectiveSubscription(
        {
          basePlan: FREE_BASE_PLAN,
          baseFeatures: FREE_BASE_FEATURES,
          privateMetadata,
          appType: AppType.BUBBLE_LAB,
        },
        checkDate
      );

      expect(result.plan).toBe('pro_plus'); // Hackathon offer grants pro_plus
      expect(result.source).toBe('hackathon_offer');
    });

    it('should fall back to base plan when both expire', () => {
      const hackathonExpiration = addDays(NOW, 10);
      const metadataExpiration = addDays(NOW, 20);

      const privateMetadata: ClerkPrivateMetadata = {
        hackathonOffer: {
          expiresAt: hackathonExpiration.toISOString(),
          code: 'HACKATHON2024',
        },
        plan: 'unlimited',
        planExpiresAt: metadataExpiration.toISOString(),
      };

      // Check after both expire
      const checkDate = addDays(NOW, 30);
      const result = resolveEffectiveSubscription(
        {
          basePlan: FREE_BASE_PLAN,
          baseFeatures: FREE_BASE_FEATURES,
          privateMetadata,
          appType: AppType.BUBBLE_LAB,
        },
        checkDate
      );

      expect(result.plan).toBe('free_user');
      expect(result.source).toBe('jwt');
    });
  });

  describe('checkHackathonOffer', () => {
    it('should return inactive when no hackathon offer exists', () => {
      const privateMetadata: ClerkPrivateMetadata = {};
      const result = checkHackathonOffer(privateMetadata, NOW);

      expect(result.isActive).toBe(false);
      expect(result.grantedPlan).toBeNull();
    });

    it('should return active with granted plan when offer is valid', () => {
      const expirationDate = addDays(NOW, 1);
      const privateMetadata: ClerkPrivateMetadata = {
        hackathonOffer: {
          expiresAt: expirationDate.toISOString(),
          code: 'TEST',
        },
      };

      const result = checkHackathonOffer(privateMetadata, NOW);

      expect(result.isActive).toBe(true);
      expect(result.grantedPlan).toBe('pro_plus');
      expect(result.grantedFeatures).toEqual(['base_usage', 'pro_usage']);
    });
  });

  describe('checkPrivateMetadataOverrides', () => {
    it('should return null when no plan override exists', () => {
      const privateMetadata: ClerkPrivateMetadata = {};
      const result = checkPrivateMetadataOverrides(privateMetadata, NOW);

      expect(result).toBeNull();
    });

    it('should return active override when no expiration is set', () => {
      const privateMetadata: ClerkPrivateMetadata = {
        plan: 'pro_plus',
      };

      const result = checkPrivateMetadataOverrides(privateMetadata, NOW);

      expect(result).not.toBeNull();
      expect(result!.plan).toBe('pro_plus');
      expect(result!.isActive).toBe(true);
      expect(result!.expiresAt).toBeNull();
    });

    it('should return active override when within expiration', () => {
      const expirationDate = addDays(NOW, 30);
      const privateMetadata: ClerkPrivateMetadata = {
        plan: 'unlimited',
        planExpiresAt: expirationDate.toISOString(),
      };

      const result = checkPrivateMetadataOverrides(privateMetadata, NOW);

      expect(result).not.toBeNull();
      expect(result!.plan).toBe('unlimited');
      expect(result!.isActive).toBe(true);
      expect(result!.expiresAt).toEqual(expirationDate);
    });

    it('should return inactive override when expired', () => {
      const expirationDate = addDays(NOW, -1); // Expired yesterday
      const privateMetadata: ClerkPrivateMetadata = {
        plan: 'unlimited',
        planExpiresAt: expirationDate.toISOString(),
      };

      const result = checkPrivateMetadataOverrides(privateMetadata, NOW);

      expect(result).not.toBeNull();
      expect(result!.plan).toBe('unlimited');
      expect(result!.isActive).toBe(false);
    });
  });
});
