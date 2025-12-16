const cacheName = 'checklist-cache-v1';
const filesToCache = ['./index.html','./app.js','./manifest.json','./icon.png'];

self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(filesToCache)));
});

self.addEventListener('fetch', function(event) {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
