/**
 * Évaluation de la LIQUIDITÉ des actions BRVM — enjeu n°1 du marché (nombre
 * de titres traitant peu ou pas chaque séance). Fonctions pures, testées.
 *
 * Score 0-100 combinant deux réalités mesurables (jamais de carnet d'ordres :
 * la profondeur n'est pas publiée par la BRVM — on ne l'invente pas) :
 *   - présence  (50 %) : part des séances où le titre a réellement traité ;
 *   - activité  (50 %) : valeur moyenne échangée par séance, sur échelle
 *     logarithmique 100 k → 100 M FCFA (au-delà, plafonné).
 */

export interface LiquiditySessionRow {
  volume: number | null;
  cours_jour: number | null;
  valeur_echangee?: number | null;
}

export type LiquidityClass = 'A' | 'B' | 'C' | 'D';

export interface LiquidityScore {
  score: number; // 0-100
  classe: LiquidityClass;
  label: string;
  /** Valeur moyenne échangée par séance observée (FCFA) — estimée cours×volume si absente. */
  valeurMoyenne: number;
  /** % de séances où le titre a traité (volume > 0). */
  presencePct: number;
  nbSeances: number;
}

export const LIQUIDITY_LABELS: Record<LiquidityClass, string> = {
  A: 'Très liquide',
  B: 'Liquidité correcte',
  C: 'Liquidité faible',
  D: 'Très illiquide',
};

const LOG_FLOOR = 100_000;     // 100 k FCFA/séance → 0 point d'activité
const LOG_CEIL = 100_000_000;  // 100 M FCFA/séance → plein score d'activité

export function classifyLiquidity(score: number): LiquidityClass {
  if (score >= 75) return 'A';
  if (score >= 50) return 'B';
  if (score >= 25) return 'C';
  return 'D';
}

/**
 * Calcule le score de liquidité d'un titre à partir de ses lignes de séance
 * (période recommandée : ~30 séances). `nbSeancesMarche` = nombre total de
 * séances du marché sur la période (les absences comptent comme non-traitées).
 */
export function computeLiquidity(
  rows: LiquiditySessionRow[],
  nbSeancesMarche: number,
): LiquidityScore | null {
  if (nbSeancesMarche <= 0) return null;

  let seancesTraitees = 0;
  let valeurTotale = 0;
  for (const r of rows) {
    const vol = r.volume ?? 0;
    if (vol > 0) {
      seancesTraitees += 1;
      const valeur = r.valeur_echangee ?? (r.cours_jour != null ? r.cours_jour * vol : 0);
      valeurTotale += valeur;
    }
  }

  const presencePct = Math.min(100, (seancesTraitees / nbSeancesMarche) * 100);
  const valeurMoyenne = valeurTotale / nbSeancesMarche;

  // Activité sur échelle log : 100k → 0, 100M → 1 (clampé).
  const activite =
    valeurMoyenne <= LOG_FLOOR
      ? 0
      : Math.min(1, Math.log10(valeurMoyenne / LOG_FLOOR) / Math.log10(LOG_CEIL / LOG_FLOOR));

  const score = Math.round(0.5 * presencePct + 50 * activite);
  const classe = classifyLiquidity(score);
  return {
    score,
    classe,
    label: LIQUIDITY_LABELS[classe],
    valeurMoyenne,
    presencePct: Math.round(presencePct),
    nbSeances: nbSeancesMarche,
  };
}
