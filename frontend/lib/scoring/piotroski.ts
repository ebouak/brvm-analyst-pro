/**
 * Piotroski F-Score (9 critères) sur les états financiers réels.
 * Mesure la solidité fondamentale : rentabilité, levier/liquidité, efficience.
 * Nécessite l'exercice courant ET le précédent (variations).
 *
 * Fonction pure et testable.
 */

export interface FScoreYear {
  revenu_total: number | null;
  marge_brute: number | null;
  resultat_net: number | null;
  actions_en_circulation: number | null;
  total_actifs: number | null;
  total_actif_circulant: number | null;
  passif_courant: number | null;
  dette_long_terme: number | null;
  flux_exploitation: number | null; // CFO
}

export interface FScoreResult {
  score: number;       // 0..9
  max: number;         // 9
  criteria: { label: string; pass: boolean }[];
  label: 'Solide' | 'Moyen' | 'Faible';
  reliable: boolean;
}

function ratio(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

const UNRELIABLE: FScoreResult = { score: 0, max: 9, criteria: [], label: 'Faible', reliable: false };

export function computeFScore(curr: FScoreYear, prev: FScoreYear): FScoreResult {
  // Garde-fous : champs clés présents et plausibles.
  if (
    curr.total_actifs == null || curr.total_actifs <= 0 ||
    prev.total_actifs == null || prev.total_actifs <= 0 ||
    curr.resultat_net == null || curr.revenu_total == null
  ) return { ...UNRELIABLE };

  const roaC = ratio(curr.resultat_net, curr.total_actifs);
  const roaP = ratio(prev.resultat_net, prev.total_actifs);
  const cfo = curr.flux_exploitation;
  const levC = ratio(curr.dette_long_terme, curr.total_actifs);
  const levP = ratio(prev.dette_long_terme, prev.total_actifs);
  const crC = ratio(curr.total_actif_circulant, curr.passif_courant);
  const crP = ratio(prev.total_actif_circulant, prev.passif_courant);
  const gmC = ratio(curr.marge_brute, curr.revenu_total);
  const gmP = ratio(prev.marge_brute, prev.revenu_total);
  const atC = ratio(curr.revenu_total, curr.total_actifs);
  const atP = ratio(prev.revenu_total, prev.total_actifs);

  const criteria: { label: string; pass: boolean }[] = [
    { label: 'ROA positif', pass: (roaC ?? -1) > 0 },
    { label: 'Cash-flow d’exploitation positif', pass: (cfo ?? -1) > 0 },
    { label: 'ROA en hausse', pass: roaC != null && roaP != null && roaC > roaP },
    { label: 'CFO > résultat net (qualité des bénéfices)', pass: cfo != null && curr.resultat_net != null && cfo > curr.resultat_net },
    { label: 'Endettement long terme en baisse', pass: levC != null && levP != null && levC < levP },
    { label: 'Liquidité générale en hausse', pass: crC != null && crP != null && crC > crP },
    { label: 'Pas de dilution (actions stables/réduites)', pass: curr.actions_en_circulation != null && prev.actions_en_circulation != null && curr.actions_en_circulation <= prev.actions_en_circulation },
    { label: 'Marge brute en hausse', pass: gmC != null && gmP != null && gmC > gmP },
    { label: 'Rotation de l’actif en hausse', pass: atC != null && atP != null && atC > atP },
  ];

  const score = criteria.filter((c) => c.pass).length;
  const label: FScoreResult['label'] = score >= 7 ? 'Solide' : score >= 4 ? 'Moyen' : 'Faible';
  return { score, max: 9, criteria, label, reliable: true };
}
