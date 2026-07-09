/* Service Worker — WESTBOURSE
 * Rôle : Web Push notifications + cache des seuls assets immuables.
 *
 * ⚠️ NE JAMAIS remettre de cache sur le HTML ou les payloads RSC (?_rsc=) :
 * l'ancien stale-while-revalidate servait des pages d'un ANCIEN déploiement
 * → chunks JS 404, hydration cassée, clics morts jusqu'au hard-refresh.
 * (Bug corrigé 2026-07-09 — bump du nom de cache pour purger les clients.)
 */

const CACHE = 'brvm-v2';

// ─── Install : activation immédiate (pas de précache HTML) ───────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// ─── Activate : purge des anciens caches (dont brvm-v1 périmé) ───────────────
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

// ─── Fetch : cache-first UNIQUEMENT pour /_next/static/ (fichiers hashés,
// immuables par construction). Tout le reste (HTML, RSC, images, API) passe
// directement au réseau — le CDN Vercel gère déjà leur cache correctement. ───
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/_next/static/')) return;

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
});

// ─── Push : affichage de la notification ─────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'WESTBOURSE', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'WESTBOURSE', {
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
