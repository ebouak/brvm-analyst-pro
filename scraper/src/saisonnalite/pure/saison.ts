/**
 * COPIE de frontend/lib/seasonality/compute.ts (verdictCellule) et
 * frontend/lib/seasonality/trajectoire.ts (trajectoire, bande, état), pour le
 * scraper (saisonnalité v2, lot 4). Deux paquets TS distincts, pas de module
 * partagé : même duplication assumée que scraper/src/hebdo/pure/.
 * ⚠️ Toute correction est à reporter DES DEUX CÔTÉS.
 * Ajout propre au scraper : quantiles 10 et 90 (bande large de l'alerte,
 * conseil fable-advisor du 2026-11-11).
 */

export type Verdict = 'etabli' | 'indicatif' | 'hasard';
export type EtatMois = 'au_dessus' | 'dans_la_fourchette' | 'en_dessous' | 'trop_tot' | 'historique_insuffisant';
export interface PointTrajectoire { rang: number; cumul: number }
export interface PointBande { rang: number; q10: number; q25: number; mediane: number; q75: number; q90: number; n: number }

export const SEANCES_MIN = 5;
export const ANNEES_MIN = 5;

export function quantile(tries: number[], q: number): number {
  const pos = (tries.length - 1) * q;
  const bas = Math.floor(pos);
  const haut = Math.ceil(pos);
  return tries[bas]! + (tries[haut]! - tries[bas]!) * (pos - bas);
}
const mediane = (xs: number[]) => quantile([...xs].sort((a, b) => a - b), 0.5);
const moyenne = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
function ecartType(xs: number[]): number {
  const m = moyenne(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

const T_CORRIGE = [3.81, 3.7, 3.61, 3.53, 3.47, 3.42, 3.38, 3.34, 3.31, 3.28, 3.26, 3.24, 3.22, 3.2, 3.19, 3.17, 3.16, 3.15, 3.14, 3.12, 3.12, 3.11];
const seuilCorrige = (n: number) => T_CORRIGE[n - 10] ?? 3.1;

/** Copie de verdictCellule (frontend/lib/seasonality/compute.ts). */
export function verdictCellule(xs: { year: number; ret: number }[]): Verdict {
  const n = xs.length;
  if (n < 5) return 'hasard';
  const chrono = [...xs].sort((a, b) => a.year - b.year).map((x) => x.ret);
  const moy = moyenne(chrono);
  const med = mediane(chrono);
  const signesAccord = moy !== 0 && med !== 0 && Math.sign(moy) === Math.sign(med);
  if (!signesAccord) return 'hasard';
  const moitie = Math.floor(n / 2);
  const m1 = mediane(chrono.slice(0, moitie));
  const m2 = mediane(chrono.slice(moitie));
  const moitiesAccord = m1 !== 0 && Math.sign(m1) === Math.sign(m2);
  const partHausses = chrono.filter((x) => x > 0).length / n;
  const partNette = partHausses <= 0.3 || partHausses >= 0.7;
  const sd = ecartType(chrono);
  const t = sd === 0 ? Infinity : Math.abs(moy) / (sd / Math.sqrt(n));
  if (n >= 10 && moitiesAccord && partNette && t >= seuilCorrige(n)) return 'etabli';
  const criteres = [n >= 10, moitiesAccord, signesAccord, partNette].filter(Boolean).length;
  return criteres >= 3 && t >= 2 ? 'indicatif' : 'hasard';
}

/** Copie de trajectoireMois : cumul depuis la dernière clôture du mois précédent, coupons réintégrés. */
export function trajectoireMois(
  closes: { date: string; close: number }[],
  annee: number,
  mois: number,
  coupons: { date: string; montant: number }[] = [],
): PointTrajectoire[] | null {
  const cle = `${annee}-${String(mois).padStart(2, '0')}`;
  const tries = closes.filter((c) => Number.isFinite(c.close) && c.close > 0).sort((a, b) => a.date.localeCompare(b.date));
  const avant = tries.filter((c) => c.date.slice(0, 7) < cle);
  const base = avant[avant.length - 1];
  if (!base) return null;
  const detache = (d: string) => coupons.filter((c) => c.date.slice(0, 7) === cle && c.date <= d).reduce((t, c) => t + c.montant, 0);
  return tries.filter((c) => c.date.slice(0, 7) === cle).map((c, i) => ({ rang: i + 1, cumul: (c.close + detache(c.date)) / base.close - 1 }));
}

/** Copie de bandeHistorique, avec q10 et q90 en plus. */
export function bandeHistorique(trajectoires: PointTrajectoire[][]): PointBande[] {
  const rangMax = Math.max(0, ...trajectoires.map((t) => t.length));
  const out: PointBande[] = [];
  for (let rang = 1; rang <= rangMax; rang++) {
    const xs = trajectoires.map((t) => t[rang - 1]?.cumul).filter((x): x is number => x != null).sort((a, b) => a - b);
    if (xs.length === 0) continue;
    out.push({ rang, q10: quantile(xs, 0.1), q25: quantile(xs, 0.25), mediane: quantile(xs, 0.5), q75: quantile(xs, 0.75), q90: quantile(xs, 0.9), n: xs.length });
  }
  return out;
}

/** Copie de etatMois, paramétrée par la bande (25-75 % pour la page, 10-90 % pour l'alerte). */
export function etatMois(
  { rdtEnCours, rangSeance, bande }: { rdtEnCours: number; rangSeance: number; bande: PointBande[] },
  bas: 'q10' | 'q25' = 'q25',
  haut: 'q75' | 'q90' = 'q75',
): EtatMois {
  const ref = bande.find((b) => b.rang === rangSeance) ?? bande[bande.length - 1];
  if (rangSeance < SEANCES_MIN) return 'trop_tot';
  if (!ref || ref.n < ANNEES_MIN) return 'historique_insuffisant';
  return rdtEnCours > ref[haut] ? 'au_dessus' : rdtEnCours < ref[bas] ? 'en_dessous' : 'dans_la_fourchette';
}
