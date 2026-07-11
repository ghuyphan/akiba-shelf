import type { BoothSettings } from "../types/catalog";
import { supabase } from "./supabase";

let manifestUrl = "";

export function registerPwa() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}

export function applyPwaIdentity(booth: BoothSettings) {
  const name = booth.booth_name?.trim() || "Akiba Shelf";
  const icon = booth.logo_url?.trim();
  document.title = name;

  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.append(favicon);
  }
  favicon.href = icon || `${import.meta.env.BASE_URL}favicon.svg`;

  const manifest = {
    name,
    short_name: name.slice(0, 24),
    description: booth.subtitle?.trim() || `${name} merch booth`,
    start_url: `${import.meta.env.BASE_URL}admin`,
    scope: import.meta.env.BASE_URL,
    display: "standalone",
    background_color: booth.theme_background || "#f8fafc",
    theme_color: booth.theme_primary || "#6366f1",
    icons: icon ? [{ src: icon, sizes: "any", purpose: "any maskable" }] : [{ src: `${import.meta.env.BASE_URL}favicon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
  };
  if (manifestUrl) URL.revokeObjectURL(manifestUrl);
  manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
  document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.setAttribute("href", manifestUrl);
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function canUsePush() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushEnabled() {
  if (!canUsePush()) return false;
  const registration = await navigator.serviceWorker.ready;
  return Boolean(await registration.pushManager.getSubscription());
}

export async function enableOrderNotifications() {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() || "BJnCTB3TuOPXM3r5rHbo3CWdq5dWK2uJx5yaGrQDGAil1IU65w4QJyIAiImH3nv0ds_Lj1oRtQFrfJr9j5VNXQs";
  if (!publicKey) throw new Error("Push notifications are not configured yet.");
  if (!supabase) throw new Error("Supabase is not configured.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before enabling notifications.");
  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: auth.user.id,
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent,
  }, { onConflict: "endpoint" });
  if (error) throw error;
}

export async function disableOrderNotifications() {
  if (!supabase || !canUsePush()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}
