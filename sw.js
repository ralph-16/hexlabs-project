/*
 * SIKAD — offline app shell. Network first, so a new deploy always wins when online;
 * the cached copy is only used when the network is unavailable.
 */
const CACHE = 'sikad-shell-v2';
const SHELL = ['./', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icons/sikad.svg',
  'js/time.js', 'js/data.js', 'js/parser.js', 'js/engine.js', 'js/store.js', 'js/focus.js', 'js/assistant.js', 'js/motion.js', 'js/app.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
