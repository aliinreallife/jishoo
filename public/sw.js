self.addEventListener("install", (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
// No offline caching: friend activity and private account data stay current.
self.addEventListener("push", (event) => {
  let payload = {
    title: "جیشو",
    body: "یه خبر کوچولو از دوستات",
    url: "/#/home",
  };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/assets/app-icon-192.png",
      badge: "/assets/app-icon-192.png",
      tag: payload.tag || "jishoo-update",
      data: { url: payload.url },
      renotify: false,
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/#/home",
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        for (const window of windows) {
          if (new URL(window.url).origin === target.origin) {
            await window.navigate(target.href);
            return window.focus();
          }
        }
        return clients.openWindow(target.href);
      }),
  );
});
