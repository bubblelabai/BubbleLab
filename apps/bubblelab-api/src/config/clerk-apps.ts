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
      development: [
        'https://quality-lemming-11.clerk.accounts.dev', // Add your actual dev issuer
      ],
      production: ['https://clerk.nodex.bubblelab.ai'],
    },
  },
  [AppType.BUBBLEPARSE]: {
    appType: AppType.BUBBLEPARSE,
    name: 'BubbleParse',
    secretKeyEnvVar: 'CLERK_SECRET_KEY_BUBBLEPARSE',
    issuerIds: {
      development: [
        'https://evolving-corgi-51.clerk.accounts.dev', // Add your actual dev issuer
      ],
      production: ['https://clerk.doc.bubblelab.ai'],
    },
  },
  [AppType.BUBBLE_LAB]: {
    appType: AppType.BUBBLE_LAB,
    name: 'BubbleLab',
    secretKeyEnvVar: 'CLERK_SECRET_KEY_BUBBLELAB',
    issuerIds: {
      development: [
        'https://lucky-fowl-65.clerk.accounts.dev', // Add your actual dev issuer
      ],
      production: ['https://clerk.bubblelab.ai'],
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
  // Determine environment (you might want to make this more sophisticated)
  const environment = env.isDev ? 'development' : 'production';
  // Check each app's issuer IDs
  for (const [appType, config] of Object.entries(CLERK_APP_CONFIGS)) {
    const issuerIds = config.issuerIds[environment];
    // Check if the issuer matches any of the configured issuer IDs
    if (issuerIds.some((issuerId) => issuer === issuerId)) {
      return appType as AppType;
    }
  }
  return null;
};
