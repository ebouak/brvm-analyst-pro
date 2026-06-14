/**
 * Comparateur multi-actifs (rendement vs risque) — fonctions pures et testables.
 *
 * Place sur un plan risque/rendement les grandes classes d'actifs BRVM :
 * actions (marché), obligations (YTM), revenu dividende, et taux sans-risque.
 */

export type AssetKind = 'marche' | 'obligation' | 'dividende' | 'sans_risque';

export interface AssetClassPoint {
  label: string;
  kind: AssetKind;
  ret: number | null;   // rendement annualisé attendu
  vol: number | null;   // volatilité annualisée (null = non estimée)
  sharpe: number | null; // (ret − rf) / vol
  note?: string;
}

const PERIODS_PER_YEAR = 252;

/** Rendement et volatilité annualisés à partir de rendements quotidiens. */
export function annualizedReturnVol(daily: number[]): { ret: number; vol: number } {
  if (daily.length < 2) return { ret: 0, vol: 0 };
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const variance = daily.reduce((s, r) => s + (r - mean) ** 2, 0) / (daily.length - 1);
  return { ret: mean * PERIODS_PER_YEAR, vol: Math.sqrt(variance) * Math.sqrt(PERIODS_PER_YEAR) };
}

/** Rendements période à période d'une série de niveaux. */
export function toReturns(levels: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < levels.length; i++) r.push(levels[i - 1] !== 0 ? (levels[i]! - levels[i - 1]!) / levels[i - 1]! : 0);
  return r;
}

function sharpe(ret: number | null, vol: number | null, rf: number): number | null {
  if (ret == null || vol == null || vol <= 0) return null;
  return (ret - rf) / vol;
}

export interface ComparisonInputs {
  marketReturns: number[];      // rendements quotidiens de l'indice (BRVM-C)
  obligationYtm: number | null; // YTM moyen des obligations cotées
  obligationVol: number | null; // volatilité estimée des obligations (ou null)
  dividendYield: number | null; // rendement dividende moyen (top)
  riskFreeRate: number;         // ex. 0.06
}

export function buildComparison(inp: ComparisonInputs): AssetClassPoint[] {
  const market = annualizedReturnVol(inp.marketReturns);
  const points: AssetClassPoint[] = [];

  points.push({
    label: 'Actions (BRVM-C)', kind: 'marche',
    ret: market.ret, vol: market.vol, sharpe: sharpe(market.ret, market.vol, inp.riskFreeRate),
    note: 'Indice composite — rendement et risque historiques.',
  });

  if (inp.dividendYield != null) {
    // Le revenu dividende porte le risque actions (volatilité de marché).
    points.push({
      label: 'Revenu dividende', kind: 'dividende',
      ret: inp.dividendYield, vol: market.vol, sharpe: sharpe(inp.dividendYield, market.vol, inp.riskFreeRate),
      note: 'Rendement dividende moyen ; volatilité = celle des actions.',
    });
  }

  if (inp.obligationYtm != null) {
    points.push({
      label: 'Obligations (YTM)', kind: 'obligation',
      ret: inp.obligationYtm, vol: inp.obligationVol, sharpe: sharpe(inp.obligationYtm, inp.obligationVol, inp.riskFreeRate),
      note: inp.obligationVol == null ? 'Revenu fixe — volatilité faible, non estimée ici.' : 'YTM moyen des obligations cotées.',
    });
  }

  points.push({
    label: 'Sans-risque (6%)', kind: 'sans_risque',
    ret: inp.riskFreeRate, vol: 0, sharpe: null,
    note: 'Obligations d\'État UEMOA — référence sans risque.',
  });

  return points;
}
