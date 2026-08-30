const CACHE_NAME = "ftc-scout-arena-v9";
const APP_SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "src/styles.css",
  "src/app.js",
  "src/components/ui.js",
  "src/data/seed.js",
  "src/services/storage.js",
  "src/services/scoring.js",
  "src/services/analytics.js",
  "src/services/export.js",
  "src/types/domain.js",
  "src/utils/domain.js",
  "src/pages/dashboard.js",
  "src/pages/matches.js",
  "src/pages/scout.js",
  "src/pages/teams.js",
  "src/pages/ranking.js",
  "src/pages/compare.js",
  "src/pages/favorites.js",
  "src/pages/stats.js",
  "src/pages/season.js",
  "src/pages/admin.js",
  "src/pages/settings.js"
].map((path) => new URL(path, self.registration.scope).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const clone = response.clone();
      if (new URL(event.request.url).origin === self.location.origin) {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(new URL("index.html", self.registration.scope).toString())))
  );
});
