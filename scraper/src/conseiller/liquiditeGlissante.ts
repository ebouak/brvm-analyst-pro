import { computeLiquidityV2, type LiquidityClass, type LiquiditySessionRow30 } from '../liquidity/compute.js';
import type { Serie } from './types.js';

export const FENETRE_LIQUIDITE = 30;

/**
 * Plancher propre au banc. Le moteur de production surestime l'impact prix des
 * cours figés (variation nulle, donc Amihud à 0 = « parfait ») : une valeur
 * presque jamais échangée peut sortir en B. Pour le banc on impose donc : sous
 * 50 % de présence, la classe est D. Divergence ASSUMÉE par rapport au score de
 * production, qui n'est pas modifié.
 *
 * PAS de plancher sur l'activité (valeur échangée) : elle vaut 0 sous 2 M FCFA
 * par séance, seuil que franchissent rarement les petites capitalisations et
 * presque aucune valeur dans les années 2000 (montants nominaux plus faibles).
 * Ce critère aurait vidé l'échantillon historique sans viser les cours figés,
 * que la présence traite déjà. Décision prise avant toute mesure (PREREG).
 */
export const PLANCHER_LIQUIDITE = { presenceMinPct: 50 } as const;

/**
 * Classe de liquidité d'une valeur à `date`, calculée par le moteur officiel
 * (`liquidity/compute.ts`) sur les 30 séances du calendrier qui finissent à
 * `date`. Aucune donnée postérieure n'est lue (spec §4, cours figés).
 */
export function classeA(s: Serie, calendrier: string[], date: string): LiquidityClass | null {
  const fin = calendrier.indexOf(date);
  if (fin < FENETRE_LIQUIDITE - 1) return null;
  const fenetre = calendrier.slice(fin - FENETRE_LIQUIDITE + 1, fin + 1);
  const rows: LiquiditySessionRow30[] = [];
  for (const d of fenetre) {
    const i = s.pos.get(d);
    if (i == null) continue;
    rows.push({
      date_marche: d,
      cours_jour: s.cours[i]!,
      variation_pct: s.variations[i] ?? null,
      volume: s.volumes[i]!,
      valeur_echangee: s.valeurs[i]! > 0 ? s.valeurs[i]! : null,
    });
  }
  const r = computeLiquidityV2(rows, fenetre.length);
  if (r.classe && r.presence_pct < PLANCHER_LIQUIDITE.presenceMinPct) return 'D';
  return r.classe;
}
