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

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
