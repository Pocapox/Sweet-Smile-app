// sw.js - Service Worker for Offline Mode & Asset Caching
const CACHE_NAME = "sweet-smile-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./catalog.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/store.js",
  "./js/models.js",
  "./js/costing.js",
  "./js/ocr-ai.js",
  "./js/pdf-export.js",
  "./js/qr-generator.js",
  "./js/notifications.js",
  "./js/views/dashboardView.js",
  "./js/views/posView.js",
  "./js/views/recipesView.js",
  "./js/views/inventoryView.js",
  "./js/views/chefAIView.js",
  "./js/views/catalogShareView.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback offline response
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
