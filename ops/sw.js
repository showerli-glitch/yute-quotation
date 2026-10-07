// Service worker for the OPS PWA (phase 1: "installable, opens offline, never serves a stale mix").
// It does NOT queue writes and never touches the Firebase data path; saving still needs a connection.
//
// Strategy
//  - Same-origin files (index.html, js, css, icons): network first, always revalidated (cache: 'no-cache'),
//    so a new deployment is picked up on the next load and old HTML never pairs with old scripts.
//    The cache is only the offline fallback.
//  - Versioned third-party files (Firebase SDK 10.12.0 on gstatic, Google Fonts): cache first, they never change
//    for a given URL.
//  - Everything else (Google login, userinfo, Firebase Realtime Database, any POST): passed through untouched.
const SW_VERSION = '2026-10-07.1';
const CACHE = 'ops-shell-' + SW_VERSION;
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/mobile.css',
  'styles/invoicerequest.css',
  'styles/receipts.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'js/core/types.js', 'js/core/config.js', 'js/core/data.js', 'js/core/accounting.js', 'js/core/ui.js',
  'js/modules/payables.js', 'js/modules/receivables.js', 'js/modules/profit.js', 'js/modules/expenses.js',
  'js/modules/cases.js', 'js/modules/clients.js', 'js/modules/vendors.js', 'js/modules/attendance.js',
  'js/modules/payreq.js', 'js/modules/feedback.js', 'js/modules/systemnotes.js', 'js/modules/employees.js',
  'js/modules/payroll.js', 'js/modules/overhead.js', 'js/modules/tax.js', 'js/modules/profitshare.js',
  'js/modules/invoicerequest.js',
  'js/modules/receipts.js',
  'js/modules/mobile.js',
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
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ops-shell-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isImmutableThirdParty(url) {
  return (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/10.12.0/'))
    || url.hostname === 'fonts.googleapis.com'
    || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
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
