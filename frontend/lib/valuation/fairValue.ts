/**
 * Estimation de juste-valeur (deux méthodes honnêtes, hypothèses explicites).
 *
 *  - Multiples relatifs aux pairs : BPA × P/E médian secteur, VNC × P/B médian.
 *  - DDM Gordon-Shapiro pour valeurs à dividende régulier : V = D₁ / (r − g).
 *
 * Fonctions pures et testables.
 */

export interface PeerMultiples {
  medianPER: number | null;
  medianPBR: number | null;
}

export interface FairValueInputs {
  eps: number | null;
  bvps: number | null;
  price: number | null;
  peers: PeerMultiples;
  dividendPerShare: number | null;
  dividendGrowth?: number | null; // croissance historique du dividende
}

export interface FairValueResult {
  byPER: number | null;
  byPBR: number | null;
  byDDM: number | null;
  fairValue: number | null;   // moyenne des méthodes disponibles
  upside: number | null;      // fairValue / price - 1
  ddmAssumptions: { r: number; g: number } | null;
  methods: string[];          // méthodes effectivement utilisées
}

/** Hypothèses DDM : rendement exigé = sans-risque UEMOA + prime actions. */
export const REQUIRED_RETURN = 0.10; // 6% sans-risque + 4% prime
const MAX_DDM_GROWTH = 0.04;         // plafond prudent de g (g < r impératif)

/** Médiane d'une liste de nombres (ignore null). */
export function median(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

export function computeFairValue(inp: FairValueInputs): FairValueResult {
  const methods: string[] = [];
  const estimates: number[] = [];

  const byPER = inp.eps != null && inp.eps > 0 && inp.peers.medianPER != null
    ? inp.eps * inp.peers.medianPER : null;
  if (byPER != null) { estimates.push(byPER); methods.push('Multiples P/E pairs'); }

  const byPBR = inp.bvps != null && inp.bvps > 0 && inp.peers.medianPBR != null
    ? inp.bvps * inp.peers.medianPBR : null;
  if (byPBR != null) { estimates.push(byPBR); methods.push('Multiples P/B pairs'); }

  // DDM Gordon-Shapiro (uniquement si dividende positif).
  let byDDM: number | null = null;
  let ddmAssumptions: { r: number; g: number } | null = null;
  if (inp.dividendPerShare != null && inp.dividendPerShare > 0) {
    const g = Math.max(0, Math.min(inp.dividendGrowth ?? 0, MAX_DDM_GROWTH));
    const r = REQUIRED_RETURN;
    if (r > g) {
      const d1 = inp.dividendPerShare * (1 + g);
      byDDM = d1 / (r - g);
      ddmAssumptions = { r, g };
      estimates.push(byDDM);
      methods.push('DDM (Gordon-Shapiro)');
    }
  }

  const fairValue = estimates.length ? estimates.reduce((a, b) => a + b, 0) / estimates.length : null;
  const upside = fairValue != null && inp.price != null && inp.price > 0 ? fairValue / inp.price - 1 : null;

  return { byPER, byPBR, byDDM, fairValue, upside, ddmAssumptions, methods };
}
