const CACHE = "jishoo-public-v2";
// Stamped for every production build, even when worker behavior is unchanged.
const BUILD_ID = "__JISHOO_BUILD_ID__";
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "/offline.html",
          "/assets/favicon-v2-32.png",
          "/assets/favicon-v2-64.png",
          "/assets/apple-touch-icon-v2.png",
          "/assets/app-icon-v2-192.png",
          "/assets/app-icon-v2-512.png",
          "/assets/app-icon-v2-maskable-512.png",
          "/assets/notification-badge-v2.png",
        ]),
      ),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "JISHOO_SKIP_WAITING" && event.data.buildId === BUILD_ID) {
    event.waitUntil(self.skipWaiting());
  }
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("jishoo-public-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/.well-known/")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }
  if (url.pathname.startsWith("/assets/"))
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          if (keys.length > 120) await cache.delete(keys[0]);
        }
        return response;
      }),
    );
});
// Private API responses, account pages and OAuth callbacks are never cached.
self.addEventListener("push", (event) => {
  let payload = {
    title: "جیشو",
    body: "یه لحظه از روزِ دوستات",
    url: "/home",
  };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/assets/app-icon-v2-192.png",
      badge: "/assets/notification-badge-v2.png",
      tag: payload.tag || "jishoo-update",
      data: { url: payload.url },
      renotify: false,
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/home",
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
