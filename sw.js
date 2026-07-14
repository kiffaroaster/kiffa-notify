self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
    /* ignore malformed payload */
  }
  const title = data.title || "طلبك جاهز! ☕";
  const options = {
    body: data.body || "تفضّل لاستلام طلبك من كفة",
    icon: "/assets/pwa-icon-192.png",
    badge: "/assets/pwa-icon-192.png",
    dir: "rtl",
    lang: "ar",
    vibrate: [200, 100, 200],
    data: { invoice: data.invoice || null },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow("/");
      })
  );
});
