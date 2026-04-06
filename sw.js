// Quiniela Arcángel — Service Worker
const CACHE_NAME = "qa-admin-v1";
const ASSETS = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./img/logo-arcangel-quiniela.png"
];

// Install: pre-cache core assets
self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first, fall back to cache
self.addEventListener("fetch", function(e) {
  // Skip Supabase API calls — always network
  if (e.request.url.includes("supabase.co")) return;

  e.respondWith(
    fetch(e.request)
      .then(function(response) {
        // Cache fresh responses
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        return caches.match(e.request);
      })
  );
});

// Push notifications
self.addEventListener("push", function(e) {
  var data = e.data ? e.data.json() : {};
  var title = data.title || "Quiniela Arcángel";
  var options = {
    body:  data.body  || "Tienes una notificación pendiente",
    icon:  "./img/logo-arcangel-quiniela.png",
    badge: "./img/logo-arcangel-quiniela.png",
    vibrate: [200, 100, 200]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});
