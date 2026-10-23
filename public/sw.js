// Keeps the app opening instantly and offline. Household data itself syncs
// through Supabase and is cached by the app, so it is never stored here.
const CACHE = 'household-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icons/apple-touch-icon.png', './icons/icon-192.png'];
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const put = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Pages: always try the network first so updates arrive straight away.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => put('./index.html', res)).catch(() => caches.match('./index.html')));
    return;
  }
  // App files (hashed, so they never change) and fonts: cache first, then network.
  if (sameOrigin || FONTS.test(req.url)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
  }
  // Everything else (Supabase) goes straight to the network.
});
