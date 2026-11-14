/**
 * Verdict de valorisation : ce que disent les méthodes, avec leurs limites.
 * Fonction pure et testable.
 *
 * Vocabulaire (2026-11-13) : « valeur estimée au-dessus / en dessous du cours »,
 * plus de « décote », de « surcote » ni de « juste prix ». Un verdict n'est donné
 * que si les méthodes retenues sont du même côté du cours ; sinon « méthodes en
 * désaccord », avec la fourchette. Les clés `decote` / `surcote` restent les
 * identifiants internes (tri, couleurs) : seul le texte affiché a changé.
 */

import { fmtFcfa, fmtNumber, fmtPctSigne } from '@/lib/format';
import type { ValuationMetrics } from './metrics';
import type { FairValueResult } from './fairValue';
import type { QualityScore } from './quality';

export interface ValuationVerdict {
  stance: 'decote' | 'surcote' | 'proche' | 'desaccord' | 'non_estimable' | 'indisponible';
  headline: string;
  rationale: string[];
  cautions: string[];
}

/** Exercice des comptes retenus. `tropAncien` : plus de deux ans avant l'année en cours. */
export interface ExerciceRetenu {
  annee: number | null;
  tropAncien: boolean;
}

const UPSIDE_BAND = 0.15; // ±15 % = « proche de la valeur estimée »
/** Au-delà, l'écart s'affiche plafonné : la précision serait illusoire. */
export const ECART_PLAFOND = 0.6;

/** Écart affiché : signé, au format français, plafonné à ±60 %. */
export function ecartAffiche(upside: number): string {
  if (upside > ECART_PLAFOND) return 'plus de +60 %';
  if (upside < -ECART_PLAFOND) return 'plus de −60 %';
  return fmtPctSigne(upside * 100, 0);
}

export function buildVerdict(
  m: ValuationMetrics,
  fv: FairValueResult,
  q: QualityScore,
  exercice?: ExerciceRetenu,
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

  if (exercice?.annee != null) rationale.push(`Comptes de l’exercice ${exercice.annee}.`);
  if (m.per != null) rationale.push(`P/E ${fmtNumber(m.per, 1)}.`);
  if (m.pbr != null) rationale.push(`P/B ${fmtNumber(m.pbr, 2)}.`);
  if (m.roe != null) rationale.push(`ROE ${fmtNumber(m.roe * 100, 1)} %.`);
  if (m.dividendYield != null) rationale.push(`Rendement du dividende ${fmtNumber(m.dividendYield * 100, 1)} %.`);
  rationale.push(`Qualité fondamentale : ${q.label.toLowerCase()} (${q.score}/${q.max}).`);

  const rendement = () => {
    if (fv.byDDM != null && fv.ddmAssumptions) {
      cautions.push(
        `Valeur de rendement, hors estimation : ${fmtFcfa(fv.byDDM)} FCFA (dividende net ÷ ${fmtNumber(fv.ddmAssumptions.r * 100, 0)} %, croissance ${fmtNumber(fv.ddmAssumptions.g * 100, 0)} %).`,
      );
    }
  };

  if (exercice?.tropAncien) {
    rendement();
    return {
      stance: 'non_estimable',
      headline: 'Non estimable : comptes trop anciens',
      rationale,
      cautions: [`Les derniers comptes exploitables datent de ${exercice.annee ?? 'plus de deux ans'} : une estimation sur cette base serait trompeuse.`, ...cautions],
    };
  }

  if (fv.exclusion === 'resultat_insuffisant') {
    rendement();
    return {
      stance: 'non_estimable',
      headline: 'Non estimable : résultat insuffisant',
      rationale,
      cautions: ['Résultat nul, négatif ou trop faible (ROE ≤ 2 %) : les multiples de résultat et de fonds propres ne s’appliquent pas.', ...cautions],
    };
  }

  if (fv.perEcarte) {
    cautions.push('Méthode P/E écartée : P/E inférieur à 3 ou ROE supérieur à 50 %, signe probable d’un résultat exceptionnel.');
  }

  let stance: ValuationVerdict['stance'];
  let headline: string;

  if (fv.upside == null) {
    stance = 'indisponible';
    headline = 'Valeur estimée non calculable';
    cautions.push('Le nombre d’actions ou les multiples des pairs manquent.');
  } else if (fv.accord === 'desaccord') {
    stance = 'desaccord';
    headline = 'Méthodes en désaccord';
    if (fv.basse != null && fv.haute != null) {
      rationale.push(`Selon la méthode, la valeur estimée va de ${fmtFcfa(fv.basse)} à ${fmtFcfa(fv.haute)} FCFA, de part et d’autre du cours.`);
    }
  } else if (fv.upside > UPSIDE_BAND) {
    stance = 'decote';
    headline = `Valeur estimée au-dessus du cours (${ecartAffiche(fv.upside)})`;
    rationale.push(`Méthodes retenues : ${fv.methods.join(', ')}.`);
  } else if (fv.upside < -UPSIDE_BAND) {
    stance = 'surcote';
    headline = `Valeur estimée en dessous du cours (${ecartAffiche(fv.upside)})`;
    rationale.push(`Méthodes retenues : ${fv.methods.join(', ')}.`);
  } else {
    stance = 'proche';
    headline = 'Proche de la valeur estimée';
    rationale.push(`Écart avec le cours : ${ecartAffiche(fv.upside)}.`);
  }

  if (stance === 'decote' && q.label === 'Fragile') {
    cautions.push('Valeur estimée au-dessus du cours, mais qualité fondamentale fragile : un cours bas peut être justifié.');
  }
  rendement();

  return { stance, headline, rationale, cautions };
}
