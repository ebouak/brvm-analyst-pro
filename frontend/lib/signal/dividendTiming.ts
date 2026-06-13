/**
 * Analyse du timing dividende, en parallèle du signal technique.
 *
 * - `upcoming` : un détachement (ex_date) est à venir → compte à rebours,
 *   rendement et baisse mécanique attendue (≈ rendement) le jour J.
 * - `recent`   : un détachement a eu lieu récemment → la baisse récente du
 *   cours est en partie mécanique, pas nécessairement un signal vendeur.
 * - `historical` : pas d'ex_date exploitable mais un montant connu → rendement
 *   indicatif, sans inventer de date.
 * - `none`     : aucune information dividende.
 *
 * Fonction pure et testable.
 */

export interface DividendInput {
  montant: number;
  ex_date: string | null;
  payment_date: string | null;
  exercice: number | null;
}

export interface DividendTiming {
  status: 'upcoming' | 'recent' | 'historical' | 'none';
  exDate: string | null;
  daysToEx: number | null; // >0 avant détachement, <0 après
  montant: number | null;
  yieldPct: number | null;
  mechanicalDropPct: number | null;
  verdict: string;
}

/** Fenêtre (jours calendaires) durant laquelle une baisse post-détachement reste « mécanique ». */
const RECENT_WINDOW_DAYS = 14;

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso + 'T00:00:00Z');
  const b = Date.parse(toIso + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((a - b) / 86_400_000);
}

const EMPTY: DividendTiming = {
  status: 'none', exDate: null, daysToEx: null, montant: null,
  yieldPct: null, mechanicalDropPct: null, verdict: '',
};

export function analyzeDividendTiming(
  divs: DividendInput[],
  cours: number | null,
  today: string,
): DividendTiming {
  if (!divs || divs.length === 0) return EMPTY;

  const withEx = divs
    .filter((d) => d.ex_date)
    .map((d) => ({ ...d, days: daysBetween(d.ex_date!, today) }))
    .filter((d) => !Number.isNaN(d.days));

  const yieldOf = (montant: number): number | null =>
    cours != null && cours > 0 && montant > 0 ? (montant / cours) * 100 : null;

  // 1) Détachement à venir (le plus proche).
  const upcoming = withEx
    .filter((d) => d.days >= 0)
    .sort((a, b) => a.days - b.days)[0];
  if (upcoming) {
    const y = yieldOf(upcoming.montant);
    const rdt = y != null ? ` (rendement ${y.toFixed(1)}%)` : '';
    const drop = y != null ? ` Le cours baissera mécaniquement d'environ ${y.toFixed(1)}% le jour du détachement.` : '';
    const quand = upcoming.days === 0 ? "aujourd'hui" : `dans ${upcoming.days} jour${upcoming.days > 1 ? 's' : ''}`;
    return {
      status: 'upcoming',
      exDate: upcoming.ex_date,
      daysToEx: upcoming.days,
      montant: upcoming.montant,
      yieldPct: y,
      mechanicalDropPct: y,
      verdict: `Détachement ${quand}${rdt} : acheter avant capte le coupon (${upcoming.montant.toLocaleString('fr-FR')} FCFA/action).${drop}`,
    };
  }

  // 2) Détachement récent (baisse partiellement mécanique).
  const recent = withEx
    .filter((d) => d.days < 0 && d.days >= -RECENT_WINDOW_DAYS)
    .sort((a, b) => b.days - a.days)[0];
  if (recent) {
    const y = yieldOf(recent.montant);
    const rdt = y != null ? ` d'environ ${y.toFixed(1)}%` : '';
    const ago = Math.abs(recent.days);
    return {
      status: 'recent',
      exDate: recent.ex_date,
      daysToEx: recent.days,
      montant: recent.montant,
      yieldPct: y,
      mechanicalDropPct: y,
      verdict: `Détachement il y a ${ago} jour${ago > 1 ? 's' : ''} : une partie de la baisse récente est mécanique${rdt}, pas nécessairement un signal vendeur.`,
    };
  }

  // 3) Repli : historique de dividende sans date exploitable.
  const latest = divs[0];
  if (latest && latest.montant > 0) {
    const y = yieldOf(latest.montant);
    const rdt = y != null ? ` soit un rendement indicatif de ${y.toFixed(1)}%` : '';
    const exo = latest.exercice ? ` (exercice ${latest.exercice})` : '';
    return {
      status: 'historical',
      exDate: null,
      daysToEx: null,
      montant: latest.montant,
      yieldPct: y,
      mechanicalDropPct: y,
      verdict: `Dernier dividende connu : ${latest.montant.toLocaleString('fr-FR')} FCFA/action${exo}${rdt}. Date de détachement non disponible.`,
    };
  }

  return EMPTY;
}
