/**
 * Bloc « Liquidité » (spec §4.3). PUR et testé.
 * Une valeur sans ligne `liquidity_daily`, ou dont la moyenne vaut 0 (défaut
 * de la migration 0111), est « non mesurée » — jamais 0.
 */
import { fmtNumber } from '@/lib/format';
import { LIQUIDITES_CODE } from '@/lib/portfolio/constantes';
import { dureeTheorique, type DureeEcoulement } from './liquidite';

export interface LiquiditeSource {
  code: string;
  score: number | null;
  classe: string | null;
  spread_pct: number | null;
  spread_source: string | null;
  valeur_moyenne_30j: number | null;
}

export type Classe = 'A' | 'B' | 'C' | 'D';

export interface LigneLiquidite {
  code: string;
  valeurPosition: number | null;
  classe: Classe | null;
  fourchette: string | null;
  valeurMoyenne30j: number | null;
  duree: DureeEcoulement;
  mesuree: boolean;
}

const fini = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
const estClasse = (c: string | null): c is Classe => c === 'A' || c === 'B' || c === 'C' || c === 'D';

/** « 0,01 % » (carnet officiel) ou « ≈ 1,50 % » (estimation de Roll). */
export function fourchetteTexte(spreadPct: number | null, source: string | null): string | null {
  if (!fini(spreadPct) || spreadPct < 0) return null;
  return `${source === 'roll' ? '≈ ' : ''}${fmtNumber(spreadPct, 2)} %`;
}

export function lignesLiquiditePositions(
  positions: { code: string; valeur: number | null }[],
  liq: LiquiditeSource[],
): LigneLiquidite[] {
  const parCode = new Map(liq.map((r) => [r.code.trim().toUpperCase(), r]));
  return positions
    .filter((p) => p.code.trim().toUpperCase() !== LIQUIDITES_CODE)
    .map((p) => {
      const code = p.code.trim().toUpperCase();
      const r = parCode.get(code);
      const moyenne = r && fini(r.valeur_moyenne_30j) && r.valeur_moyenne_30j > 0 ? r.valeur_moyenne_30j : null;
      const valeur = fini(p.valeur) ? p.valeur : null;
      return {
        code,
        valeurPosition: valeur,
        classe: r && estClasse(r.classe?.trim().toUpperCase() ?? null) ? (r.classe!.trim().toUpperCase() as Classe) : null,
        fourchette: r ? fourchetteTexte(r.spread_pct, r.spread_source) : null,
        valeurMoyenne30j: moyenne,
        duree: dureeTheorique(valeur, moyenne),
        mesuree: r != null && moyenne != null,
      };
    })
    .sort((x, y) => Number(y.duree.alerte) - Number(x.duree.alerte) || (y.valeurPosition ?? 0) - (x.valeurPosition ?? 0));
}

/** Les n valeurs les plus faciles et les n plus difficiles à échanger, sans recouvrement. */
export function extremesLiquidite(liq: LiquiditeSource[], n = 5): { faciles: LiquiditeSource[]; difficiles: LiquiditeSource[] } {
  const notees = liq.filter((r) => fini(r.score)).sort((x, y) => (y.score as number) - (x.score as number) || x.code.localeCompare(y.code));
  const faciles = notees.slice(0, n);
  const reste = notees.slice(faciles.length);
  const difficiles = reste.slice(-n).reverse();
  return { faciles, difficiles };
}
