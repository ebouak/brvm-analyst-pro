import type { FundamentalRatios } from './types';

export type ValuationVerdict = 'sous-evalue' | 'juste-prix' | 'surcote' | 'inconnu';

export interface ValuationResult {
  grahamNumber: number | null;
  dcfValue: number | null;
  marginOfSafety: number | null; // (grahamNumber - cours) / grahamNumber, en %
  verdict: ValuationVerdict;
  scoreValorisation: number | null; // 0-100
}

/**
 * Graham Number = sqrt(22.5 × BPA × VCA)
 * VCA (Valeur Comptable par Action) = capitaux_propres / shares
 */
export function grahamNumber(
  bpa: number | null,
  vca: number | null,
): number | null {
  if (!bpa || bpa <= 0 || !vca || vca <= 0) return null;
  return Math.sqrt(22.5 * bpa * vca);
}

/**
 * DCF ultra-simplifié : FCF × (1 + g) / (r - g) / shares
 * g = 5% (croissance perpétuelle), r = 10% (taux d'actualisation)
 */
export function dcfSimple(
  fcf: number | null,
  shares: number | null,
  g = 0.05,
  r = 0.10,
): number | null {
  if (!fcf || fcf <= 0 || !shares || shares <= 0 || r <= g) return null;
  return (fcf * (1 + g)) / (r - g) / shares;
}

export function computeValuation(
  ratios: FundamentalRatios,
  coursActuel: number | null,
  fcf: number | null,
  shares: number | null,
): ValuationResult {
  // VCA depuis PB et cours : VCA = cours / PB
  const vcaFromPB =
    coursActuel && ratios.pb && ratios.pb > 0
      ? coursActuel / ratios.pb
      : null;

  const graham = grahamNumber(ratios.bpa, vcaFromPB);
  const dcf = dcfSimple(fcf, shares);

  // Marge de sécurité Graham
  const marginOfSafety =
    graham && coursActuel
      ? ((graham - coursActuel) / graham) * 100
      : null;

  // Score composite 0-100 : combine margin of safety + PER normalisé + PB
  const scores: number[] = [];

  if (marginOfSafety !== null) {
    // +50 si MOS > 30%, 0 si MOS < -30%
    scores.push(Math.max(0, Math.min(100, 50 + marginOfSafety)));
  }
  if (ratios.per !== null) {
    // PER idéal < 15 (score 100) → > 30 (score 0)
    scores.push(Math.max(0, Math.min(100, ((30 - ratios.per) / 15) * 100)));
  }
  if (ratios.pb !== null) {
    // PB idéal < 1 (score 100) → > 3 (score 0)
    scores.push(Math.max(0, Math.min(100, ((3 - ratios.pb) / 2) * 100)));
  }

  const score = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;

  let verdict: ValuationVerdict = 'inconnu';
  if (score !== null) {
    if (score >= 60) verdict = 'sous-evalue';
    else if (score >= 35) verdict = 'juste-prix';
    else verdict = 'surcote';
  }

  return { grahamNumber: graham, dcfValue: dcf, marginOfSafety, verdict, scoreValorisation: score };
}

export const VERDICT_LABELS: Record<ValuationVerdict, string> = {
  'sous-evalue': 'Sous-évalué',
  'juste-prix': 'Juste prix',
  'surcote': 'Surcoté',
  'inconnu': 'Données insuffisantes',
};

export const VERDICT_COLORS: Record<ValuationVerdict, string> = {
  'sous-evalue': 'text-up border-up/40 bg-up/10',
  'juste-prix': 'text-gold border-gold/40 bg-gold/10',
  'surcote': 'text-down border-down/40 bg-down/10',
  'inconnu': 'text-faint border-border bg-surface',
};
