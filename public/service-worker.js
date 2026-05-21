
const CACHE_NAME = "loto7-labo-v2";

const urlsToCache = [
  "/",
  "/manifest.json",
  "/bg.jpg",
  "/icon-192.png",
  "/icon-512.png"
];

// インストール
self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })

  );

});

// キャッシュ優先
self.addEventListener("fetch", event => {

  event.respondWith(

    caches.match(event.request)
      .then(response => {

        return response || fetch(event.request);

      })

  );

});