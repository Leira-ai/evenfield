// Evenfield service worker. TEMPLATE: scripts/prerender.mjs stamps the
// per-build cache name and shell list into dist/sw.js at build time, so
// EVERY deploy (including the 6-hour CI snapshot deploys) ships a new
// worker version. The placeholders below are the dev fallback only.
//
// Why this rewrite (2026-11-17, the unstyled-page incident): the old
// worker served index.html cache-first FOREVER, never revalidated,
// while every deploy force-pushes a fresh gh-pages tree that deletes
// the previous build's hashed assets. A returning visitor was pinned
// to a stale HTML whose CSS/JS had been deleted from the server: the
// CSS 404 made the browser paint the prerendered page with no styles
// at all, and the JS 404 meant the app never booted. That state could
// never heal, because the worker kept serving the same cached HTML.
// Rules now:
// - Navigations are NETWORK-FIRST. The cached shell is an offline
//   fallback only, refreshed on every successful navigation.
// - Hashed /assets/ files are cache-first with runtime fill (they are
//   immutable per build; a fresh navigation always brings the HTML
//   that matches the assets on the server).
// - snapshot.json stays network-first with a cache fallback, and is no
//   longer precached (307 KB is a hostile install payload on a slow
//   connection).
// - On activation, caches from older workers are deleted. If a LEGACY
//   pre-fix cache (evenfield-v*) is among them, open windows are
//   navigated once to their own URL: that is the heal for users stuck
//   on the broken shell. Routine build-to-build upgrades do NOT force
//   a reload; network-first navigation heals them on the next load.
// - Only GETs are handled: wallet and POST responses are never cached.
// Kill switch: post {type: 'EVENFIELD_CLEAR_CACHES'} from the page (or
// ship a new SW) to clear every cache and unregister.
const CACHE = '__EVENFIELD_CACHE__';
const SHELL = __EVENFIELD_SHELL__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const old = keys.filter((k) => k !== CACHE);
    const hadLegacy = old.some((k) => k.startsWith('evenfield-v'));
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    if (hadLegacy) {
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windows.map((c) => c.navigate(c.url).catch(() => {})));
    }
  })());
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
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith('/snapshot.json')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(async () => (await caches.open(CACHE)).match(event.request)),
    );
    return;
  }

  if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (await cache.match(event.request)) ?? (await cache.match('./index.html'));
        }),
    );
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    })());
    return;
  }

  // Everything else same-origin (fonts, manifest, OG images):
  // stale-while-revalidate.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(event.request);
    const network = fetch(event.request)
      .then((res) => {
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
      .catch(() => null);
    return hit ?? (await network);
  })());
});
