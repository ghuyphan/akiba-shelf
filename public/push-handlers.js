self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(data.title || "New booth order", { body: data.body || "A customer placed a new order.", icon: data.icon, badge: data.badge || data.icon, tag: data.tag || "new-order", renotify: true, data: { url: data.url || "./admin" } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const target = new URL(event.notification.data?.url || "./admin", self.registration.scope).href;
    const existing = clients.find((client) => client.url.startsWith(target));
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
