const CACHE_PREFIX = "ftc-scout-arena-";
const CACHE_NAME = `${CACHE_PREFIX}v11-${new URL(self.registration.scope).pathname}`;
const APP_SHELL = [
  "./", "index.html", "icon.svg", "assets/acrux-logo.jpg", "manifest.webmanifest", "src/styles.css",
  "src/app.js", "src/components/ui.js", "src/components/forms.js",
  "src/data/seed.js", "src/services/storage.js", "src/services/scoring.js",
  "src/services/analytics.js", "src/services/export.js", "src/services/import.js",
  "src/types/domain.js", "src/utils/domain.js", "src/pages/dashboard.js",
  "src/pages/matches.js", "src/pages/scout.js", "src/pages/teams.js",
  "src/pages/ranking.js", "src/pages/compare.js", "src/pages/favorites.js",
  "src/pages/stats.js", "src/pages/season.js", "src/pages/admin.js",
  "src/pages/settings.js", "src/pages/more.js"
].map((path) => new URL(path, self.registration.scope).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // Fresh files when connected; the complete app remains available offline.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") return await cache.match(new URL("index.html", self.registration.scope).href);
      return Response.error();
    }
  })());
});
