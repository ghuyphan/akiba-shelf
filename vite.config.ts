import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const gachaDevRoot = resolve(process.cwd(), ".gacha-dist");
const hsrDevRoot = resolve(process.cwd(), ".hsr-gacha-dist");
// Keep the isolated simulator available at its production path during local development.
const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
};

function serveGachaInDevelopment(): Plugin {
  return {
    name: "serve-gacha-in-development",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url) return next();
        const pathname = new URL(request.url, "http://localhost").pathname;
        const isGenshin = pathname === "/gacha-simulator" || pathname.startsWith("/gacha-simulator/");
        const isHsr = pathname === "/hsr-simulator" || pathname.startsWith("/hsr-simulator/");

        if (!isGenshin && !isHsr) {
          return next();
        }

        const prefix = isGenshin ? "/gacha-simulator" : "/hsr-simulator";
        const devRoot = isGenshin ? gachaDevRoot : hsrDevRoot;

        let relativePath = decodeURIComponent(pathname.slice(prefix.length));
        if (!relativePath || relativePath.endsWith("/")) {
          relativePath += "index.html";
        }
        const filePath = resolve(devRoot, `.${relativePath}`);
        if (!filePath.startsWith(`${devRoot}${sep}`)) return next();

        try {
          if (!statSync(filePath).isFile()) return next();
        } catch {
          return next();
        }

        response.statusCode = 200;
        response.setHeader(
          "Content-Type",
          contentTypes[extname(filePath).toLowerCase()] ??
            "application/octet-stream",
        );
        response.setHeader("Cache-Control", "no-store");
        createReadStream(filePath).pipe(response);
      });
    },
  };
}

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
  plugins: [
    serveGachaInDevelopment(),
    react(),
    VitePWA({
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
        navigateFallbackAllowlist: [/^\/(?:admin|dashboard|auth)(?:\/|$)/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
}));
