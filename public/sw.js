const CACHE_NAME = 'nutrisalud-shell-v1';
const BASE = self.registration.scope;
const SHELL = [
  BASE,
  BASE + 'manifest.webmanifest',
  BASE + 'app-icon.svg',
  BASE + 'logo-nutrisalud.png',
  BASE + 'portada-nutrisalud.png',
  BASE + 'nutriologo-gustavo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('nutrisalud-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && !url.search) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(BASE, copy));
        }
        return response;
      }).catch(async () => {
        if (url.search) return Response.error();
        return (await caches.match(BASE)) || Response.error();
      })
    );
    return;
  }

  if (!/\.(?:css|js|svg|png|webmanifest|woff2?)$/i.test(url.pathname)) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
