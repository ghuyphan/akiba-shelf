import { closeSync, createReadStream, fstatSync, openSync } from "node:fs";
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

        response.setHeader("Content-Length", Math.max(0, end - start + 1));
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
          "**/GachaPage-*.js",
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
