self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete("akiba-product-images-v1"));
});
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(data.title || "New booth order", { body: data.body || "A customer placed a new order.", icon: data.icon, badge: data.badge || data.icon, tag: data.tag || "new-order", renotify: true, data: { url: data.url || "./admin" } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const scope = new URL(self.registration.scope);
    const requested = new URL(event.notification.data?.url || "./admin", scope);
    const isStaffPath = requested.pathname === `${scope.pathname}admin` || requested.pathname === `${scope.pathname}dashboard` || requested.pathname.startsWith(`${scope.pathname}dashboard/`);
    const target = (requested.origin === scope.origin && isStaffPath ? requested : new URL("./admin", scope)).href;
    const existing = clients.find((client) => client.url.startsWith(target));
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
