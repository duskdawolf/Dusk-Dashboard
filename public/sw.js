self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Dusk Industries",
      message: event.data ? event.data.text() : "",
    };
  }

  const title = data.title || "Dusk Industries";
  const options = {
    body: data.message || "",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    data: {
      url: data.url || "/dashboard/notifications",
      notificationId: data.notificationId || null,
      eventKey: data.eventKey || "system.generic",
    },
    tag: data.notificationId || data.eventKey || "dusk-notification",
    renotify: Boolean(data.urgent),
    requireInteraction: Boolean(data.urgent),
    actions: data.actionLabel
      ? [{ action: "open", title: data.actionLabel }]
      : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url || "/dashboard/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
