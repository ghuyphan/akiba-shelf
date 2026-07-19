import { supabase } from "./supabase";

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

export function shouldRegisterPwa(pathname: string) {
  const path = appRelativePath(pathname);
  return isStaffPwaPath(pathname) || /^\/s\/[^/]+(?:\/play)?\/?$/.test(path);
}

function setManifestEnabled(enabled: boolean) {
  const existing = document.head.querySelector<HTMLLinkElement>(
    `link[${MANIFEST_MARKER}]`,
  );
  if (!enabled) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = `${import.meta.env.BASE_URL}manifest.webmanifest`;
  manifest.setAttribute(MANIFEST_MARKER, "");
  document.head.append(manifest);
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

export function registerPwa(pathname = window.location.pathname) {
  if (!shouldRegisterPwa(pathname) || !("serviceWorker" in navigator))
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

export async function ensureOfflineNavigationReady(
  pathname = window.location.pathname,
) {
  const registration = await registerPwa(pathname);
  if (!registration) {
    throw new Error("Offline navigation could not be enabled in this browser.");
  }

  if (!registration.active) {
    const worker = registration.installing || registration.waiting;
    if (worker) {
      await new Promise<void>((resolve) => {
        if (worker.state === "activated") {
          resolve();
          return;
        }
        const stateChangeHandler = () => {
          if (worker.state === "activated") {
            worker.removeEventListener("statechange", stateChangeHandler);
            resolve();
          }
        };
        worker.addEventListener("statechange", stateChangeHandler);
      });
    }
  }

  if (!registration.active && !navigator.serviceWorker.controller) {
    throw new Error("Offline navigation could not be enabled in this browser.");
  }
  if (import.meta.env.DEV && "caches" in window) {
    const developmentAssetPath =
      /^\/(?:@vite\/|@vite-plugin-pwa\/|@react-refresh(?:$|\?)|@fs\/|src\/|node_modules\/|vendor\/|brand\/)/;
    const urls = new Set(
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((value) => {
          const url = new URL(value, location.href);
          return url.origin === location.origin && developmentAssetPath.test(url.pathname);
        }),
    );
    document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((script) => {
      const url = new URL(script.src, location.href);
      if (url.origin === location.origin && developmentAssetPath.test(url.pathname))
        urls.add(url.href);
    });
    const cache = await caches.open("vite-dev-app-shell");
    await Promise.all(
      [...urls].map(async (url) => {
        const request = new Request(url);
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response);
      }),
    );
  }
  return registration;
}

export function configurePwaForPath(pathname: string) {
  const isStaff = isStaffPwaPath(pathname);
  const isStorefront = /^\/s\/[^/]+(?:\/play)?\/?$/.test(appRelativePath(pathname));
  setManifestEnabled(isStaff || isStorefront);
  if (isStaff || isStorefront) {
    ensureInstallListeners();
  }
  if (shouldRegisterPwa(pathname)) {
    void registerPwa(pathname).catch(() => undefined);
  }
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
  if (!subscription || !shopId || !supabase) return Boolean(subscription);
  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("endpoint", subscription.endpoint);
  if (error) throw error;
  return Boolean(count);
}

export async function enableOrderNotifications(shopId = "") {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey)
    throw new Error(
      "Push notifications are not configured. Set VITE_VAPID_PUBLIC_KEY.",
    );
  if (!shopId) throw new Error("Select a shop before enabling notifications.");
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    throw new Error("Sign in before enabling notifications.");
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
  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      shop_id: shopId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "shop_id,endpoint" },
  );
  if (error) {
    await subscription.unsubscribe();
    throw error;
  }
}

export async function disableOrderNotifications(shopId = "") {
  if (!supabase || !canUsePush()) return;
  if (!shopId) throw new Error("Select a shop before disabling notifications.");
  const registration = await requireStaffRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const { error: deleteError } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("shop_id", shopId)
    .eq("endpoint", subscription.endpoint);
  if (deleteError) throw deleteError;
  const { count, error: countError } = await supabase
    .from("push_subscriptions")
    .select("endpoint", { count: "exact", head: true })
    .eq("endpoint", subscription.endpoint);
  if (countError) throw countError;
  if (!count) await subscription.unsubscribe();
}
