/* 오프라인 캐시 (PWA) */
const CACHE = 'neon-holdem-v1';
const ASSETS = ['./', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg',
  './js/utils.js', './js/cards.js', './js/evaluator.js', './js/perf.js', './js/audio.js', './js/fx.js', './js/ai.js', './js/engine.js',
  './js/tournament.js', './js/profile.js', './js/missions.js', './js/ui.js', './js/main.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
