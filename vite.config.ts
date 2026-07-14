import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => ({
  base: "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@supabase/")) return "supabase";
        },
      },
    },
  },
  plugins: [react(), VitePWA({
    registerType: "autoUpdate",
    injectRegister: null,
    includeAssets: ["favicon.svg"],
    manifest: false,
    workbox: {
      globIgnores: [
        "404.html",
        "**/CatalogPage-*.js",
        "**/HomePage-*.js",
        "**/AuthPage-*.js",
        "**/AuthCallbackPage-*.js",
        "**/SetPasswordPage-*.js",
      ],
      importScripts: ["push-handlers.js"],
      navigateFallback: "index.html",
      navigateFallbackAllowlist: [/^\/(?:admin|dashboard)(?:\/|$)/],
      cleanupOutdatedCaches: true,
    },
  })],
}));
