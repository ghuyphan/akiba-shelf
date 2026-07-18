import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "storefront-perf.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,

  use: {
    baseURL: "http://127.0.0.1:4174/",
    trace: "on-first-retry",
  },

  webServer: {
    command: "npm run dev -- --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:4174/mock-supabase",
      VITE_SUPABASE_ANON_KEY: "test-publishable-key",
      VITE_VAPID_PUBLIC_KEY: "",
    },
  },

  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "phone-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
