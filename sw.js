// Служебный сценарий для проверки: сохраняет страницу в памяти устройства,
// чтобы она открывалась без сети.
const CACHE = 'audiogid-check-v2';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; // запросы к Википедии идут напрямую
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

