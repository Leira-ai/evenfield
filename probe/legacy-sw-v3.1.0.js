// Evenfield service worker, release 3.0.0: cache the app shell and the
// last snapshot so the board still opens on a bad connection. The cache
// name is versioned per release; old caches are deleted on activate.
// Snapshot fetches prefer the network and fall back to the cache;
// everything else same-origin is cache-first for the shell. Only GETs
// are handled: wallet and POST responses are never cached. Kill switch:
// post {type: 'EVENFIELD_CLEAR_CACHES'} from the page (or ship a new SW)
// to clear every cache and unregister.
const CACHE = 'evenfield-v3.1.0';
const SHELL = ['./', './index.html', './snapshot.json', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'EVENFIELD_CLEAR_CACHES') {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister()),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.endsWith('/snapshot.json')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit ?? fetch(event.request)),
    );
  }
});
