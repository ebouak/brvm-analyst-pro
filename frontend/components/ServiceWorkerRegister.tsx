'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;

    // Auto-récupération des onglets coincés sur un ANCIEN service worker :
    // si un SW contrôlait déjà la page (ex. brvm-v1 qui servait du HTML périmé
    // → navigations mortes), dès que le nouveau SW prend le contrôle
    // (clients.claim) on recharge UNE fois pour repartir sur du HTML + des
    // chunks à jour. Pas de rechargement au tout premier install (hadController
    // = false) ni de boucle (garde `refreshing`).
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[SW] Registration failed:', err);
    });
  }, []);

  return null;
}
