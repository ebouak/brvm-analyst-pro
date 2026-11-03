'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Recalcule la Tour de contrôle (rendu serveur à nouveau, sans recharger la
 * page). Ne relance AUCUN traitement : il relit l'état présent.
 */
export function BoutonActualiser() {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <button
      type="button"
      onClick={() => demarrer(() => router.refresh())}
      disabled={enCours}
      aria-busy={enCours}
      className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-60"
    >
      {enCours ? 'Actualisation…' : '↻ Actualiser'}
    </button>
  );
}
