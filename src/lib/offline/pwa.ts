import {
  getPushRegistrationStatus,
  registerPushSubscription,
  unregisterPushSubscription,
} from "../api/push";
import { prepareResponseForCache } from "./cacheResponse";
import { OFFLINE_CACHE_NAMES } from "./cacheNames";

const MANIFEST_MARKER = "data-matsuri-staff-pwa";
let registrationPromise: Promise<ServiceWorkerRegistration | undefined> | null =
  null;
type InstallOutcome = "accepted" | "dismissed" | "unavailable";
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaInstallState = "available" | "ios" | "installed" | "unavailable";

let installPrompt: InstallPromptEvent | null = null;
let installListenersReady = false;
const installStateListeners = new Set<() => void>();
const versionedRuntimeCachePrefixes = [
  "gacha-app-shell-v",
  "gacha-media-cache-v",
  "gacha-static-cache-v",
];

async function cleanupSupersededRuntimeCaches() {
  if (!("caches" in window) || typeof caches.keys !== "function") return;
  const active = new Set([
    OFFLINE_CACHE_NAMES.simulatorShell,
    OFFLINE_CACHE_NAMES.simulatorMedia,
    OFFLINE_CACHE_NAMES.simulatorStatic,
  ]);
  const names = await caches.keys();
  await Promise.all(
    names
      .filter(
        (name) =>
          versionedRuntimeCachePrefixes.some((prefix) =>
            name.startsWith(prefix),
          ) && !active.has(name),
      )
      .map((name) => caches.delete(name)),
  );
}

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

function isIosLike() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function emitInstallState() {
  installStateListeners.forEach((listener) => listener());
}

function ensureInstallListeners() {
  if (installListenersReady) return;
  installListenersReady = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    emitInstallState();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    emitInstallState();
  });
}

function appRelativePath(pathname: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (base && pathname.startsWith(`${base}/`))
    return pathname.slice(base.length);
  return pathname;
}

export function isStaffPwaPath(pathname: string) {
  const path = appRelativePath(pathname);
  return (
    path === "/admin" || path === "/dashboard" || path.startsWith("/dashboard/")
  );
}

// Capture the one-shot browser prompt before an authenticated workspace mounts.
if (typeof window !== "undefined" && isStaffPwaPath(window.location.pathname)) {
  ensureInstallListeners();
}

function ensureManifest() {
  if (document.head.querySelector(`link[${MANIFEST_MARKER}]`)) return;
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = `${import.meta.env.BASE_URL}manifest.webmanifest`;
  manifest.setAttribute(MANIFEST_MARKER, "");
  document.head.append(manifest);
}

function removeManifest() {
  document.head.querySelector(`link[${MANIFEST_MARKER}]`)?.remove();
}

function performRegistration() {
  if (import.meta.env.DEV) {
    return navigator.serviceWorker.ready;
  }
  return navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    })
    .then((registration) => {
      void cleanupSupersededRuntimeCaches().catch(() => undefined);
      window.setInterval(
        () => {
          void registration.update();
        },
        60 * 60 * 1000,
      );
      return registration;
    })
    .catch(() => {
      registrationPromise = null;
      return undefined;
    });
}

export function registerPwa() {
  if (!("serviceWorker" in navigator))
    return Promise.resolve<ServiceWorkerRegistration | undefined>(undefined);
  if (registrationPromise) return registrationPromise;
  if (document.readyState === "complete") {
    registrationPromise = performRegistration();
    return registrationPromise;
  }
  registrationPromise = new Promise<ServiceWorkerRegistration | undefined>(
    (resolve) => {
      window.addEventListener(
        "load",
        () => {
          void performRegistration().then(resolve);
        },
        { once: true },
      );
    },
  );
  return registrationPromise;
}

export async function ensureOfflineNavigationReady() {
  const registration = await registerPwa();
  if (!registration) {
    throw new Error("Offline navigation could not be enabled in this browser.");
  }

  if (!registration.active) {
    const worker = registration.installing || registration.waiting;
    if (worker) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          window.clearTimeout(timeout);
          worker.removeEventListener("statechange", stateChangeHandler);
          worker.removeEventListener("error", errorHandler);
        };
        const errorHandler = () => {
          cleanup();
          reject(new Error("Offline navigation worker installation failed."));
        };
        const stateChangeHandler = () => {
          if (worker.state === "activated") {
            cleanup();
            resolve();
          } else if (worker.state === "redundant") {
            cleanup();
            reject(new Error("Offline navigation worker became unavailable."));
          }
        };
        if (worker.state === "activated") {
          resolve();
          return;
        }
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error("Offline navigation worker activation timed out."));
        }, 15_000);
        worker.addEventListener("statechange", stateChangeHandler);
        worker.addEventListener("error", errorHandler);
        stateChangeHandler();
      });
    }
  }

  if (!registration.active && !navigator.serviceWorker.controller) {
    throw new Error("Offline navigation could not be enabled in this browser.");
  }
  if ("caches" in window) {
    const offlineAssetPath = import.meta.env.DEV
      ? /^\/(?:@vite\/|@vite-plugin-pwa\/|@react-refresh(?:$|\?)|@fs\/|src\/|node_modules\/|vendor\/|brand\/)/
      : /\/assets\/.*\.(?:js|css)$/i;
    const urls = new Set(
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((value) => {
          const url = new URL(value, location.href);
          return (
            url.origin === location.origin &&
            offlineAssetPath.test(url.pathname)
          );
        }),
    );
    document
      .querySelectorAll<HTMLScriptElement>("script[src]")
      .forEach((script) => {
        const url = new URL(script.src, location.href);
        if (
          url.origin === location.origin &&
          offlineAssetPath.test(url.pathname)
        )
          urls.add(url.href);
      });
    const cache = await caches.open(
      import.meta.env.DEV
        ? "vite-dev-app-shell"
        : OFFLINE_CACHE_NAMES.appRouteChunks,
    );
    await Promise.all(
      [...urls].map(async (url) => {
        const request = new Request(url);
        const response = await fetch(request);
        if (response.ok)
          await cache.put(request, prepareResponseForCache(response));
      }),
    );
  }
  return registration;
}

export function configurePwa(pathname = window.location.pathname) {
  if (isStaffPwaPath(pathname)) {
    ensureManifest();
    ensureInstallListeners();
  } else {
    removeManifest();
  }
  void registerPwa().catch(() => undefined);
}

export function getPwaInstallState(): PwaInstallState {
  if (isStandalone()) return "installed";
  if (installPrompt) return "available";
  if (isIosLike()) return "ios";
  return "unavailable";
}

export function subscribeToPwaInstallState(listener: () => void) {
  ensureInstallListeners();
  installStateListeners.add(listener);
  return () => {
    installStateListeners.delete(listener);
  };
}

export async function promptPwaInstall(): Promise<InstallOutcome> {
  const prompt = installPrompt;
  if (!prompt) return "unavailable";
  await prompt.prompt();
  const choice = await prompt.userChoice;
  installPrompt = null;
  emitInstallState();
  return choice.outcome;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function canUsePush(pathname = window.location.pathname) {
  return (
    isStaffPwaPath(pathname) &&
    Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()) &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function requireStaffRegistration() {
  const registration = await registerPwa();
  if (!registration)
    throw new Error("Order notifications are available only in the staff app.");
  return registration;
}

export async function getPushEnabled(shopId?: string) {
  if (!canUsePush()) return false;
  const registration = await requireStaffRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription || !shopId) return Boolean(subscription);
  return getPushRegistrationStatus(shopId, subscription.endpoint);
}

export async function enableOrderNotifications(shopId = "") {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey)
    throw new Error(
      "Push notifications are not configured. Set VITE_VAPID_PUBLIC_KEY.",
    );
  if (!shopId) throw new Error("Select a shop before enabling notifications.");
  if (!isStaffPwaPath(window.location.pathname))
    throw new Error("Order notifications are available only in the staff app.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Notification permission was not granted.");
  const registration = await requireStaffRegistration();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  try {
    await registerPushSubscription(shopId, subscription);
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
}

export async function disableOrderNotifications(shopId = "") {
  if (!canUsePush()) return;
  if (!shopId) throw new Error("Select a shop before disabling notifications.");
  const registration = await requireStaffRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const shouldUnsubscribe = await unregisterPushSubscription(
    shopId,
    subscription.endpoint,
  );
  if (shouldUnsubscribe) await subscription.unsubscribe();
}
