const CACHE_NAME = "sg-portfolio-v10";
const CORE = [
  "./",
  "./index.html",
  "./subas-ghimire.html",
  "./hi.html",
  "./pro-workspace.html",
  "./launchpad.html",
  "./studio.html",
  "./creator-tools.html",
  "./news-thumbnail-maker.html",
  "./effects.html",
  "./cv.html",
  "./work.html",
  "./site.webmanifest",
  "./assets/site.css",
  "./assets/studio.css"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE.map(url => new Request(url, { cache: "reload" }))).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  const url = new URL(req.url);
  const isPage = req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html");

  if (isPage) {
    // Always prefer the current website version; use the cached page only offline.
    event.respondWith(
      fetch(req).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      }).catch(() => caches.match(req).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(response => {
        if (response.ok && /\.(css|js|svg|webmanifest)$/.test(url.pathname)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      });
    })
  );
});