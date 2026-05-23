/** Heuristiques de classification d'un événement à partir de son titre. */
import type { EventType } from './types.js';

export function classifyEventType(title: string): EventType {
  const t = title.toLowerCase();
  if (/(dividende|coupon|distribution)/.test(t)) return 'dividende';
  if (/(r[ée]sultat|chiffre d.affaires|b[ée]n[ée]fice|comptes)/.test(t)) return 'resultats';
  if (/(assembl[ée]e|ago|age|convocation)/.test(t)) return 'assemblee';
  if (/(admission|introduction|cotation nouvelle|premi[èe]re cotation)/.test(t)) return 'admission';
  if (/(suspension|radiation|reprise de cotation)/.test(t)) return 'suspension';
  return 'autre';
}

/** Sentiment naïf basé sur des mots-clés (V1 ; affiné en V3). */
export function guessSentiment(
  title: string,
  summary: string | null,
): 'positive' | 'neutral' | 'negative' | null {
  const t = `${title} ${summary ?? ''}`.toLowerCase();
  if (/(hausse|progression|record|croissance|b[ée]n[ée]fice|dividende)/.test(t)) return 'positive';
  if (/(baisse|perte|recul|suspension|sanction|d[ée]ficit|avertissement)/.test(t)) return 'negative';
  return 'neutral';
}
