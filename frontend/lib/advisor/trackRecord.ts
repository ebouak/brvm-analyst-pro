import type { Action } from './recommend';

/**
 * Track record PUBLIC du Conseiller — fonctions pures, testées.
 *
 * Principe d'honnêteté : chaque bascule est datée par le snapshot
 * advisor_history qui l'a produite ; la performance est mesurée du cours de
 * clôture du jour de bascule au dernier cours connu, BRUTE (hors frais de
 * courtage et hors dividendes). Rien n'est antidaté : pas de snapshot ce
 * jour-là = pas de bascule ce jour-là.
 */

export interface AdvisorHistoryRow {
  date_marche: string;
  code: string;
  action: Action;
  conviction: number | null;
}

export interface Flip {
  code: string;
  date: string; // date du snapshot qui acte la bascule
  from: Action;
  to: Action;
  conviction: number | null;
}

/** Détecte toutes les bascules d'action, code par code, en ordre chronologique. */
export function computeFlips(history: AdvisorHistoryRow[]): Flip[] {
  const byCode = new Map<string, AdvisorHistoryRow[]>();
  for (const r of history) {
    const list = byCode.get(r.code) ?? [];
    list.push(r);
    byCode.set(r.code, list);
  }

  const flips: Flip[] = [];
  for (const [code, rows] of byCode) {
    rows.sort((a, b) => a.date_marche.localeCompare(b.date_marche));
    let prev: AdvisorHistoryRow | null = null;
    for (const r of rows) {
      if (prev && prev.action !== r.action) {
        flips.push({ code, date: r.date_marche, from: prev.action, to: r.action, conviction: r.conviction });
      }
      prev = r;
    }
  }
  return flips.sort((a, b) => b.date.localeCompare(a.date));
}

export interface FlipWithPerf extends Flip {
  /** Clôture du jour de bascule (ou première clôture disponible APRÈS, jamais avant). */
  coursBascule: number | null;
  coursActuel: number | null;
  /** Évolution du cours depuis la bascule, en % — null si cours manquants. */
  perfPct: number | null;
  /** Le mouvement a-t-il donné raison à la bascule ? (hausse après Acheter, baisse après Vendre). */
  correct: boolean | null;
}

/**
 * Attache la performance à chaque bascule. `series` : clôtures par code,
 * TRIÉES par date croissante. Le cours de référence est la clôture du jour de
 * bascule ou, à défaut, la première clôture POSTÉRIEURE (jamais antérieure —
 * sinon la perf serait antidatée).
 */
export function attachPerformance(
  flips: Flip[],
  series: Map<string, { date: string; close: number }[]>,
): FlipWithPerf[] {
  return flips.map((f) => {
    const s = series.get(f.code) ?? [];
    const ref = s.find((p) => p.date >= f.date) ?? null;
    const lastPoint = s.length > 0 ? s[s.length - 1] : null;
    const coursBascule = ref?.close ?? null;
    const coursActuel = lastPoint?.close ?? null;
    const perfPct =
      coursBascule != null && coursBascule > 0 && coursActuel != null
        ? ((coursActuel - coursBascule) / coursBascule) * 100
        : null;
    let correct: boolean | null = null;
    if (perfPct != null) {
      if (f.to === 'acheter') correct = perfPct > 0;
      else if (f.to === 'vendre') correct = perfPct < 0;
      // Bascule vers « conserver » : ni bonne ni mauvaise — non notée.
    }
    return { ...f, coursBascule, coursActuel, perfPct, correct };
  });
}

export interface TrackRecordStats {
  nb: number;
  notees: number; // bascules vers acheter/vendre avec perf mesurable
  correctes: number;
  hitRate: number | null; // % de bascules notées correctes
  perfMoyenneAchat: number | null; // perf moyenne du cours après un passage à Acheter
  perfMoyenneVente: number | null; // évolution moyenne du cours après un passage à Vendre
}

/** Agrégats honnêtes : seules les bascules Acheter/Vendre avec perf mesurable sont notées. */
export function computeStats(flips: FlipWithPerf[]): TrackRecordStats {
  const notees = flips.filter((f) => f.correct != null);
  const correctes = notees.filter((f) => f.correct === true);
  const achats = flips.filter((f) => f.to === 'acheter' && f.perfPct != null);
  const ventes = flips.filter((f) => f.to === 'vendre' && f.perfPct != null);
  const avg = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    nb: flips.length,
    notees: notees.length,
    correctes: correctes.length,
    hitRate: notees.length > 0 ? (correctes.length / notees.length) * 100 : null,
    perfMoyenneAchat: avg(achats.map((f) => f.perfPct!)),
    perfMoyenneVente: avg(ventes.map((f) => f.perfPct!)),
  };
}
