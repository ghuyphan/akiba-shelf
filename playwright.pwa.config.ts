import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "production-pwa.spec.ts",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:4174/",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "npm run build && npm run preview -- --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:4174/mock-supabase",
      VITE_SUPABASE_ANON_KEY: "test-publishable-key",
      VITE_TURNSTILE_TEST_BYPASS: "true",
      VITE_VAPID_PUBLIC_KEY: "",
    },
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
