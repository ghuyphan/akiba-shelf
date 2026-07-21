import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
        lines: 20,
        functions: 25,
        statements: 20,
        branches: 55,
      },
    },
  },
});
