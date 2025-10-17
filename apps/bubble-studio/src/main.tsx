import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { QueryProvider } from './providers/QueryProvider';
import { ClerkProvider } from '@clerk/clerk-react';
import { AuthWrapper } from './components/AuthWrapper';
import {
  CLERK_PUBLISHABLE_KEY,
  DISABLE_AUTH,
  POSTHOG_API_KEY,
  POSTHOG_HOST,
  ANALYTICS_ENABLED,
} from './env';
import { dark } from '@clerk/themes';
import { analytics } from './services/analytics';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {DISABLE_AUTH ? (
      <AuthWrapper>
        <QueryProvider>
          <App />
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
            <App />
          </QueryProvider>
        </AuthWrapper>
      </ClerkProvider>
    )}
  </StrictMode>
);
