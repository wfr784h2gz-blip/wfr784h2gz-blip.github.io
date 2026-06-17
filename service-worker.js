const cacheName = 'hourly-tracker-v4';
const filesToCache = [
  './',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'icon.svg'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(filesToCache);
    })
  );
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== cacheName) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (evt) => {
  evt.respondWith(
    caches.match(evt.request).then((response) => {
      return (
        response ||
        fetch(evt.request).catch(() => {
          // If offline and request is for navigation, serve cached index.html
          if (evt.request.mode === 'navigate') {
            return caches.match('index.html');
          }
        })
      );
    })
  );
});