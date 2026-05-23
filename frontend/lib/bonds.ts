// Calculs obligataires (§5.3). Approximations exploitables côté analyste.
//
// Hypothèses (faute de données détaillées sur BDFIN) :
//  - valeur nominale (face) par défaut 10 000 FCFA (convention BRVM courante) ;
//  - coupon annuel = taux_pct % de la valeur nominale ;
//  - fréquence de coupon annuelle (1/an) sauf indication ;
//  - le "prix" coté est exprimé pour la même base que la valeur nominale ;
//  - maturité en années = (date de maturité - aujourd'hui) / 365.25.
// Ces hypothèses sont documentées et ajustables.

export interface BondInputs {
  prix: number;          // prix de marché (même base que le nominal)
  couponRatePct: number; // taux nominal annuel en %
  yearsToMaturity: number;
  face?: number;         // valeur nominale (défaut 10000)
  frequency?: number;    // coupons par an (défaut 1)
}

/** Prix théorique d'une obligation pour un rendement (ytm en %, décimal interne). */
export function bondPrice(
  ytmPct: number,
  couponRatePct: number,
  yearsToMaturity: number,
  face = 10000,
  frequency = 1,
): number {
  const y = ytmPct / 100 / frequency;
  const n = Math.max(1, Math.round(yearsToMaturity * frequency));
  const coupon = (couponRatePct / 100) * face / frequency;
  let pv = 0;
  for (let t = 1; t <= n; t++) pv += coupon / Math.pow(1 + y, t);
  pv += face / Math.pow(1 + y, n);
  return pv;
}

/**
 * YTM par bisection (robuste, sans dérivée). Renvoie le rendement en % ou null.
 * Cherche dans [0%, 100%].
 */
export function yieldToMaturity(b: BondInputs): number | null {
  const { prix, couponRatePct, yearsToMaturity, face = 10000, frequency = 1 } = b;
  if (prix <= 0 || yearsToMaturity <= 0) return null;

  const f = (ytm: number) =>
    bondPrice(ytm, couponRatePct, yearsToMaturity, face, frequency) - prix;

  let lo = 0.0001, hi = 100;
  let flo = f(lo), fhi = f(hi);
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo * fhi > 0) return null; // pas de changement de signe -> hors plage

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < 1e-6 || (hi - lo) < 1e-7) return round4(mid);
    if (flo * fmid < 0) { hi = mid; fhi = fmid; }
    else { lo = mid; flo = fmid; }
  }
  return round4((lo + hi) / 2);
}

/** Duration de Macaulay (années) et duration modifiée. */
export function durations(b: BondInputs, ytmPct: number): { macaulay: number; modified: number } | null {
  const { couponRatePct, yearsToMaturity, face = 10000, frequency = 1 } = b;
  if (yearsToMaturity <= 0) return null;
  const y = ytmPct / 100 / frequency;
  const n = Math.max(1, Math.round(yearsToMaturity * frequency));
  const coupon = (couponRatePct / 100) * face / frequency;

  let price = 0;
  let weighted = 0;
  for (let t = 1; t <= n; t++) {
    const cf = t === n ? coupon + face : coupon;
    const pv = cf / Math.pow(1 + y, t);
    price += pv;
    weighted += (t / frequency) * pv; // temps en années
  }
  if (price <= 0) return null;
  const macaulay = weighted / price;
  const modified = macaulay / (1 + y);
  return { macaulay: round4(macaulay), modified: round4(modified) };
}

/** Années jusqu'à maturité depuis une date ISO (ou null). */
export function yearsTo(maturityIso: string | null, from = new Date()): number | null {
  if (!maturityIso) return null;
  const m = new Date(maturityIso + 'T00:00:00Z').getTime();
  if (Number.isNaN(m)) return null;
  const years = (m - from.getTime()) / (365.25 * 24 * 3600 * 1000);
  return years > 0 ? round4(years) : null;
}

function round4(n: number): number { return Math.round(n * 10000) / 10000; }
