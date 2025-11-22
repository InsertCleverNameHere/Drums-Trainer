// =======================================================
// 🎧 Random Groove Trainer — Service Worker
// -------------------------------------------------------
// Handles offline caching, versioned updates via commits.json,
// and smooth user experience between updates.
// The cache version is synced with commits.json to ensure users
// always get the latest release while preserving offline functionality.
// =======================================================

// Current cache version (updated dynamically by commits.json)
// The version will be injected here by the build script
let CACHE_VERSION = "v8.0.0";
let CACHE_NAME = `groove-trainer-${CACHE_VERSION}`;

// Files to precache at install time for offline availability
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./favicon.ico",
  "./commits.json",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/main.js",
  "./js/utils.js",
  "./js/visuals.js",
  "./js/metronomeCore.js",
  "./js/sessionEngine.js",
  "./js/uiController.js",
  "./js/simpleMetronome.js",
  "./js/simpleMetronomeCore.js",
  "./libs/css/nouislider.min.css",
  "./libs/js/nouislider.min.js",
  "./libs/js/gsap.min.js",
];

// =======================================================
// 🔁 VERSIONING HANDLER — triggered by main.js
// When the app detects a new commits.json version, it sends
// a message here, prompting a full cache rebuild.
// =======================================================
self.addEventListener("message", (event) => {
  if (event.data?.type === "VERSION_INFO") {
    const newVersion = event.data.version;
    if (newVersion && newVersion !== CACHE_VERSION) {
      CACHE_VERSION = newVersion;
      CACHE_NAME = `groove-trainer-${CACHE_VERSION}`;
      rebuildCache();
    }
  }
});

// =======================================================
// ♻️ rebuildCache()
// Opens a new versioned cache, stores required files,
// deletes outdated caches, and notifies open clients.
// =======================================================
async function rebuildCache() {
  // Recreate cache with all required static files for offline mode
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(FILES_TO_CACHE);

  // Remove old caches that don’t match the active version
  const cacheKeys = await caches.keys();
  await Promise.all(
    cacheKeys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
  );

  // Notify open windows (so the app can refresh UI if needed)
  const clientsArr = await self.clients.matchAll({ type: "window" });
  clientsArr.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
}

// =======================================================
// ⚙️ INSTALL EVENT
// Runs once on initial install or when SW changes.
// Pre-caches essential app files so offline mode works.
// Skip waiting to immediately activate the new service worker
// =======================================================
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(FILES_TO_CACHE)));
  self.skipWaiting(); // Activate immediately without waiting for old SW
});

// =======================================================
// 🚀 ACTIVATE EVENT
// Cleans up outdated caches and claims open pages immediately.
// =======================================================
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

// =======================================================
// 🌍 FETCH EVENT — main request handler
// - Special case for commits.json (updates quietly in background)
// - Cache-first strategy for everything else
// =======================================================
self.addEventListener("fetch", (event) => {
  const reqUrl = event.request.url;

  // =======================================================
  // === 🧠 Special Handling for commits.json ===
  // Always try to serve cached version first, but update in the background
  // so version info stays fresh without breaking offline availability.
  // =======================================================
  if (reqUrl.includes("commits.json")) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Background update: refresh commits.json quietly
          fetch(event.request)
            .then((networkResponse) =>
              caches
                .open(CACHE_NAME)
                .then((cache) =>
                  cache.put(event.request, networkResponse.clone())
                )
            )
            .catch(() => {});
          return cachedResponse;
        }

        // Not cached yet: fetch fresh, then cache for next time
        return fetch(event.request)
          .then((networkResponse) =>
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            })
          )
          .catch(() => caches.match("./commits.json")); // Fallback if even that fails
      })
    );
    return;
  }

  // =======================================================
  // === 🌐 Default Cache Strategy ===
  // For all other requests, use cache-first strategy with network fallback.
  // Ensures smooth offline use and quick load times.
  // =======================================================

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve cached file if available (offline fast path)
        return cachedResponse;
      }

      // Otherwise fetch from network and cache result
      return fetch(event.request)
        .then((networkResponse) =>
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          })
        )
        .catch(() => {
          // As a last resort, serve index.html for navigation requests
          if (event.request.destination === "document") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
