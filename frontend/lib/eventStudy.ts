// Event-study simplifié (§8) : réaction d'un titre autour d'un événement,
// comparée au BRVM Composite. Pas une étude académique, mais une lecture utile.

export interface DatedClose {
  date: string; // YYYY-MM-DD
  close: number | null;
}

export interface EventStudyResult {
  found: boolean;
  /** Index de J0 dans les séries (ou -1). */
  j0Index: number;
  /** Séances cotées réellement observées après J0 (plafonnées à `window`). */
  seancesObservees: number;
  /** Faux tant que `window` séances n'ont pas suivi J0 : la mesure porte alors sur `seancesObservees`. */
  fenetreComplete: boolean;
  /** Rendement cumulé titre J-window..J0 et J0..J+n, n = séances observées (%). */
  retPre: number | null;
  retPost: number | null;
  /** Rendement cumulé indice sur la même fenêtre post (%). */
  indexRetPost: number | null;
  /**
   * Rendement excédentaire post = titre − indice (%). NUL quand l'indice manque
   * sur l'une des deux bornes : un écart « à l'indice » sans indice n'est pas une mesure.
   */
  abnormalReturnPost: number | null;
  /** Volume moyen avant / après J0. */
  avgVolPre: number | null;
  avgVolPost: number | null;
  volChangePct: number | null;
  /** Classification de la réaction post-événement (neutre si non mesurable). */
  reaction: 'positive' | 'neutral' | 'negative';
  /** Rendements par horizon J+1, J+3, J+5, J+10 (%). NUL si l'horizon n'est pas encore atteint. */
  horizons: Record<string, number | null>;
}

function ret(a: number | null, b: number | null): number | null {
  if (a == null || b == null || a === 0) return null;
  return ((b - a) / a) * 100;
}

export const HORIZONS = [1, 3, 5, 10] as const;

/**
 * @param series   clôtures du titre, ancien -> récent
 * @param volumes  volumes alignés sur series (même longueur)
 * @param indexSeries clôtures de l'indice, mêmes dates idéalement
 * @param eventDate date de l'événement (YYYY-MM-DD) ; un jour non coté renvoie à la séance suivante
 * @param window    demi-fenêtre (défaut 5)
 */
export function eventStudy(
  series: DatedClose[],
  volumes: (number | null)[],
  indexSeries: DatedClose[],
  eventDate: string,
  window = 5,
): EventStudyResult {
  const empty: EventStudyResult = {
    found: false, j0Index: -1, seancesObservees: 0, fenetreComplete: false, retPre: null, retPost: null,
    indexRetPost: null, abnormalReturnPost: null, avgVolPre: null,
    avgVolPost: null, volChangePct: null, reaction: 'neutral', horizons: {},
  };

  // J0 = première séance dont la date >= eventDate.
  const j0 = series.findIndex((d) => d.date >= eventDate);
  if (j0 < 0) return empty;

  const seancesObservees = Math.min(window, series.length - 1 - j0);
  const fenetreComplete = seancesObservees >= window;
  const jFin = j0 + seancesObservees;

  const pre = j0 - window >= 0 ? series[j0 - window]?.close ?? null : null;
  const atJ0 = series[j0]?.close ?? null;
  const post = seancesObservees > 0 ? series[jFin]?.close ?? null : null;

  const retPre = ret(pre, atJ0);
  const retPost = ret(atJ0, post);

  // Indice : aligné sur les mêmes dates de séance.
  const idxAt = (date: string | undefined) =>
    date == null ? null : indexSeries.find((d) => d.date === date)?.close ?? null;
  const idxJ0 = idxAt(series[j0]?.date);
  const idxPost = seancesObservees > 0 ? idxAt(series[jFin]?.date) : null;
  const indexRetPost = ret(idxJ0, idxPost);

  const abnormalReturnPost = retPost != null && indexRetPost != null ? retPost - indexRetPost : null;

  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const avgVolPre = avg(volumes.slice(Math.max(0, j0 - window), j0));
  const avgVolPost = avg(volumes.slice(j0 + 1, j0 + 1 + seancesObservees));
  const volChangePct =
    avgVolPre && avgVolPre > 0 && avgVolPost != null
      ? ((avgVolPost - avgVolPre) / avgVolPre) * 100
      : null;

  const horizons: Record<string, number | null> = {};
  for (const h of HORIZONS) {
    horizons['J+' + h] = j0 + h < series.length ? ret(atJ0, series[j0 + h]?.close ?? null) : null;
  }

  const reaction =
    abnormalReturnPost == null ? 'neutral' : abnormalReturnPost > 1 ? 'positive' : abnormalReturnPost < -1 ? 'negative' : 'neutral';

  return {
    found: true, j0Index: j0, seancesObservees, fenetreComplete, retPre, retPost, indexRetPost,
    abnormalReturnPost, avgVolPre, avgVolPost, volChangePct, reaction, horizons,
  };
}

/** Bornes calendaires à charger autour d'un événement (titre et indice) : 40 jours avant, 30 après. */
export function fenetreChargement(eventDate: string, avant = 40, apres = 30): { debut: string; fin: string } {
  const t = Date.parse(`${eventDate}T12:00:00Z`);
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { debut: iso(t - avant * 86_400_000), fin: iso(t + apres * 86_400_000) };
}

/** Dates de détachement (ex-date) comprises après la veille de J0 et jusqu'à la dernière séance observée. */
export function detachementsDansFenetre(
  series: DatedClose[],
  r: Pick<EventStudyResult, 'found' | 'j0Index' | 'seancesObservees'>,
  exDates: string[],
): string[] {
  if (!r.found) return [];
  const debut = series[Math.max(0, r.j0Index - 1)]?.date;
  const fin = series[r.j0Index + r.seancesObservees]?.date;
  if (!debut || !fin) return [];
  return [...new Set(exDates.filter((d) => d > debut && d <= fin))].sort();
}
