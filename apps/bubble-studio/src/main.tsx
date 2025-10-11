import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { QueryProvider } from './providers/QueryProvider';
import { ClerkProvider } from '@clerk/clerk-react';
import { AuthWrapper } from './components/AuthWrapper';
import { CLERK_PUBLISHABLE_KEY, DISABLE_AUTH } from './env';
import { dark } from '@clerk/themes';

const PUBLISHABLE_KEY = CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY && !DISABLE_AUTH) {
  throw new Error('Missing Clerk Publishable Key');
}

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
