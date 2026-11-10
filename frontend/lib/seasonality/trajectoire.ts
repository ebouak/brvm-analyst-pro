// Saisonnalité v2, lot 2 — confrontation du mois en cours (F1) et tenue de la
// saison hors échantillon (F2). Fonctions PURES, testées (vitest).
// Spec : docs/superpowers/specs/2026-11-10-saisonnalite-v2.md §5-6.
// La trajectoire séance par séance n'est pas stockée : elle est calculée ici,
// à partir des cours quotidiens (décision de l'exploitant, 2026-11-10).

import type { DailyClose, MonthlyReturn } from './compute';

export interface PointTrajectoire { rang: number; cumul: number }
export interface PointBande { rang: number; mediane: number; q25: number; q75: number; n: number }
export type EtatMois = 'au_dessus' | 'dans_la_fourchette' | 'en_dessous' | 'trop_tot' | 'historique_insuffisant';

/** Seuils de la spec : pas d'état avant la 5e séance, ni sous 5 années comparables. */
export const SEANCES_MIN = 5;
export const ANNEES_MIN = 5;

/**
 * Parcours d'un mois : rendement cumulé à chaque séance, depuis la dernière
 * clôture du mois précédent, coupons détachés dans le mois réintégrés.
 * `null` si aucun cours n'existe avant le mois.
 */
export function trajectoireMois(
  closes: DailyClose[],
  annee: number,
  mois: number,
  coupons: { date: string; montant: number }[] = [],
): PointTrajectoire[] | null {
  const cle = `${annee}-${String(mois).padStart(2, '0')}`;
  const tries = closes.filter((c) => Number.isFinite(c.close) && c.close > 0).sort((a, b) => a.date.localeCompare(b.date));
  const avant = tries.filter((c) => c.date.slice(0, 7) < cle);
  const base = avant[avant.length - 1];
  if (!base) return null;
  // Dividende réintégré à partir du détachement : sinon le coupon passe pour une baisse.
  const detache = (d: string) => coupons.filter((c) => c.date.slice(0, 7) === cle && c.date <= d).reduce((t, c) => t + c.montant, 0);
  return tries.filter((c) => c.date.slice(0, 7) === cle).map((c, i) => ({ rang: i + 1, cumul: (c.close + detache(c.date)) / base.close - 1 }));
}

function quantile(tries: number[], q: number): number {
  const pos = (tries.length - 1) * q;
  const bas = Math.floor(pos);
  const haut = Math.ceil(pos);
  return tries[bas]! + (tries[haut]! - tries[bas]!) * (pos - bas);
}

/** Médiane et quartiles des parcours passés, rang par rang (effectif par rang). */
export function bandeHistorique(trajectoires: PointTrajectoire[][]): PointBande[] {
  const rangMax = Math.max(0, ...trajectoires.map((t) => t.length));
  const out: PointBande[] = [];
  for (let rang = 1; rang <= rangMax; rang++) {
    const xs = trajectoires.map((t) => t[rang - 1]?.cumul).filter((x): x is number => x != null).sort((a, b) => a - b);
    if (xs.length === 0) continue;
    out.push({ rang, mediane: quantile(xs, 0.5), q25: quantile(xs, 0.25), q75: quantile(xs, 0.75), n: xs.length });
  }
  return out;
}

/**
 * Le mois en cours est-il dans sa fourchette habituelle ? La fourchette
 * (quartiles 25-75 %) est prise au MÊME rang de séance ; au-delà du dernier
 * rang connu, le dernier rang sert de référence.
 */
export function etatMois({ rdtEnCours, rangSeance, bande }: { rdtEnCours: number; rangSeance: number; bande: PointBande[] }): {
  etat: EtatMois; q25: number | null; mediane: number | null; q75: number | null; n: number;
} {
  const ref = bande.find((b) => b.rang === rangSeance) ?? bande[bande.length - 1];
  const vide = { q25: null, mediane: null, q75: null, n: ref?.n ?? 0 };
  if (rangSeance < SEANCES_MIN) return { etat: 'trop_tot', ...vide };
  if (!ref || ref.n < ANNEES_MIN) return { etat: 'historique_insuffisant', ...vide };
  const etat: EtatMois = rdtEnCours > ref.q75 ? 'au_dessus' : rdtEnCours < ref.q25 ? 'en_dessous' : 'dans_la_fourchette';
  return { etat, q25: ref.q25, mediane: ref.mediane, q75: ref.q75, n: ref.n };
}

/**
 * La saison a-t-elle tenu ? Pour chaque année et chaque mois : le signe de la
 * médiane des `fenetre` années PRÉCÉDENTES (5 au moins) est comparé au signe
 * réalisé. Aucune année n'est jugée sur un profil qui la contient.
 */
export function bilanHorsEchantillon(rets: MonthlyReturn[], fenetre = 10): { month: number; tests: number; verifies: number }[] {
  const out: { month: number; tests: number; verifies: number }[] = [];
  for (let month = 1; month <= 12; month++) {
    const xs = rets.filter((r) => r.month === month && !(r.gapMonths > 0)).sort((a, b) => a.year - b.year);
    let tests = 0;
    let verifies = 0;
    for (const r of xs) {
      const passe = xs.filter((p) => p.year < r.year && p.year >= r.year - fenetre).map((p) => p.ret).sort((a, b) => a - b);
      if (passe.length < ANNEES_MIN) continue;
      const profil = quantile(passe, 0.5);
      if (profil === 0 || r.ret === 0) continue;
      tests++;
      if (Math.sign(profil) === Math.sign(r.ret)) verifies++;
    }
    out.push({ month, tests, verifies });
  }
  return out;
}
