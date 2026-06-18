import type { DcfInputs, DcfResult } from './types';

/**
 * DCF FCFF : projection explicite sur `years` années au taux `growthRate`,
 * puis valeur terminale de Gordon au-delà, le tout actualisé au WACC.
 *
 * N'INVENTE RIEN :
 * - FCF de base ≤ 0 → pas de projection (une société à FCF négatif ne se
 *   valorise pas honnêtement par un DCF de croissance) → `error`, fairValue null ;
 * - WACC ≤ g∞ → la valeur terminale diverge → `error`, fairValue null ;
 * - actions ≤ 0 → `error`.
 * Aucune valeur de repli n'est fabriquée : le caller affiche « non calculable ».
 */
export function computeDcf(inputs: DcfInputs): DcfResult {
  const { baseFcf, growthRate, years, terminalGrowth, wacc, netDebt, shares } = inputs;

  const empty = (error: DcfResult['error']): DcfResult => ({
    projectedFcf: [],
    discountedFcf: [],
    terminalValue: 0,
    pvTerminal: 0,
    enterpriseValue: 0,
    equityValue: 0,
    fairValuePerShare: null,
    error,
  });

  if (!Number.isFinite(baseFcf) || baseFcf <= 0) return empty('fcf_non_positif');
  if (shares <= 0 || !Number.isFinite(shares)) return empty('shares_invalide');
  if (wacc <= terminalGrowth) return empty('wacc_le_terminal');

  const projectedFcf: number[] = [];
  const discountedFcf: number[] = [];
  let fcf = baseFcf;
  for (let t = 1; t <= years; t++) {
    fcf = fcf * (1 + growthRate);
    projectedFcf.push(fcf);
    discountedFcf.push(fcf / Math.pow(1 + wacc, t));
  }

  // Valeur terminale de Gordon sur le FCF de l'année N+1, actualisée à l'année N.
  const lastFcf = projectedFcf[projectedFcf.length - 1] ?? baseFcf;
  const terminalValue = (lastFcf * (1 + terminalGrowth)) / (wacc - terminalGrowth);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, years);

  const enterpriseValue = discountedFcf.reduce((a, b) => a + b, 0) + pvTerminal;
  const equityValue = enterpriseValue - netDebt;
  const fairValuePerShare = equityValue / shares;

  return {
    projectedFcf,
    discountedFcf,
    terminalValue,
    pvTerminal,
    enterpriseValue,
    equityValue,
    fairValuePerShare,
  };
}

/**
 * Matrice de sensibilité de la juste-valeur/action aux variations de WACC (lignes)
 * et de croissance terminale (colonnes). Garantit la transparence (anti-boîte noire).
 * Une cellule est `null` si la combinaison n'est pas calculable (WACC ≤ g∞).
 */
export function sensitivityMatrix(
  base: DcfInputs,
  waccDeltas: number[],
  terminalDeltas: number[],
): (number | null)[][] {
  return waccDeltas.map((dw) =>
    terminalDeltas.map((dg) => {
      const r = computeDcf({
        ...base,
        wacc: base.wacc + dw,
        terminalGrowth: base.terminalGrowth + dg,
      });
      return r.fairValuePerShare;
    }),
  );
}
