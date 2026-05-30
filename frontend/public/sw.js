/* Service Worker — BRVM Analyst Pro
 * Gère : cache offline (stale-while-revalidate) + Web Push notifications
 */

const CACHE = 'brvm-v1';
const PRECACHE = ['/', '/manifest.json', '/icon.svg'];

// ─── Install : précache des ressources essentielles ───────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate : nettoyage des anciens caches ──────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch : stale-while-revalidate pour ressources same-origin ───────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorer les méthodes non-GET et les appels API
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/static/')) {
    // Cache-first pour assets statiques Next.js (hashed, immuables)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
          }
          return resp;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate pour pages HTML et autres ressources
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((resp) => {
            if (resp.ok) {
              const clone = resp.clone();
              caches.open(CACHE).then((c) => c.put(event.request, clone));
            }
            return resp;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});

// ─── Push : affichage de la notification ─────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'BRVM Analyst', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'BRVM Analyst Pro', {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag || 'brvm-notif',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

// ─── Notification click : ouverture de l'URL cible ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const target = event.notification.data.url || '/';
        // Réutiliser un onglet existant si possible
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return clients.openWindow(target);
      })
  );
});
