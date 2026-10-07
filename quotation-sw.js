// Service worker for the quotation system app. Its scope is the site root, which also contains OPS
// (/yute-quotation/ops/): every request under ops/ is passed through untouched so OPS (which has its own
// service worker with the narrower /ops/ scope) is never affected. Same strategy as ops/sw.js: same-origin
// files network-first and always revalidated, the cache only as the offline fallback; versioned third-party
// libraries cache-first; Google login, Drive and Firebase never touched.
const SW_VERSION = '2026-10-07.2';
const CACHE = 'quotation-shell-' + SW_VERSION;
const SHELL = [
  './',
  'index.html',
  'quotation.webmanifest',
  'quotation/styles/quotation.css', 'quotation/styles/mobile.css',
  'quotation/js/boot.js', 'quotation/js/defaultitems.js', 'quotation/js/items.js', 'quotation/js/quote.js',
  'quotation/js/output.js', 'quotation/js/app.js', 'quotation/js/pwa.js', 'quotation/js/mobile.js', 'quotation/js/shell.js',
  'quotation/icons/icon-192.png', 'quotation/icons/icon-512.png', 'quotation/icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(SHELL.map(url => cache.add(new Request(url, { cache: 'no-cache' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('quotation-shell-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const SCOPE_PATH = new URL(self.registration.scope).pathname;

function isOps(url) {
  return url.pathname.startsWith(SCOPE_PATH + 'ops/');
}

function isImmutableThirdParty(url) {
  return (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/10.12.0/'))
    || (url.hostname === 'cdnjs.cloudflare.com' && url.pathname.startsWith('/ajax/libs/xlsx/0.18.5/'))
    || url.hostname === 'fonts.googleapis.com'
    || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (isOps(url) || !url.pathname.startsWith(SCOPE_PATH)) return;
    event.respondWith(
      fetch(new Request(req, { cache: 'no-cache' }))
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
    );
    return;
  }
  if (isImmutableThirdParty(url)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
