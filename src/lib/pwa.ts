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
  return path === "/admin" || path === "/dashboard" || path.startsWith("/dashboard/");
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
  return navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    })
    .then((registration) => {
      window.setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
      return registration;
    })
    .catch(() => {
      registrationPromise = null;
      return undefined;
    });
}

export function registerPwa(pathname = window.location.pathname) {
  if (!isStaffPwaPath(pathname) || !("serviceWorker" in navigator))
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

export function configurePwaForPath(pathname: string) {
  const enabled = isStaffPwaPath(pathname);
  setManifestEnabled(enabled);
  if (enabled) {
    ensureInstallListeners();
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
  return Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0),
  );
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
  const { count } = await supabase
    .from("push_subscriptions")
    .select("endpoint", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("endpoint", subscription.endpoint);
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
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before enabling notifications.");
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
  const registration = await requireStaffRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("shop_id", shopId)
    .eq("endpoint", subscription.endpoint);
  const { count } = await supabase
    .from("push_subscriptions")
    .select("endpoint", { count: "exact", head: true })
    .eq("endpoint", subscription.endpoint);
  if (!count) await subscription.unsubscribe();
}
