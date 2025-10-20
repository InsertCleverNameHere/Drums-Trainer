const CACHE_NAME = "groove-trainer-v1";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/main.js",
  "./js/metronomeCore.js",
  "./js/visuals.js",
  "./js/uiController.js",
  "./js/utils.js",
  "./js/sessionEngine.js",
  "./commits.json",
  "./favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/",
        "/index.html",
        "/manifest.json",
        "/css/styles.css",
        "/js/main.js",
        "/js/metronomeCore.js",
        "/js/visuals.js",
        "/js/uiController.js",
        "/js/utils.js",
        "/js/sessionEngine.js",
        "/commits.json",
        "/favicon.ico",
      ]);
    })
  );
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
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches
        .match("/index.html")
        .then((response) => {
          return response || fetch(event.request);
        })
        .catch(() => caches.match("/index.html"))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
