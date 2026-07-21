import {
  closeSync,
  createReadStream,
  fstatSync,
  openSync,
  readdirSync,
  statSync,
} from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { createOfflinePack } from "./scripts/offline-pack-identity.mjs";

const gachaDevRoot = resolve(process.cwd(), ".gacha-dist");
const hsrDevRoot = resolve(process.cwd(), ".hsr-gacha-dist");

type DevelopmentOfflineAsset = {
  path: string;
  size: number;
  sourcePath: string;
};

function listDevelopmentOfflineAssets(root: string, prefix: string) {
  const files: DevelopmentOfflineAsset[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name !== ".nojekyll" && !entry.name.endsWith(".map")) {
        files.push({
          path: `/${prefix}/${relative(root, path).split(sep).join("/")}`,
          size: statSync(path).size,
          sourcePath: path,
        });
      }
    }
  };
  visit(root);
  return files;
}

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

function injectModulePreloadAndPreconnect(): Plugin {
  let supabaseUrl = "";
  return {
    name: "inject-module-preload-and-preconnect",
    configResolved(config) {
      supabaseUrl = config.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        let AppChunkFileName = "";
        if (ctx.bundle) {
          for (const [, chunk] of Object.entries(ctx.bundle)) {
            if (chunk.type === "chunk" && (chunk.name === "App" || chunk.fileName.startsWith("assets/App-") || chunk.fileName.includes("/App-"))) {
              AppChunkFileName = chunk.fileName;
              break;
            }
          }
        }

        const tags = [];

        // 1. Module preload App chunk if found
        if (AppChunkFileName) {
          tags.push({
            tag: "link",
            attrs: {
              rel: "modulepreload",
              href: `${ctx.server ? "" : "/"}${AppChunkFileName}`,
            },
            injectTo: "head" as const,
          });
        }

        // 2. Preconnect to Supabase if URL is set
        if (supabaseUrl) {
          try {
            const origin = new URL(supabaseUrl).origin;
            tags.push(
              {
                tag: "link",
                attrs: {
                  rel: "preconnect",
                  href: origin,
                  crossorigin: "anonymous",
                },
                injectTo: "head" as const,
              },
              {
                tag: "link",
                attrs: {
                  rel: "dns-prefetch",
                  href: origin,
                },
                injectTo: "head" as const,
              }
            );
          } catch {
            // Ignore malformed URL
          }
        }

        return tags.length ? { html, tags } : html;
      },
    },
  };
}

function serveGachaInDevelopment(): Plugin {
  return {
    name: "serve-gacha-in-development",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url) return next();
        const pathname = new URL(request.url, "http://localhost").pathname;
        if (pathname === "/offline-assets.json") {
          try {
            const genshinAssets = listDevelopmentOfflineAssets(
              gachaDevRoot,
              "gacha-simulator",
            ).sort((a, b) => a.path.localeCompare(b.path));
            const hsrAssets = listDevelopmentOfflineAssets(
              hsrDevRoot,
              "hsr-simulator",
            ).sort((a, b) => a.path.localeCompare(b.path));
            const body = JSON.stringify({
              version: 2,
              generatedAt: new Date().toISOString(),
              packs: {
                genshin: createOfflinePack(genshinAssets),
                hsr: createOfflinePack(hsrAssets),
              },
            });
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.setHeader("Cache-Control", "no-store");
            response.end(body);
          } catch {
            response.statusCode = 503;
            response.end("Offline assets are still being prepared.");
          }
          return;
        }
        const isGenshin = pathname === "/gacha-simulator" || pathname.startsWith("/gacha-simulator/");
        const isHsr = pathname === "/hsr-simulator" || pathname.startsWith("/hsr-simulator/");

        if (!isGenshin && !isHsr) {
          return next();
        }

        const prefix = isGenshin ? "/gacha-simulator" : "/hsr-simulator";
        const devRoot = isGenshin ? gachaDevRoot : hsrDevRoot;

        let relativePath = "";
        try {
          relativePath = decodeURIComponent(pathname.slice(prefix.length));
        } catch {
          response.statusCode = 400;
          response.end("Bad Request");
          return;
        }
        if (!relativePath || relativePath.endsWith("/")) {
          relativePath += "index.html";
        }
        let filePath = "";
        let fileSize = 0;
        let fileDescriptor: number | undefined;
        for (const candidateRoot of [devRoot, `${devRoot}.previous`]) {
          const candidate = resolve(candidateRoot, `.${relativePath}`);
          if (!candidate.startsWith(`${candidateRoot}${sep}`)) continue;
          let descriptor: number | undefined;
          try {
            descriptor = openSync(candidate, "r");
            const fileStat = fstatSync(descriptor);
            if (!fileStat.isFile()) {
              closeSync(descriptor);
              descriptor = undefined;
              continue;
            }
            filePath = candidate;
            fileSize = fileStat.size;
            fileDescriptor = descriptor;
            descriptor = undefined;
            break;
          } catch {
            // A simulator rebuild may be atomically swapping directories.
            if (descriptor !== undefined) closeSync(descriptor);
          }
        }
        if (!filePath || fileDescriptor === undefined) return next();

        response.statusCode = 200;
        response.setHeader(
          "Content-Type",
          contentTypes[extname(filePath).toLowerCase()] ??
            "application/octet-stream",
        );
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Accept-Ranges", "bytes");

        let start = 0;
        let end = Math.max(0, fileSize - 1);
        const range = request.headers.range;
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!match || (!match[1] && !match[2])) {
            response.statusCode = 416;
            response.setHeader("Content-Range", `bytes */${fileSize}`);
            closeSync(fileDescriptor);
            response.end();
            return;
          }

          if (!match[1]) {
            const suffixLength = Number(match[2]);
            if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
              response.statusCode = 416;
              response.setHeader("Content-Range", `bytes */${fileSize}`);
              closeSync(fileDescriptor);
              response.end();
              return;
            }
            start = Math.max(0, fileSize - suffixLength);
            end = fileSize - 1;
          } else {
            start = Number(match[1]);
            end = match[2] ? Number(match[2]) : fileSize - 1;
          }

          if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start < 0 ||
            start >= fileSize ||
            end < start
          ) {
            response.statusCode = 416;
            response.setHeader("Content-Range", `bytes */${fileSize}`);
            closeSync(fileDescriptor);
            response.end();
            return;
          }

          end = Math.min(end, fileSize - 1);
          response.statusCode = 206;
          response.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
        }

        response.setHeader(
          "Content-Length",
          fileSize === 0 ? 0 : Math.max(0, end - start + 1),
        );
        if (request.method === "HEAD") {
          closeSync(fileDescriptor);
          response.end();
          return;
        }
        if (fileSize === 0) {
          closeSync(fileDescriptor);
          response.end();
          return;
        }

        const stream = createReadStream(filePath, {
          fd: fileDescriptor,
          start,
          end,
          autoClose: true,
        });
        response.once("close", () => stream.destroy());
        stream.once("error", (error) => response.destroy(error));
        stream.pipe(response);
      });
    },
  };
}

export default defineConfig(({ command }) => ({
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
    injectModulePreloadAndPreconnect(),
    serveGachaInDevelopment(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Production registration is route-aware in src/lib/pwa.ts. Development
      // needs the plugin's virtual worker URL so offline refreshes are testable.
      injectRegister: command === "serve" ? "auto" : null,
      includeAssets: ["favicon.svg"],
      manifest: false,
      devOptions: {
        enabled: true,
        navigateFallbackAllowlist: [
          /^\/(?:admin|dashboard|auth)(?:\/|$)/,
          /^\/s\/[^/]+(?:\/play)?\/?$/,
        ],
      },
      workbox: {
        // Precache only the static app bootstrap. Route modules and their
        // dependencies are cached when visited, or captured by Save offline.
        globPatterns:
          command === "build"
            ? [
                "index.html",
                "assets/index-*.{js,css}",
                "assets/App-*.js",
                "assets/PlatformMark-*.js",
                "assets/pwa-*.js",
                "assets/lazyWithRetry-*.js",
                "assets/platformI18n-*.js",
                "assets/supabase-*.js",
                "assets/EmptyState-*.js",
              ]
            : [],
        importScripts: ["push-handlers.js"],
        navigateFallback: "index.html",
        navigateFallbackAllowlist: [
          /^\/(?:admin|dashboard|auth)(?:\/|$)/,
          /^\/s\/[^/]+(?:\/play)?\/?$/,
        ],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              /\/assets\/.*\.(?:js|css)$/i.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "app-route-chunks-v1",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Keep Vite's module graph available for realistic offline-F5 testing.
            // These URLs do not exist in a production build.
            urlPattern:
              /\/(?:@vite\/|@vite-plugin-pwa\/|@react-refresh(?:$|\?)|@fs\/|src\/|node_modules\/|vendor\/|brand\/)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "vite-dev-app-shell",
              networkTimeoutSeconds: 2,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              /^\/(?:gacha-simulator|hsr-simulator)\/(?:$|.*\.(?:html|js|css|json))$/i.test(
                url.pathname,
              ),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "gacha-app-shell-v3",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 90 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
              matchOptions: { ignoreSearch: true },
            },
          },
          {
            urlPattern: ({ url }) =>
              /^\/(?:gacha-simulator|hsr-simulator)\/.*\.(?:mp4|webm|ogg|mp3|wav)$/i.test(
                url.pathname,
              ),
            handler: "CacheFirst",
            options: {
              cacheName: "gacha-media-cache-v1",
              rangeRequests: true,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              /^\/(?:gacha-simulator|hsr-simulator)\/.*\.(?:woff2?|ttf|png|jpe?g|webp|svg)$/i.test(
                url.pathname,
              ),
            handler: "CacheFirst",
            options: {
              cacheName: "gacha-static-cache-v1",
              expiration: {
                maxEntries: 240,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/storage\/v1\/object\/public\//,
            handler: "CacheFirst",
            options: {
              // v2 drops any opaque error response cached by the old policy.
              cacheName: "supabase-storage-cache-v2",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                // An opaque response hides its real HTTP status. Caching status
                // 0 can therefore turn a transient/missing product image into a
                // broken entry for the full cache lifetime.
                statuses: [200],
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "product-image-cache-v2",
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
}));
