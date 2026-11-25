const V = 'sakeenah-v1.0.0';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'content.json', 'quran.json', 'themes.json',
  'amiri_regular.ttf', 'amiri_bold.ttf', 'amiri_quran.ttf',
  'logo.png', 'icon-192.png', 'icon-512.png', 'favicon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() => caches.match('index.html'))));
});
