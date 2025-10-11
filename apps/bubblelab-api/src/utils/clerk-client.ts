import { createClerkClient } from '@clerk/backend';
import { AppType, getSecretKeyForApp } from '../config/clerk-apps.js';

/**
 * Multi-tenant Clerk client that automatically selects the correct configuration
 * based on centralized app configuration
 */
const getClerkClient = (appType?: AppType) => {
  if (appType) {
    const secretKey = getSecretKeyForApp(appType);
    return secretKey ? createClerkClient({ secretKey }) : null;
  }

  // Fallback logic for backward compatibility - try nodex first
  const nodexKey = getSecretKeyForApp(AppType.NODEX);
  if (nodexKey) {
    return createClerkClient({ secretKey: nodexKey });
  }

  // Then try bubbleparse
  const bubbleparseKey = getSecretKeyForApp(AppType.BUBBLEPARSE);
  if (bubbleparseKey) {
    return createClerkClient({ secretKey: bubbleparseKey });
  }

  return null;
};

// Default client (for backward compatibility)
const clerk = getClerkClient();

export { clerk, getClerkClient };
