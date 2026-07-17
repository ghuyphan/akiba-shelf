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
      // Ratchet floors measured 2026-07-17: lines 6.98, branches 52.5,
      // functions 26.3, statements 6.98 (vendor simulators sit at 0%).
      thresholds: {
        lines: 5,
        functions: 22,
        statements: 5,
        branches: 45,
      },
    },
  },
});
