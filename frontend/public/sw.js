/* Service Worker — DÉSACTIVÉ (auto-destruction).
 *
 * Le SW a causé des bundles périmés → clics/navigations morts. On le retire
 * totalement. Cette version se désenregistre elle-même et purge tous les caches,
 * de sorte qu'un navigateur qui installerait encore ce fichier (vieille page en
 * cache appelant register('/sw.js')) se nettoie immédiatement. Combiné à
 * ServiceWorkerRegister (qui ne réenregistre plus rien), le SW disparaît partout.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if ('caches' in self) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      await self.registration.unregister();
      // Recharge les onglets contrôlés → repartent sans SW, sur du frais (CDN).
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        if ('navigate' in client) client.navigate(client.url);
      }
    })(),
  );
});

// Aucun handler fetch/push : le SW n'intercepte plus rien et va se supprimer.
