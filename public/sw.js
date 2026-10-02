/**
 * Service worker for the installed HighFi Player app.
 *
 * The player is entirely client-side and keeps its library in IndexedDB, so
 * once the shell is cached the app runs with the server unreachable - which is
 * the point of installing it: the Docker container does not have to be up.
 *
 * Bump CACHE_VERSION to retire every previously cached response.
 */
const CACHE_VERSION = 'v3';
const CACHE_NAME = `highfi-${CACHE_VERSION}`;
const APP_SHELL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // cache: 'reload' so a stale HTTP-cached shell is not adopted.
      await cache.add(new Request(APP_SHELL, { cache: 'reload' }));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

/** Cache-first: for build assets, whose filenames carry a content hash. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first with a cached fallback: for navigations. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(APP_SHELL, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(APP_SHELL);
    if (cached) return cached;
    throw new Error('Offline and no cached app shell available');
  }
}

/** Stale-while-revalidate: for icons, the manifest and anything else. */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached ?? (await network) ?? Promise.reject(new Error('Unavailable offline'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
