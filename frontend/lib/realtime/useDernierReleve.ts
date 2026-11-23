'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Releve } from './rejeu';
import { comparerDerniersReleves, type ComparaisonReleves } from './dernierReleve';
import { useReleve } from './useReleve';

/**
 * Ce qu'a apporté le dernier relevé, relu en base à chaque nouveau relevé
 * (l'heure vient de useReleve, alimenté par les cours en direct). Pendant la
 * séance seulement (`actif`).
 *
 * 150 lignes : les trois derniers relevés (48 valeurs chacun) — assez pour en
 * comparer deux complets, sans pagination. Le relevé est écrit en base une
 * fraction de seconde APRÈS la ligne de cours qui a déclenché l'événement :
 * on attend 4 s, puis une seconde fois si la base n'a pas encore rattrapé.
 */
const LIGNES = 150;

export function useDernierReleve(actif: boolean): ComparaisonReleves | null {
  const { releve } = useReleve();
  const [donnees, setDonnees] = useState<ComparaisonReleves | null>(null);

  useEffect(() => {
    if (!actif) return;
    let annule = false;
    let relance: ReturnType<typeof setTimeout> | undefined;
    const charger = async (tentative: number) => {
      const jour = new Date().toISOString().slice(0, 10);
      const { data, error } = await createClient()
        .from('brvm_intraday_snapshots')
        .select('code, captured_at, close, volume')
        .eq('date_marche', jour)
        .order('captured_at', { ascending: false })
        .limit(LIGNES);
      if (annule || error || !data) return;
      const c = comparerDerniersReleves(data as Releve[]);
      setDonnees(c);
      // La base n'a pas encore le relevé annoncé : une seule nouvelle tentative.
      if (tentative === 0 && releve != null && c != null && Date.parse(c.instant) < releve - 60_000) {
        relance = setTimeout(() => void charger(1), 15_000);
      }
    };
    const t = setTimeout(() => void charger(0), releve != null ? 4_000 : 0);
    return () => { annule = true; clearTimeout(t); clearTimeout(relance); };
  }, [actif, releve]);

  return actif ? donnees : null;
}
