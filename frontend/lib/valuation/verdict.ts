/**
 * Verdict de valorisation : synthèse nuancée combinant décote/surcote, qualité
 * fondamentale et fiabilité des données. Style des verdicts signal/backtest.
 *
 * Fonction pure et testable.
 */

import type { ValuationMetrics } from './metrics';
import type { FairValueResult } from './fairValue';
import type { QualityScore } from './quality';

export interface ValuationVerdict {
  stance: 'decote' | 'surcote' | 'proche' | 'indisponible';
  headline: string;
  rationale: string[];
  cautions: string[];
}

const UPSIDE_BAND = 0.15; // ±15 % = « proche de la juste valeur »

export function buildVerdict(
  m: ValuationMetrics,
  fv: FairValueResult,
  q: QualityScore,
): ValuationVerdict {
  const rationale: string[] = [];
  const cautions: string[] = [];

  if (!m.reliable) {
    return {
      stance: 'indisponible',
      headline: 'Valorisation indisponible',
      rationale: ['Les états financiers de cette société ne sont pas exploitables (incomplets ou incohérents).'],
      cautions: ['Aucun ratio ne peut être calculé de façon fiable.'],
    };
  }

  const pct = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`);

  // Ratios connus
  if (m.per != null) rationale.push(`P/E ${m.per.toFixed(1)}.`);
  if (m.pbr != null) rationale.push(`P/B ${m.pbr.toFixed(2)}.`);
  if (m.roe != null) rationale.push(`ROE ${(m.roe * 100).toFixed(1)}%.`);
  if (m.dividendYield != null) rationale.push(`Rendement dividende ${(m.dividendYield * 100).toFixed(1)}%.`);
  rationale.push(`Qualité fondamentale : ${q.label.toLowerCase()} (${q.score}/${q.max}).`);

  let stance: ValuationVerdict['stance'];
  let headline: string;

  if (fv.upside == null) {
    stance = 'indisponible';
    headline = 'Juste-valeur non estimable';
    cautions.push('Le nombre d’actions ou les multiples de pairs manquent : pas d’estimation de juste-valeur.');
  } else if (fv.upside > UPSIDE_BAND) {
    stance = 'decote';
    headline = `Décote estimée (${pct(fv.upside)} vs juste-valeur)`;
    rationale.push(`Juste-valeur estimée au-dessus du cours via ${fv.methods.join(', ')}.`);
  } else if (fv.upside < -UPSIDE_BAND) {
    stance = 'surcote';
    headline = `Surcote estimée (${pct(fv.upside)} vs juste-valeur)`;
    rationale.push(`Le cours dépasse la juste-valeur estimée via ${fv.methods.join(', ')}.`);
  } else {
    stance = 'proche';
    headline = 'Proche de la juste-valeur';
    rationale.push(`Cours en ligne avec la juste-valeur estimée (${pct(fv.upside)}).`);
  }

  // Nuances qualité ⨯ décote
  if (stance === 'decote' && q.label === 'Fragile') {
    cautions.push('Décote apparente mais qualité fondamentale fragile : possible « value trap ».');
  }
  if (fv.ddmAssumptions) {
    cautions.push(`DDM sous hypothèses : rendement exigé ${(fv.ddmAssumptions.r * 100).toFixed(0)}%, croissance ${(fv.ddmAssumptions.g * 100).toFixed(0)}%.`);
  }

  return { stance, headline, rationale, cautions };
}
