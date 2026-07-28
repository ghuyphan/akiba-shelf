import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "critical-webkit.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10_000 },
  use: {
    ...devices["iPhone 13"],
    baseURL: "http://127.0.0.1:4174/",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      MATSURI_RELEASE: "webkit-current",
      VITE_SUPABASE_URL: "http://127.0.0.1:4174/mock-supabase",
      VITE_SUPABASE_ANON_KEY: "test-publishable-key",
      VITE_TURNSTILE_TEST_BYPASS: "true",
      VITE_VAPID_PUBLIC_KEY: "",
    },
  },
  projects: [{ name: "critical-webkit", use: { ...devices["iPhone 13"] } }],
});
