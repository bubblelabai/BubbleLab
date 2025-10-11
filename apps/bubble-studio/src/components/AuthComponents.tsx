import { type ReactNode } from 'react';
import {
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
} from '@clerk/clerk-react';
import { DISABLE_AUTH } from '../env';

interface AuthComponentProps {
  children: ReactNode;
}

/**
 * Custom SignedIn component that wraps Clerk's SignedIn
 * When DISABLE_AUTH is true, always renders children (acts as if user is signed in)
 */
export function SignedIn({ children }: AuthComponentProps) {
  if (DISABLE_AUTH) {
    return <>{children}</>;
  }
  return <ClerkSignedIn>{children}</ClerkSignedIn>;
}

/**
 * Custom SignedOut component that wraps Clerk's SignedOut
 * When DISABLE_AUTH is true, never renders children (acts as if user is always signed in)
 */
export function SignedOut({ children }: AuthComponentProps) {
  if (DISABLE_AUTH) {
    return null;
  }
  return <ClerkSignedOut>{children}</ClerkSignedOut>;
}
