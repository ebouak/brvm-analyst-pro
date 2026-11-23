'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Largeur } from './releve';

/**
 * État du direct partagé par la page — source UNIQUE de la pastille de
 * fraîcheur, du point « En direct » et du bandeau « pouls de séance » (avant le
 * 2026-11-23, chacun avait sa propre heure et ils se contredisaient).
 *
 * Alimenté par les hooks qui reçoivent déjà les cours (`useCoursSeance`,
 * `useIndicesSeance`) : AUCUN abonnement Realtime de plus. Deux abonnements au
 * même sujet peuvent se fermer l'un l'autre (voir MouvementsSeance).
 */
export interface InfoSeance {
  /** Heure du dernier relevé (ms), d'après `updated_at` des lignes reçues. */
  releve: number | null;
  /** Le marché a-t-il échangé aujourd'hui ? null : inconnu. */
  echanges: boolean | null;
  /** Hausses / baisses / stables du marché, publiées par un hook qui voit toute la cote. */
  largeur: Largeur | null;
  /** BRVM Composite reçu en direct. */
  composite: { valeur: number; variation_pct: number | null } | null;
}

const VIDE: InfoSeance = { releve: null, echanges: null, largeur: null, composite: null };
let etat: InfoSeance = VIDE;
const abonnes = new Set<() => void>();

function remplacer(suivant: InfoSeance) {
  if (
    suivant.releve === etat.releve && suivant.echanges === etat.echanges
    && memeLargeur(suivant.largeur, etat.largeur)
    && suivant.composite?.valeur === etat.composite?.valeur && suivant.composite?.variation_pct === etat.composite?.variation_pct
  ) return;
  etat = suivant;
  abonnes.forEach((f) => f());
}

const memeLargeur = (a: Largeur | null, b: Largeur | null) =>
  a === b || (a != null && b != null && a.hausses === b.hausses && a.baisses === b.baisses && a.stables === b.stables);

/** Un relevé plus ancien que celui connu est ignoré ; une valeur inconnue (null) ne remplace pas une connue. */
export function publierReleve(releve: Date | null, echanges: boolean | null, largeur: Largeur | null = null): void {
  const r = releve?.getTime() ?? null;
  remplacer({
    ...etat,
    releve: r != null && (etat.releve == null || r > etat.releve) ? r : etat.releve,
    echanges: echanges ?? etat.echanges,
    largeur: largeur ?? etat.largeur,
  });
}

export function publierComposite(composite: { valeur: number; variation_pct: number | null } | null): void {
  if (!composite) return;
  remplacer({ ...etat, composite });
}

const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
};

export function useReleve(): InfoSeance {
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
