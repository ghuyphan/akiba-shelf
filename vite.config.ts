import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/akiba-shelf/" : "/",
  plugins: [react(), VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["favicon.svg"],
    manifest: false,
    workbox: {
      importScripts: ["push-handlers.js"],
      navigateFallback: "index.html",
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/public/product-images/"),
          handler: "CacheFirst",
          options: { cacheName: "akiba-product-images-v1", expiration: { maxEntries: 160, maxAgeSeconds: 31536000 }, cacheableResponse: { statuses: [0, 200] } },
        },
      ],
    },
  })],
}));
