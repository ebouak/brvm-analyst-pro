/**
 * Garde-fous de l'import IA. Les valeurs reçues du LLM sont en MILLIONS de FCFA
 * (sauf eps/shares). Une société cotée BRVM a un CA / capitaux propres de l'ordre
 * de plusieurs milliards FCFA, soit au moins ~1000 (en millions). Une valeur
 * positive mais < ce seuil trahit une erreur d'unité ou une extraction ratée
 * (ex. FTSC CA=3) → suspecte. Statut global :
 *  - 'auto'   : aucune valeur suspecte -> écriture directe possible
 *  - 'review' : >= 1 valeur suspecte  -> validation manuelle requise
 */

export interface FundamentalExtraction {
  revenue: number | null;
  net_income: number | null;
  equity: number | null;
  debt_total: number | null;
  cash: number | null;
  eps: number | null;
  dividend_per_share: number | null;
  shares_outstanding: number | null;
}

export interface ValidationResult {
  status: 'auto' | 'review';
  suspects: string[]; // noms des champs suspects
}

/** Seuil de plausibilité en MILLIONS de FCFA (≈ 1 milliard FCFA). */
const MIN_PLAUSIBLE_M = 1_000;

/** Un montant non nul mais d'amplitude < 1 Md FCFA est suspect (erreur d'unité). */
function isSuspect(valueM: number | null): boolean {
  return valueM != null && Math.abs(valueM) < MIN_PLAUSIBLE_M;
}

export function validateExtraction(x: FundamentalExtraction): ValidationResult {
  const suspects: string[] = [];
  // CA et capitaux propres doivent dépasser ~1 Md FCFA. Le résultat net peut être
  // plus faible (petites sociétés, pertes), on ne le contrôle pas par ce seuil.
  if (isSuspect(x.revenue)) suspects.push('revenue');
  if (isSuspect(x.equity)) suspects.push('equity');
  return { status: suspects.length === 0 ? 'auto' : 'review', suspects };
}
