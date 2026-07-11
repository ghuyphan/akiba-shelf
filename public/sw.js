const CACHE = "akiba-shelf-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["./", "./manifest.webmanifest", "./favicon.svg"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(data.title || "New booth order", {
    body: data.body || "A customer placed a new order.",
    icon: data.icon || undefined,
    badge: data.badge || data.icon || undefined,
    tag: data.tag || "new-order",
    renotify: true,
    data: { url: data.url || "./admin" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const target = new URL(event.notification.data?.url || "./admin", self.registration.scope).href;
    const existing = clients.find((client) => client.url.startsWith(target));
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  }));
});
