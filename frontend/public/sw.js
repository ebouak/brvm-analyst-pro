/* Service Worker — WESTBOURSE
 * Rôle : UNIQUEMENT les Web Push notifications.
 *
 * ⚠️ AUCUN handler `fetch` : le SW n'intercepte plus RIEN (ni HTML, ni RSC,
 * ni chunks JS, ni images). Toute mise en cache de navigation par le SW a
 * causé des bundles périmés → chunks 404 → clics/navigations morts jusqu'au
 * hard-refresh (2026-07-09, deux itérations). Le CDN Vercel met déjà en cache
 * les assets `/_next/static/` avec des headers immuables ; le SW n'apportait
 * rien et cassait la navigation. On garde donc SEULEMENT le push.
 * NE JAMAIS rajouter d'écouteur `fetch` ici.
 */

const CACHE = 'brvm-v3';

// ─── Install : activation immédiate ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// ─── Activate : purge de TOUS les anciens caches (v1/v2 périmés) + claim ─────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── Message : permet au client de forcer l'activation d'un SW en attente ────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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
