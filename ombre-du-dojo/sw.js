/* Network-first service worker — always prefer live updates on open */
const CACHE = "ombre-du-dojo-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        if (fresh && fresh.ok && req.url.startsWith(self.location.origin)) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (_) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw _;
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
