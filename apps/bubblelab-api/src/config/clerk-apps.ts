/**
 * Centralized Clerk application configuration
 * Defines app types, issuer IDs for dev/prod, and environment variable mapping
 */

import { env } from './env';

export enum AppType {
  NODEX = 'nodex',
  BUBBLEPARSE = 'bubbleparse',
  BUBBLE_LAB = 'bubblelab',
}

/**
 * Parse comma-separated issuer IDs from environment variable
 * Falls back to provided default values if env var is not set
 */
const parseIssuers = (envVar: string, fallback: string[]): string[] => {
  const value = process.env[envVar];
  if (!value) return fallback;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

export interface ClerkAppConfig {
  appType: AppType;
  name: string;
  secretKeyEnvVar: string;
  fallbackSecretKeyEnvVar?: string;
  issuerIds: {
    development: string[];
    production: string[];
  };
}

export const CLERK_APP_CONFIGS: Record<AppType, ClerkAppConfig> = {
  [AppType.NODEX]: {
    appType: AppType.NODEX,
    name: 'Nodex',
    secretKeyEnvVar: 'CLERK_SECRET_KEY_NODEX',
    fallbackSecretKeyEnvVar: 'CLERK_SECRET_KEY', // Backward compatibility
    issuerIds: {
      development: parseIssuers('CLERK_ISSUER_NODEX_DEV', [
        'https://quality-lemming-11.clerk.accounts.dev',
      ]),
      production: parseIssuers('CLERK_ISSUER_NODEX_PROD', [
        'https://clerk.nodex.bubblelab.ai',
      ]),
    },
  },
  [AppType.BUBBLEPARSE]: {
    appType: AppType.BUBBLEPARSE,
    name: 'BubbleParse',
    secretKeyEnvVar: 'CLERK_SECRET_KEY_BUBBLEPARSE',
    issuerIds: {
      development: parseIssuers('CLERK_ISSUER_BUBBLEPARSE_DEV', [
        'https://evolving-corgi-51.clerk.accounts.dev',
      ]),
      production: parseIssuers('CLERK_ISSUER_BUBBLEPARSE_PROD', [
        'https://clerk.doc.bubblelab.ai',
      ]),
    },
  },
  [AppType.BUBBLE_LAB]: {
    appType: AppType.BUBBLE_LAB,
    name: 'BubbleLab',
    secretKeyEnvVar: 'CLERK_SECRET_KEY_BUBBLELAB',
    issuerIds: {
      development: parseIssuers('CLERK_ISSUER_BUBBLELAB_DEV', [
        'https://lucky-fowl-65.clerk.accounts.dev',
      ]),
      production: parseIssuers('CLERK_ISSUER_BUBBLELAB_PROD', [
        'https://clerk.bubblelab.ai',
      ]),
    },
  },
};

/**
 * Get the appropriate secret key for an app type
 */
export const getSecretKeyForApp = (appType: AppType): string | null => {
  const config = CLERK_APP_CONFIGS[appType];
  if (!config) {
    return null;
  }

  // Try primary secret key first
  const primaryKey = process.env[config.secretKeyEnvVar];
  if (primaryKey) {
    return primaryKey;
  }

  // Try fallback if available
  if (config.fallbackSecretKeyEnvVar) {
    const fallbackKey = process.env[config.fallbackSecretKeyEnvVar];
    if (fallbackKey) {
      return fallbackKey;
    }
  }

  return null;
};

/**
 * Detect app type from JWT token issuer
 * Uses centralized issuer ID configuration
 */
export const detectAppTypeFromIssuer = (issuer: string): AppType | null => {
  console.info('Detecting app type from issuer:', issuer);
  console.info('Environment:', env.isDev ? 'development' : 'production');
  // Determine environment (you might want to make this more sophisticated)
  const environment = env.isDev ? 'development' : 'production';
  // Check each app's issuer IDs
  for (const [appType, config] of Object.entries(CLERK_APP_CONFIGS)) {
    const issuerIds = config.issuerIds[environment];
    // Check if the issuer matches any of the configured issuer IDs
    // The 'issuer' parameter comes from the JWT token's 'iss' field (decoded in auth middleware)
    // Example: when a user logs in via BubbleLab, the JWT contains "iss": "https://clerk.bubblelab.ai"
    // This function matches that issuer URL against the configured issuer IDs for each app type
    // to determine which Clerk application the request is coming from
    if (issuerIds.some((issuerId) => issuer === issuerId)) {
      return appType as AppType;
    }
  }
  return null;
};
