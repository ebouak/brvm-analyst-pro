// COPIE GÉNÉRÉE de scraper/src/prudentiel/montants.ts par frontend/scripts/copier-agregats-purs.mjs — ne pas modifier ici.
/**
 * Rapprochement de montants publiés — PUR. Même règle que rapprochement.ts
 * pour les pourcentages, transposée aux montants : deux valeurs concordent si
 * leur écart tient dans la demi-somme de leurs granularités imprimées (unité
 * de l'en-tête × dernière décimale). Une paire incompatible suffit à déclarer
 * le conflit : une valeur grossière ne réconcilie jamais deux valeurs précises.
 * Deux montants de devises différentes (USD, FCFA) sont toujours en conflit :
 * on ne convertit jamais (avenant du 2026-11-15).
 *
 * ⚠️ Copié dans frontend/lib/agregats/pure/ (scripts/copier-agregats-purs.mjs,
 * vérifié par copie.test.ts) : corriger ICI, puis relancer le script.
 */
import { granularite, type UniteSource } from '../agregats/nombres';

export interface ObsMontant {
  id: string;
  valeur: number;
  /** Devise stockée (fcfa, usd) ; absente = fcfa. */
  unite?: string | null;
  unite_source: UniteSource | null;
  decimales: number | null;
}

export interface RapprochementMontants {
  classe: 'unique' | 'rounding_compatible' | 'source_conflict';
  retenue: string | null;
  conflits: [string, string][];
}

const devise = (o: ObsMontant) => o.unite ?? 'fcfa';

export function rapprocherMontants(obs: ObsMontant[]): RapprochementMontants {
  if (obs.length === 1) return { classe: 'unique', retenue: obs[0]!.id, conflits: [] };
  const conflits: [string, string][] = [];
  for (let i = 0; i < obs.length; i++) {
    for (let j = i + 1; j < obs.length; j++) {
      const a = obs[i]!, b = obs[j]!;
      const tolerance = (granularite(a) + granularite(b)) / 2 + 1; // +1 : marge de virgule flottante
      if (devise(a) !== devise(b) || Math.abs(a.valeur - b.valeur) > tolerance) conflits.push([a.id, b.id]);
    }
  }
  if (conflits.length) return { classe: 'source_conflict', retenue: null, conflits };
  const plusFine = [...obs].sort((a, b) => granularite(a) - granularite(b))[0]!;
  const toutesEgales = obs.every((o) => o.valeur === obs[0]!.valeur && granularite(o) === granularite(obs[0]!));
  return { classe: toutesEgales ? 'unique' : 'rounding_compatible', retenue: plusFine.id, conflits: [] };
}
