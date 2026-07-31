import { applyFunctionSecurityHeaders } from "./media-route";

export const STALE_APP_ASSET_HEADER = "x-matsuri-stale-asset";

const VERSIONED_APP_SCRIPT = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.js$/;

export const STALE_APP_ASSET_RECOVERY_SCRIPT = `
const APP_CACHE_PREFIX = "app-route-chunks-";

async function refreshApplication() {
  try {
    if ("caches" in globalThis) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith(APP_CACHE_PREFIX))
          .map((name) => caches.delete(name)),
      );
    }

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (registration) {
        await registration.update();
        const worker = registration.installing || registration.waiting;
        if (worker && worker.state !== "activated") {
          await new Promise((resolve) => {
            const finish = () => {
              clearTimeout(timeout);
              worker.removeEventListener("statechange", handleStateChange);
              navigator.serviceWorker.removeEventListener(
                "controllerchange",
                finish,
              );
              resolve();
            };
            const handleStateChange = () => {
              if (worker.state === "installed") {
                registration.waiting?.postMessage({ type: "SKIP_WAITING" });
              }
              if (worker.state === "activated" || worker.state === "redundant") {
                finish();
              }
            };
            const timeout = setTimeout(finish, 5000);
            worker.addEventListener("statechange", handleStateChange);
            navigator.serviceWorker.addEventListener("controllerchange", finish, {
              once: true,
            });
            handleStateChange();
          });
        }
      }
    }
  } catch {
    // A network reload still recovers visitors without a working service worker.
  }

  location.reload();
}

void refreshApplication();
throw new Error("Matsuri is updating a retired application asset.");
`;

export function isVersionedAppScriptPath(pathname: string): boolean {
  return VERSIONED_APP_SCRIPT.test(pathname);
}

export function isJavaScriptResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return response.ok && contentType.includes("javascript");
}

export function createStaleAppAssetResponse(method: string): Response {
  const headers = applyFunctionSecurityHeaders(
    new Headers({
      "cache-control": "no-cache, no-store, must-revalidate",
      "content-type": "application/javascript; charset=utf-8",
      [STALE_APP_ASSET_HEADER]: "recover",
    }),
  );
  return new Response(
    method === "HEAD" ? null : STALE_APP_ASSET_RECOVERY_SCRIPT,
    {
      status: 200,
      headers,
    },
  );
}
