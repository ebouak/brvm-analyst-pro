/**
 * Estimation de la valeur d'une action — fonctions pures et testées.
 *
 *  - Multiples relatifs aux pairs : BPA × P/E médian du secteur, VNC × P/B médian.
 *    Ce sont les seules méthodes qui entrent dans la valeur estimée.
 *  - « Valeur de rendement » (Gordon-Shapiro, D₁ / (r − g)) : calculée et affichée
 *    À PART, jamais moyennée. Corrigé le 2026-11-13 : avec r = 10 % et g = 0, elle
 *    valait 10 fois le dividende net, soit 45 % du cours en médiane, et tirait
 *    29 sociétés sur 37 vers la « surcote ».
 *
 * Garde-fous (2026-11-13) :
 *  - résultat insuffisant (ROE ≤ 2 %) : non estimable, aucun verdict ;
 *  - résultat exceptionnel probable (P/E < 3 ou ROE > 50 %) : méthode P/E écartée ;
 *  - méthodes de part et d'autre du cours : « en désaccord », fourchette affichée.
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
  /** ROE de l'exercice retenu (résultat ÷ fonds propres). */
  roe?: number | null;
  /** P/E de la société au cours du jour. */
  per?: number | null;
}

export interface FairValueResult {
  byPER: number | null;
  byPBR: number | null;
  /** Valeur de rendement (Gordon-Shapiro) : affichée à part, hors moyenne. */
  byDDM: number | null;
  /** Moyenne des méthodes retenues (P/E, P/B). */
  fairValue: number | null;
  upside: number | null; // fairValue / price - 1
  /** Fourchette des méthodes retenues. */
  basse: number | null;
  haute: number | null;
  /** `desaccord` : une méthode au-dessus du cours, l'autre en dessous. */
  accord: 'accord' | 'desaccord' | 'unique' | null;
  /** Non estimable : le résultat ne permet pas d'appliquer les multiples. */
  exclusion: 'resultat_insuffisant' | null;
  /** Méthode P/E écartée (résultat exceptionnel probable). */
  perEcarte: boolean;
  ddmAssumptions: { r: number; g: number } | null;
  methods: string[]; // méthodes entrées dans la valeur estimée
}

/** Hypothèses de la valeur de rendement : rendement exigé = sans-risque UEMOA + prime actions. */
export const REQUIRED_RETURN = 0.10; // 6 % sans-risque + 4 % prime
const MAX_DDM_GROWTH = 0.04; // plafond prudent de g (g < r impératif)
/** En dessous, le résultat est trop faible pour valoriser par les multiples. */
export const ROE_MIN = 0.02;
/** P/E sous ce seuil, ou ROE au-dessus du suivant : résultat exceptionnel probable. */
export const PER_MIN_PLAUSIBLE = 3;
export const ROE_MAX_PLAUSIBLE = 0.5;

/** Médiane d'une liste de nombres (ignore null et non-positifs). */
export function median(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

export function computeFairValue(inp: FairValueInputs): FairValueResult {
  // Valeur de rendement, toujours à part.
  let byDDM: number | null = null;
  let ddmAssumptions: { r: number; g: number } | null = null;
  if (inp.dividendPerShare != null && inp.dividendPerShare > 0) {
    const g = Math.max(0, Math.min(inp.dividendGrowth ?? 0, MAX_DDM_GROWTH));
    const r = REQUIRED_RETURN;
    if (r > g) {
      byDDM = (inp.dividendPerShare * (1 + g)) / (r - g);
      ddmAssumptions = { r, g };
    }
  }

  const vide = { byPER: null, byPBR: null, fairValue: null, upside: null, basse: null, haute: null, accord: null, methods: [] as string[] };
  if (inp.roe != null && inp.roe <= ROE_MIN) {
    return { ...vide, byDDM, exclusion: 'resultat_insuffisant', perEcarte: false, ddmAssumptions };
  }

  const perEcarte = (inp.per != null && inp.per > 0 && inp.per < PER_MIN_PLAUSIBLE) || (inp.roe != null && inp.roe > ROE_MAX_PLAUSIBLE);
  const methods: string[] = [];
  const estimates: number[] = [];

  const byPER = !perEcarte && inp.eps != null && inp.eps > 0 && inp.peers.medianPER != null ? inp.eps * inp.peers.medianPER : null;
  if (byPER != null) { estimates.push(byPER); methods.push('Multiples P/E pairs'); }

  const byPBR = inp.bvps != null && inp.bvps > 0 && inp.peers.medianPBR != null ? inp.bvps * inp.peers.medianPBR : null;
  if (byPBR != null) { estimates.push(byPBR); methods.push('Multiples P/B pairs'); }

  const fairValue = estimates.length ? estimates.reduce((a, b) => a + b, 0) / estimates.length : null;
  const upside = fairValue != null && inp.price != null && inp.price > 0 ? fairValue / inp.price - 1 : null;
  const basse = estimates.length ? Math.min(...estimates) : null;
  const haute = estimates.length ? Math.max(...estimates) : null;
  let accord: FairValueResult['accord'] = null;
  if (estimates.length === 1) accord = 'unique';
  else if (estimates.length === 2 && inp.price != null && inp.price > 0) {
    accord = Math.sign(estimates[0]! - inp.price) === Math.sign(estimates[1]! - inp.price) ? 'accord' : 'desaccord';
  }

  return { byPER, byPBR, byDDM, fairValue, upside, basse, haute, accord, exclusion: null, perEcarte, ddmAssumptions, methods };
}
