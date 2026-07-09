'use client';

import { useEffect } from 'react';

/**
 * DÉSACTIVATION COMPLÈTE du service worker.
 *
 * Le SW a causé de façon répétée des bundles périmés → chunks 404 → clics /
 * navigations morts jusqu'à un vidage de cache manuel. Son seul apport restant
 * (cache d'assets déjà couvert par le CDN Vercel, + push notifications non
 * critiques) ne justifie pas ce risque sur un produit de données marché.
 *
 * Ce composant ne réenregistre plus rien : il DÉSENREGISTRE tout SW existant et
 * purge tous les caches à chaque chargement. Résultat : n'importe quel
 * navigateur encore coincé sur un ancien SW se répare AUTOMATIQUEMENT, sans
 * aucune action de l'utilisateur, et le problème ne peut plus revenir.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        const hadServiceWorker = registrations.length > 0;

        // Désenregistre tout service worker existant (v1/v2/v3…).
        for (const registration of registrations) registration.unregister();

        // Purge tous les caches ouverts par les anciens SW.
        if ('caches' in window) {
          caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
        }

        // Si un SW contrôlait cette page (bundle potentiellement périmé), on
        // recharge UNE fois après l'avoir retiré → on repart sur du frais servi
        // directement par le CDN. Pas de boucle : au prochain chargement il n'y
        // a plus de registration → hadServiceWorker = false.
        if (hadServiceWorker && navigator.serviceWorker.controller) {
          window.location.reload();
        }
      })
      .catch(() => {
        /* API SW indisponible (navigation privée stricte) : rien à faire. */
      });
  }, []);

  return null;
}
