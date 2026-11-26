// Méli-Méninges : petit service d'installation.
// Toujours la version la plus récente du site (réseau d'abord) ; la dernière page vue reste disponible hors connexion.
const CACHE = 'mm-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate') return;
  e.respondWith(fetch(r).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(r, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
