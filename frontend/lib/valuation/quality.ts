/**
 * Score de qualité fondamentale (inspiré Piotroski, adapté aux données BRVM
 * disponibles : rentabilité, levier, croissance). Valable même sans le nombre
 * d'actions. Sur 5 critères.
 *
 * Fonction pure et testable.
 */

import type { ValuationMetrics } from './metrics';

export interface QualityScore {
  score: number;        // 0..5
  max: number;          // 5
  criteria: { label: string; pass: boolean }[];
  label: 'Solide' | 'Correct' | 'Fragile' | 'Indisponible';
}

export function computeQuality(m: ValuationMetrics): QualityScore {
  if (!m.reliable) {
    return { score: 0, max: 5, criteria: [], label: 'Indisponible' };
  }

  const criteria: { label: string; pass: boolean }[] = [
    { label: 'Résultat net positif', pass: (m.roe ?? -1) > 0 },
    { label: 'ROE > 10 %', pass: (m.roe ?? 0) > 0.10 },
    { label: 'Marge nette > 5 %', pass: (m.netMargin ?? 0) > 0.05 },
    { label: 'Endettement maîtrisé (dette/FP < 1)', pass: m.debtToEquity != null && m.debtToEquity < 1 },
    { label: 'Croissance du résultat', pass: (m.netIncomeGrowth ?? -1) > 0 },
  ];

  const score = criteria.filter((c) => c.pass).length;
  const label: QualityScore['label'] = score >= 4 ? 'Solide' : score >= 2 ? 'Correct' : 'Fragile';

  return { score, max: 5, criteria, label };
}
