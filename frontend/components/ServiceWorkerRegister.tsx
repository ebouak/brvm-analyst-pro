'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;

    // Auto-récupération des onglets coincés sur un ANCIEN service worker.
    // On ne recharge QUE si un SW contrôlait déjà la page (hadController) : c'est
    // le cas « stuck » (v1/v2 sert un bundle périmé → navigations mortes). Dès
    // que le nouveau SW prend le contrôle, on recharge UNE fois pour repartir
    // propre. Pas de reload au tout premier install (hadController = false) ni
    // de boucle (garde `refreshing`).
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Un nouveau SW est déjà installé et attend (ancien SW encore actif) :
        // on le force à prendre la main immédiatement → déclenche
        // controllerchange → reload → onglet débloqué sans action utilisateur.
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => {
        console.error('[SW] Registration failed:', err);
      });
  }, []);

  return null;
}
