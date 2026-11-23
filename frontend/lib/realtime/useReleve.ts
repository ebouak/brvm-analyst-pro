'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Heure du dernier relevé, partagée par la page — source UNIQUE de la pastille
 * de fraîcheur et du point « En direct » (avant le 2026-11-23, chacun avait la
 * sienne et ils se contredisaient sur la fiche action).
 *
 * Alimenté par `useCoursSeance` (qui seul reçoit les cours), lu par
 * `FreshnessBadge` et `EnDirect`. Aucun abonnement Realtime de plus.
 */
export interface InfoReleve {
  /** Heure du dernier relevé (ms), d'après `updated_at` des lignes reçues. */
  releve: number | null;
  /** Le marché a-t-il échangé aujourd'hui ? null : inconnu. */
  echanges: boolean | null;
}

const VIDE: InfoReleve = { releve: null, echanges: null };
let etat: InfoReleve = VIDE;
const abonnes = new Set<() => void>();

/** Un relevé plus ancien que celui connu est ignoré ; un `echanges` inconnu ne remplace pas un connu. */
export function publierReleve(releve: Date | null, echanges: boolean | null): void {
  const r = releve?.getTime() ?? null;
  const suivant: InfoReleve = {
    releve: r != null && (etat.releve == null || r > etat.releve) ? r : etat.releve,
    echanges: echanges ?? etat.echanges,
  };
  if (suivant.releve === etat.releve && suivant.echanges === etat.echanges) return;
  etat = suivant;
  abonnes.forEach((f) => f());
}

const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
};

export function useReleve(): InfoReleve {
  return useSyncExternalStore(abonner, () => etat, () => VIDE);
}

/** Heure courante, rafraîchie toutes les `pasMs` ; null au premier rendu (serveur compris : pas d'écart d'hydratation). */
export function useMaintenant(pasMs = 30_000): Date | null {
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  useEffect(() => {
    setMaintenant(new Date());
    const t = setInterval(() => setMaintenant(new Date()), pasMs);
    return () => clearInterval(t);
  }, [pasMs]);
  return maintenant;
}
