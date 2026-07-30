import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_TURNSTILE_TEST_BYPASS": JSON.stringify("true"),
  },
  test: {
    exclude: [
      "e2e/**",
      "supabase/functions/**",
      "node_modules/**",
      "vendor/**",
      "dist/**",
    ],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts"],
      // Keep the ratchet scoped to application source, not generated builds,
      // vendored simulators, scripts, or Playwright infrastructure.
      thresholds: {
        // Baseline on 2026-07-30: 61.81 statements/lines, 59.60 functions,
        // and 75.06 branches. Small headroom permits focused source additions
        // while requiring new stateful controllers to ship with tests.
        lines: 60,
        functions: 58,
        statements: 60,
        branches: 74,
      },
    },
  },
});
