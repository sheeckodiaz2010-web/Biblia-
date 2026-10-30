/* Biblia RVR1960 · Service Worker offline-first con migración segura */
const CACHE_NAME = 'biblia-rvr1960-2026-10-30-3';
const REQUIRED = ['./index.html', './manifest.webmanifest'];
const OPTIONAL = ['./biblia.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const absolute = path => new URL(path, self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // HTML y manifiesto son esenciales para abrir la aplicación.
    for (const path of REQUIRED) {
      const url = absolute(path);
      const response = await fetch(url, {cache: 'reload'});
      if (!response.ok) throw new Error('No se pudo precargar ' + path + ': HTTP ' + response.status);
      await cache.put(url, response);
    }
    // Intenta descargar el texto bíblico. Si falla, conserva el que ya existía
    // en una versión anterior para no dejar al usuario sin lectura offline.
    const bibleUrl = absolute('./biblia.json');
    let bibleSaved = false;
    try {
      const response = await fetch(bibleUrl, {cache: 'reload'});
      if (response.ok) { await cache.put(bibleUrl, response); bibleSaved = true; }
    } catch (_) {}
    if (!bibleSaved) {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key === CACHE_NAME) continue;
        try {
          const oldCache = await caches.open(key);
          const oldBible = await oldCache.match(bibleUrl);
          if (oldBible) { await cache.put(bibleUrl, oldBible); bibleSaved = true; break; }
        } catch (_) {}
      }
    }
    await Promise.all(OPTIONAL.filter(x => x !== './biblia.json').map(async path => {
      try {
        const url = absolute(path), response = await fetch(url, {cache: 'reload'});
        if (response.ok) await cache.put(url, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => (key.startsWith('biblia-rvr1960-') || key === 'biblia-v3') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Las comprobaciones de actualización consultan el servidor directamente.
  if (url.searchParams.has('v') || url.searchParams.has('u')) return;

  const biblePath = new URL('./biblia.json', self.registration.scope).pathname;
  if (url.pathname === biblePath || url.pathname.endsWith('/biblia.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(absolute('./biblia.json')) || await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(absolute('./biblia.json'), response.clone());
        return response;
      } catch (_) {
        return new Response('{"error":"La Biblia no está disponible sin conexión. Conéctate una vez y prepara la descarga desde Ajustes."}', {
          status: 503, headers: {'Content-Type':'application/json; charset=utf-8'}
        });
      }
    })());
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          await cache.put(absolute('./index.html'), response.clone());
        }
        return response;
      } catch (_) {
        return await cache.match(request) || await cache.match(absolute('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) { return Response.error(); }
  })());
});
