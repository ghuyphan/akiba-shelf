/// <reference types="vite/client" />

declare const __MATSURI_RELEASE__: string;
declare const __MATSURI_SIMULATOR_CACHE_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_TURNSTILE_TEST_BYPASS?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_RUM_SAMPLE_RATE?: string;
}
