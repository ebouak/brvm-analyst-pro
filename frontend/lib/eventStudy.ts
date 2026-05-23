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
  /** Rendement cumulé titre J-window..J0 et J0..J+window (%). */
  retPre: number | null;
  retPost: number | null;
  /** Rendement cumulé indice sur la fenêtre post (%). */
  indexRetPost: number | null;
  /** Rendement excédentaire post = titre - indice (%). */
  abnormalReturnPost: number | null;
  /** Volume moyen avant / après J0. */
  avgVolPre: number | null;
  avgVolPost: number | null;
  volChangePct: number | null;
  /** Classification de la réaction post-événement. */
  reaction: 'positive' | 'neutral' | 'negative';
  /** Rendements par horizon J+1, J+3, J+5, J+10 (%). */
  horizons: Record<string, number | null>;
}

function ret(a: number | null, b: number | null): number | null {
  if (a == null || b == null || a === 0) return null;
  return ((b - a) / a) * 100;
}

/**
 * @param series   clôtures du titre, ancien -> récent
 * @param volumes  volumes alignés sur series (même longueur)
 * @param indexSeries clôtures de l'indice, mêmes dates idéalement
 * @param eventDate date de l'événement (YYYY-MM-DD)
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
    found: false, j0Index: -1, retPre: null, retPost: null,
    indexRetPost: null, abnormalReturnPost: null, avgVolPre: null,
    avgVolPost: null, volChangePct: null, reaction: 'neutral', horizons: {},
  };

  // J0 = première séance dont la date >= eventDate.
  let j0 = series.findIndex((d) => d.date >= eventDate);
  if (j0 < 0) return empty;

  const pre = series[Math.max(0, j0 - window)]?.close ?? null;
  const atJ0 = series[j0]?.close ?? null;
  const post = series[Math.min(series.length - 1, j0 + window)]?.close ?? null;

  const retPre = ret(pre, atJ0);
  const retPost = ret(atJ0, post);

  // Indice : aligner sur les mêmes bornes de dates.
  const idxAt = (date: string | undefined) =>
    date == null ? null : indexSeries.find((d) => d.date === date)?.close ?? null;
  const idxJ0 = idxAt(series[j0]?.date);
  const idxPost = idxAt(series[Math.min(series.length - 1, j0 + window)]?.date);
  const indexRetPost = ret(idxJ0, idxPost);

  const abnormalReturnPost =
    retPost != null && indexRetPost != null ? retPost - indexRetPost : retPost;

  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const avgVolPre = avg(volumes.slice(Math.max(0, j0 - window), j0));
  const avgVolPost = avg(volumes.slice(j0 + 1, j0 + 1 + window));
  const volChangePct =
    avgVolPre && avgVolPre > 0 && avgVolPost != null
      ? ((avgVolPost - avgVolPre) / avgVolPre) * 100
      : null;

  const horizons: Record<string, number | null> = {};
  for (const h of [1, 3, 5, 10]) {
    horizons['J+' + h] = ret(atJ0, series[Math.min(series.length - 1, j0 + h)]?.close ?? null);
  }

  const ar = abnormalReturnPost ?? 0;
  const reaction = ar > 1 ? 'positive' : ar < -1 ? 'negative' : 'neutral';

  return {
    found: true, j0Index: j0, retPre, retPost, indexRetPost,
    abnormalReturnPost, avgVolPre, avgVolPost, volChangePct, reaction, horizons,
  };
}
