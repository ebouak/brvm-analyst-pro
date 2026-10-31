'use client';
import { useEffect } from 'react';
import type { PageOffre } from '@/lib/crm/signal';

/** Envoie la balise une fois la page réellement affichée (un préchargement ne monte pas ce composant). */
export default function SignalOffre({ page }: { page: PageOffre }) {
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
