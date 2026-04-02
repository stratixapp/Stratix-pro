/**
 * STRATIX Service Worker v1.0
 * Offline-first caching — app works with no internet after first load
 */
const CACHE = 'stratix-v9';
const CORE  = [
  '/', '/index.html', '/login.html',
  '/style.css', '/style_patch.css',
  '/auth.js', '/store.js', '/components.js',
  '/upgrades.js', '/analytics.js', '/stratix_ai.js',
  '/features.js', '/logistics.js', '/erp.js',
  '/vertical.js', '/v_transport.js', '/v_retail.js',
  '/v_services.js', '/new_features.js', '/app.js',
  '/onboarding.js', '/finance_deep.js', '/v_factory_deep.js',
  '/interconnect.js', '/polish.js',
  '/firebase_config.js',
  '/manifest.json', '/favicon.svg', '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for Firebase API calls — always fresh auth
  if (e.request.url.includes('firebaseapp.com') ||
      e.request.url.includes('googleapis.com') ||
      e.request.url.includes('gstatic.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Cache-first for app files (offline works instantly)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => {
        // Fallback to index.html for navigation requests
        if (e.request.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});
