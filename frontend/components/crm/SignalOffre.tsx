'use client';
import { useEffect } from 'react';

/**
 * Envoie la balise une fois la page réellement affichée (un préchargement ne monte pas ce composant).
 * Offre (/pricing…) ou formation (/formations/academy…) : le serveur dérive le type de la page et
 * n'enregistre rien pour un visiteur anonyme.
 */
export default function SignalOffre({ page }: { page: string }) {
  useEffect(() => {
    void fetch('/api/crm/signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page }),
      keepalive: true,
    }).catch(() => {});
  }, [page]);
  return null;
}
