'use client';

import { useEffect, useRef, useState } from 'react';
import type { FlashDirection } from './mergeActions';

/**
 * Éclairs de ligne ÉTALÉS dans le temps, du haut vers le bas du tableau.
 *
 * Pourquoi (2026-11-23) : à chaque relevé, 20 à 30 lignes s'éclairaient dans
 * la même demi-seconde — l'œil ne voit qu'un clignotement global. Étalés sur
 * moins de 2 s (verdict Fable), ils se lisent comme une vague qui parcourt la
 * cote. La donnée ne change pas : seul l'instant de l'éclair est décalé.
 *
 * `ordre` : codes dans l'ordre d'affichage. Sous prefers-reduced-motion, les
 * éclairs sont déjà coupés en CSS ; l'étalement n'y change rien.
 */
const DUREE_ECLAIR_MS = 650;

export function useFlashesEtales(
  flashes: Record<string, FlashDirection>,
  ordre: readonly string[],
  pasMs = 40,
  maxMs = 1_800,
): Record<string, FlashDirection> {
  const [etales, setEtales] = useState<Record<string, FlashDirection>>({});
  const vus = useRef<Record<string, FlashDirection>>({});
  const ordreCourant = useRef(ordre);
  const minuteurs = useRef(new Set<ReturnType<typeof setTimeout>>());

  // Avant l'effet qui le lit : les effets s'exécutent dans l'ordre déclaré.
  useEffect(() => { ordreCourant.current = ordre; });

  useEffect(() => {
    const index = new Map(ordreCourant.current.map((c, i) => [c, i]));
    for (const [code, dir] of Object.entries(flashes)) {
      if (dir === 'none' || vus.current[code] === dir) continue;
      const delai = Math.min((index.get(code) ?? 0) * pasMs, maxMs);
      const debut = setTimeout(() => {
        minuteurs.current.delete(debut);
        setEtales((e) => ({ ...e, [code]: dir }));
      }, delai);
      const fin = setTimeout(() => {
        minuteurs.current.delete(fin);
        setEtales((e) => { const n = { ...e }; delete n[code]; return n; });
      }, delai + DUREE_ECLAIR_MS);
      minuteurs.current.add(debut);
      minuteurs.current.add(fin);
    }
    vus.current = { ...flashes };
  }, [flashes, pasMs, maxMs]);

  useEffect(() => {
    const m = minuteurs.current;
    return () => { m.forEach(clearTimeout); m.clear(); };
  }, []);

  return etales;
}
