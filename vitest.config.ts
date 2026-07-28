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
        // Baseline on 2026-07-28: 58.68 statements/lines, 56.44 functions,
        // and 74.07 branches. Keep headroom for small source additions while
        // preventing a return to unmeasured route/coordination regressions.
        lines: 55,
        functions: 50,
        statements: 55,
        branches: 70,
      },
    },
  },
});
