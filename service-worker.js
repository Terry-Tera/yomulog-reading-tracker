const cacheName = 'yomulog-v2';
const files = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(files))));
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))
  )).then(() => self.clients.claim())
));
self.addEventListener('fetch', (event) => event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))));
