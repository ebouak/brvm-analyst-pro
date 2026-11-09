import { computeLiquidityV2, type LiquidityClass, type LiquiditySessionRow30 } from '../liquidity/compute.js';
import type { Serie } from './types.js';

export const FENETRE_LIQUIDITE = 30;

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
      valeur_echangee: s.valeurs[i]!,
    });
  }
  return computeLiquidityV2(rows, fenetre.length).classe;
}
