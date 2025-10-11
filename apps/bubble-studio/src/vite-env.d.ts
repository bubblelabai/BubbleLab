/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_ENDPOINT?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_SHOW_LEGACY_PARAMS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
