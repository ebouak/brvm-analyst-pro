// Génération de texte analytique DÉRIVÉ des métriques (§14) — jamais inventé.
import { fmtPctAbsTexte as fmtPctAbs, fmtPctSigneTexte as fmtPctSigne, fmtNumber } from './format';

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
  const parts: string[] = [`Le titre ${m.code} ${dir} ${fmtPctAbs(m.performancePct, 1)} sur ${m.periodLabel}`];

  if (m.volumeRatio != null) {
    if (m.volumeRatio > 1.2) parts.push('avec un volume supérieur à sa moyenne');
    else if (m.volumeRatio < 0.8) parts.push('avec un volume inférieur à sa moyenne');
    else parts.push('sur un volume proche de sa moyenne');
  }
  if (m.rsi != null) {
    let zone = 'neutre';
    if (m.rsi > 70) zone = 'proche d’une zone de surachat';
    else if (m.rsi < 30) zone = 'proche d’une zone de survente';
    parts.push(`un RSI à ${fmtNumber(m.rsi, 0)} (${zone})`);
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
  const qual =
    e.reaction === 'positive' ? 'd’une surperformance' :
    e.reaction === 'negative' ? 'd’une sous-performance' : 'd’un écart';
  const seances = `${e.window} séance${e.window > 1 ? 's' : ''}`;
  return `L’événement du ${frDate(e.eventDate)} a été suivi ${qual} de ${fmtPctSigne(e.abnormalReturnPost, 1)} par rapport au BRVM Composite sur ${seances} (${e.code}).`;
}

/** Liste de raisons "why" dérivées des métriques. */
export function whyBullets(m: InstrumentMetrics): string[] {
  const out: string[] = [];
  if (m.performancePct != null)
    out.push(`Performance de ${fmtPctSigne(m.performancePct, 1)} sur ${m.periodLabel}.`);
  if (m.rsi != null) out.push(`RSI à ${fmtNumber(m.rsi, 0)}.`);
  if (m.volumeRatio != null) out.push(`Volume à ${fmtNumber(m.volumeRatio, 1)} fois la moyenne.`);
  out.push(`Tendance ${m.trend === 'bullish' ? 'haussière' : m.trend === 'bearish' ? 'baissière' : 'neutre'}.`);
  return out;
}

function frDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
