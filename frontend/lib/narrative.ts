// Génération de texte analytique DÉRIVÉ des métriques (§14) — jamais inventé.

export interface InstrumentMetrics {
  code: string;
  performancePct: number | null; // perf sur la période
  rsi: number | null;
  volumeRatio: number | null; // volume récent / moyenne
  trend: 'bullish' | 'neutral' | 'bearish';
  periodLabel: string; // ex "1 mois"
}

export function instrumentHeadline(m: InstrumentMetrics): string {
  if (m.performancePct == null) {
    return `${m.code} : données insuffisantes pour conclure sur la période.`;
  }
  const dir = m.performancePct >= 0 ? 'progresse de' : 'recule de';
  const perf = Math.abs(m.performancePct).toFixed(1);
  const parts: string[] = [`Le titre ${m.code} ${dir} ${perf}% sur ${m.periodLabel}`];

  if (m.volumeRatio != null) {
    if (m.volumeRatio > 1.2) parts.push('avec un volume supérieur à sa moyenne');
    else if (m.volumeRatio < 0.8) parts.push('avec un volume inférieur à sa moyenne');
    else parts.push('sur un volume proche de sa moyenne');
  }
  if (m.rsi != null) {
    let zone = 'neutre';
    if (m.rsi > 70) zone = 'proche d’une zone de surachat';
    else if (m.rsi < 30) zone = 'proche d’une zone de survente';
    parts.push(`un RSI à ${m.rsi.toFixed(0)} (${zone})`);
  }
  const trendTxt =
    m.trend === 'bullish' ? 'momentum positif' :
    m.trend === 'bearish' ? 'momentum négatif' : 'momentum neutre';
  return parts.join(', ') + `, traduisant un ${trendTxt}.`;
}

export interface EventNarrativeInput {
  eventDate: string;
  code: string;
  abnormalReturnPost: number | null;
  reaction: 'positive' | 'neutral' | 'negative';
  window: number;
}

export function eventHeadline(e: EventNarrativeInput): string {
  if (e.abnormalReturnPost == null) {
    return `L’événement du ${frDate(e.eventDate)} n’a pas pu être relié à une réaction mesurable de ${e.code}.`;
  }
  const sign = e.abnormalReturnPost >= 0 ? '+' : '';
  const perf = e.abnormalReturnPost.toFixed(1);
  const qual =
    e.reaction === 'positive' ? 'une surperformance' :
    e.reaction === 'negative' ? 'une sous-performance' : 'une performance neutre';
  return `L’événement du ${frDate(e.eventDate)} a été suivi de ${qual} de ${sign}${perf}% par rapport au BRVM Composite sur ${e.window} séances (${e.code}).`;
}

/** Liste de raisons "why" dérivées des métriques. */
export function whyBullets(m: InstrumentMetrics): string[] {
  const out: string[] = [];
  if (m.performancePct != null)
    out.push(`Performance ${m.performancePct >= 0 ? '+' : ''}${m.performancePct.toFixed(1)}% sur ${m.periodLabel}.`);
  if (m.rsi != null) out.push(`RSI à ${m.rsi.toFixed(0)}.`);
  if (m.volumeRatio != null) out.push(`Volume à ${m.volumeRatio.toFixed(1)}x la moyenne.`);
  out.push(`Tendance ${m.trend === 'bullish' ? 'haussière' : m.trend === 'bearish' ? 'baissière' : 'neutre'}.`);
  return out;
}

function frDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
