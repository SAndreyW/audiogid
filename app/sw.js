// Аудиогид: служебный сценарий. Хранит файлы приложения в памяти устройства,
// чтобы оно открывалось без сети; новые версии подхватываются при следующем открытии.
const CACHE = 'audiogid-app-v1';
const FILES = ['./', 'index.html', 'styles.css', 'speech.js', 'wiki.js', 'store.js', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return; // запросы к Википедии идут напрямую
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      const network = fetch(event.request).then((r) => { if (r && r.ok) cache.put(event.request, r.clone()); return r; }).catch(() => cached);
      return cached || network;
    })
  );
});
