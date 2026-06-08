/* Longrein service worker — Web Push handler.
   Shows the notification and focuses/opens the app on click. */

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Longrein", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Longrein";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    data: { url: data.url || "/dashboard/calendar" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
