const CACHE_NAME = "groove-trainer-v1";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./favicon.ico",
  "./commits.json",
  "./manifest.json",
  "./css/styles.css",
  "./js/main.js",
  "./js/utils.js",
  "./js/visuals.js",
  "./js/metronomeCore.js",
  "./js/sessionEngine.js",
  "./js/uiController.js",
  "./js/simpleMetronome.js",
  "./js/simpleMetronomeCore.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("commits.json")) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // If the cached version is available, return it.
        if (cachedResponse) {
          // Fetch from network in parallel to update the cache
          fetch(event.request).then((networkResponse) => {
            // Once the network request is successful, update the cache
            caches.open("groove-trainer-v1").then((cache) => {
              cache.put(event.request, networkResponse);
            });
          });
          return cachedResponse;
        }

        // If not cached, go ahead and fetch from the network
        return fetch(event.request).then((networkResponse) => {
          // Cache the response for future use
          return caches.open("groove-trainer-v1").then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});
