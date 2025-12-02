import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// Polyfill Node.js 'process' global for browser compatibility
import './utils/process-polyfill';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryProvider } from './providers/QueryProvider';
import { ClerkProvider } from '@clerk/clerk-react';
import { AuthWrapper } from './components/AuthWrapper';
import { OAuthCallback } from './components/OAuthCallback';
import { WebViewWarning } from './components/WebViewWarning';
import {
  CLERK_PUBLISHABLE_KEY,
  DISABLE_AUTH,
  POSTHOG_API_KEY,
  POSTHOG_HOST,
  ANALYTICS_ENABLED,
  API_BASE_URL,
} from './env';
import { dark } from '@clerk/themes';
import { analytics } from './services/analytics';
import { patchDOMForGoogleTranslate } from './utils/googleTranslateFix';

// Disable console.debug in dev mode (can be enabled with ENABLE_DEBUG_LOGS=true)
if (!import.meta.env.VITE_ENABLE_DEBUG_LOGS) {
  console.debug = () => {};
}

// Import the generated route tree
import { routeTree } from './routeTree.gen';

// Patch DOM methods to handle Google Translate mutations
// This prevents React from crashing when Google Translate modifies the DOM
patchDOMForGoogleTranslate();

const PUBLISHABLE_KEY = CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY && !DISABLE_AUTH) {
  throw new Error('Missing Clerk Publishable Key');
}

// Initialize PostHog Analytics
analytics.init({
  apiKey: POSTHOG_API_KEY || '',
  host: POSTHOG_HOST,
  enabled: ANALYTICS_ENABLED && !!POSTHOG_API_KEY,
});

// Create router instance
const router = createRouter({ routeTree });

// Declare the router type for TypeScript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Check for OAuth callback BEFORE rendering router
const urlParams = new URLSearchParams(window.location.search);
const isOAuthCallback =
  (urlParams.has('code') && urlParams.has('state')) ||
  urlParams.has('success') ||
  urlParams.has('error');

if (isOAuthCallback) {
  // Render OAuth callback UI (popup window)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <WebViewWarning />
      <OAuthCallback apiBaseUrl={API_BASE_URL} />
    </StrictMode>
  );
} else {
  // Normal app with router
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <WebViewWarning />
      {DISABLE_AUTH ? (
        <AuthWrapper>
          <QueryProvider>
            <RouterProvider router={router} />
          </QueryProvider>
        </AuthWrapper>
      ) : (
        <ClerkProvider
          publishableKey={PUBLISHABLE_KEY!}
          afterSignOutUrl="/"
          appearance={{
            baseTheme: dark,
          }}
        >
          <AuthWrapper>
            <QueryProvider>
              <RouterProvider router={router} />
            </QueryProvider>
          </AuthWrapper>
        </ClerkProvider>
      )}
    </StrictMode>
  );
}
