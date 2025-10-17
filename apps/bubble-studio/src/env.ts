// Centralized environment variable access for the Bubbleflow IDE

// Normalize and provide sensible fallbacks between different env var names
const resolveApiBaseUrl = (): string => {
  const configured =
    import.meta.env.VITE_API_URL || import.meta.env.VITE_API_ENDPOINT || '';

  const base =
    configured && configured.trim().length > 0
      ? configured
      : 'http://localhost:3001';

  // Ensure no trailing slash for consistent concatenation
  return base.replace(/\/$/, '');
};

export const API_BASE_URL: string = resolveApiBaseUrl();
export const CLERK_PUBLISHABLE_KEY: string | undefined = import.meta.env
  .VITE_CLERK_PUBLISHABLE_KEY;
export const SHOW_LEGACY_PARAMS: boolean =
  import.meta.env.VITE_SHOW_LEGACY_PARAMS === 'true';
export const DISABLE_AUTH: boolean =
  import.meta.env.VITE_DISABLE_AUTH === 'true';

// PostHog Analytics Configuration
export const POSTHOG_API_KEY: string | undefined = import.meta.env
  .VITE_POSTHOG_API_KEY;
export const POSTHOG_HOST: string =
  import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
export const ANALYTICS_ENABLED: boolean =
  import.meta.env.VITE_ANALYTICS_ENABLED !== 'false'; // Enabled by default unless explicitly disabled

console.log('DISABLE_AUTH', DISABLE_AUTH);
