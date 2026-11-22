/**
 * Logique PURE des indices en direct (brvm_indices_daily), pour les pages de
 * l'application hors landing. Même règles que `recomposer` pour les actions :
 * on n'écrase que la valeur et la variation, un null reçu n'efface rien, et un
 * indice absent de la base de départ est ignoré.
 */
import { flashDirection, type FlashDirection } from './mergeActions';

export interface IndiceDirect {
  code: string;
  valeur: number | null;
  variation_pct: number | null;
}

export function majIndice<T extends IndiceDirect>(
  base: readonly T[],
  recu: Partial<IndiceDirect> & { code: string },
): { indices: T[]; direction: FlashDirection; change: boolean } {
  const i = base.findIndex((x) => x.code === recu.code);
  if (i === -1) return { indices: base as T[], direction: 'none', change: false };
  const avant = base[i]!;
  const valeur = recu.valeur ?? avant.valeur;
  const variation = recu.variation_pct ?? avant.variation_pct;
  if (valeur === avant.valeur && variation === avant.variation_pct) {
    return { indices: base as T[], direction: 'none', change: false };
  }
  const suite = [...base];
  suite[i] = { ...avant, valeur, variation_pct: variation };
  return { indices: suite, direction: flashDirection(avant.valeur, valeur), change: true };
}
