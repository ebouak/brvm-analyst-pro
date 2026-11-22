'use client';

import { useMemo } from 'react';
import { useCoursSeance } from '@/lib/realtime/useCoursSeance';
import { Cellule } from './Grille';
import Mouvements, { type LigneMouvement } from './Mouvements';

export interface CoursMouvement {
  code: string;
  designation: string | null;
  cours_jour: number | null;
  variation_pct: number | null;
}

/**
 * Plus fortes hausses et baisses de la séance, recalculées à chaque cours reçu
 * en direct. UN SEUL abonnement pour les deux blocs : deux abonnements à la
 * même séance pourraient se fermer l'un l'autre. Même règle de classement que
 * le rendu serveur : les valeurs sans variation connue sont écartées.
 */
export default function MouvementsSeance({ actions, sparklines, dateMarche }: {
  actions: CoursMouvement[];
  sparklines: Record<string, number[]>;
  dateMarche: string | null;
}) {
  const base = useMemo(() => actions, [actions]);
  const { rows, flashes } = useCoursSeance(base, dateMarche);

  const { hausses, baisses } = useMemo(() => {
    const versLigne = (a: CoursMouvement): LigneMouvement => ({
      code: a.code,
      nom: a.designation?.trim() || a.code,
      cours: a.cours_jour,
      variation: a.variation_pct,
      serie: sparklines[a.code] ?? [],
    });
    const avecVar = rows.filter((a) => a.variation_pct != null);
    return {
      hausses: [...avecVar].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)).slice(0, 5).map(versLigne),
      baisses: [...avecVar].sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0)).slice(0, 5).map(versLigne),
    };
  }, [rows, sparklines]);

  return (
    <>
      <Cellule span={4}><Mouvements id="t-hausses" titre="Plus fortes hausses" lignes={hausses} flashes={flashes} /></Cellule>
      <Cellule span={4}><Mouvements id="t-baisses" titre="Plus fortes baisses" lignes={baisses} flashes={flashes} /></Cellule>
    </>
  );
}
