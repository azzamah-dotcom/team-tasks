// Team Tasks service worker: shows phone push notifications and opens the app when one is tapped.
// It doesn't cache pages, so the app always loads fresh from the server.
"use strict";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "Team Tasks";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    tag: data.tag || undefined,          // a newer update to the same task replaces the older one
    renotify: Boolean(data.tag),
    icon: "/icon-192.png",
    badge: "/favicon-32.png",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of open) {
      if (client.url.startsWith(self.location.origin)) {
        await client.focus();
        client.postMessage({ type: "refresh" });  // show the latest tasks
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
