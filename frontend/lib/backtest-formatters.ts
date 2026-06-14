import type { RiskLevel } from '@/types/backtest';

/** Formate un pourcentage signé en français : « +92,8 % ». */
export function formatPercent(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits).replace('.', ',')} %`;
}

/** Date ISO -> « 14 juin 2026 ». */
export function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export type Tone = 'positive' | 'neutral' | 'negative';

/** Couleur conditionnelle d'une performance. */
export function getPerformanceTone(value: number): Tone {
  if (value >= 5) return 'positive';
  if (value <= -2) return 'negative';
  return 'neutral';
}

/** Couleur d'un niveau de risque. */
export function getRiskTone(level?: RiskLevel): Tone {
  if (level === 'low') return 'positive';
  if (level === 'high') return 'negative';
  return 'neutral';
}

/** Classes texte par ton (thème clair). */
export const toneTextClass: Record<Tone, string> = {
  positive: 'text-green-700',
  neutral: 'text-sky-700',
  negative: 'text-red-600',
};

/** Classes fond/bordure douces par ton (thème clair). */
export const toneSoftClass: Record<Tone, string> = {
  positive: 'bg-green-50 border-green-200',
  neutral: 'bg-sky-50 border-sky-200',
  negative: 'bg-red-50 border-red-200',
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Risque faible',
  medium: 'Risque modéré',
  high: 'Risque élevé',
};
