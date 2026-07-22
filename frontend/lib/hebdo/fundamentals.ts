/**
 * Éclairage fondamental d'une valeur — PUR, testé. On ne cite un chiffre que
 * s'il est NOTABLE (perte, forte variation, PER extrême, gros rendement) :
 * sinon la section est omise plutôt que remplie de banalités.
 * Seuils validés par le propriétaire produit (spec §3).
 */
import { fmtMontant } from './format';

export interface IncomeRow {
  periode: string;
  resultat_net: number | null;
  benefice_par_action: number | null;
  dividende_par_action: number | null;
}

export interface NotableFundamental {
  phrase: string;
  /** Chiffres à ajouter à la whitelist du garde-fou. */
  chiffres: number[];
}

const VARIATION_NOTABLE = 30; // %
const PER_BAS = 5;
const PER_HAUT = 25;
const RENDEMENT_NOTABLE = 6; // %

const r1 = (x: number) => Math.round(x * 10) / 10;

export function pickNotableFundamental(rows: IncomeRow[], cours: number): NotableFundamental | null {
  const annuels = [...rows]
    .filter((r) => r.periode)
    .sort((a, b) => b.periode.localeCompare(a.periode));
  const dernier = annuels[0];
  if (!dernier) return null;
  const annee = dernier.periode;

  // 1. Perte — toujours notable.
  if (dernier.resultat_net != null && dernier.resultat_net < 0) {
    const abs = Math.abs(dernier.resultat_net);
    return {
      phrase: `La société a publié une perte de ${fmtMontant(dernier.resultat_net)} sur l'exercice ${annee}.`,
      chiffres: [r1(abs >= 1e9 ? abs / 1e9 : abs / 1e6), Number(annee)],
    };
  }

  // 2. Variation du résultat net ≥ 30 %.
  const precedent = annuels[1];
  if (
    dernier.resultat_net != null && dernier.resultat_net > 0 &&
    precedent?.resultat_net != null && precedent.resultat_net > 0
  ) {
    const varPct = ((dernier.resultat_net - precedent.resultat_net) / precedent.resultat_net) * 100;
    if (Math.abs(varPct) >= VARIATION_NOTABLE) {
      const sens = varPct >= 0 ? 'progressé' : 'reculé';
      return {
        phrase: `Son bénéfice a ${sens} de ${Math.abs(r1(varPct))} % sur le dernier exercice (${annee}).`,
        chiffres: [Math.abs(r1(varPct)), Number(annee)],
      };
    }
  }

  // 3. PER extrême.
  if (dernier.benefice_par_action != null && dernier.benefice_par_action > 0 && cours > 0) {
    const per = cours / dernier.benefice_par_action;
    if (per < PER_BAS || per > PER_HAUT) {
      const niveau = per < PER_BAS ? 'bas' : 'élevé';
      return {
        phrase: `Le titre se paie ${r1(per)} fois les bénéfices de ${annee}, un niveau ${niveau} pour la cote.`,
        chiffres: [r1(per), Number(annee)],
      };
    }
  }

  // 4. Rendement du dividende.
  if (dernier.dividende_par_action != null && dernier.dividende_par_action > 0 && cours > 0) {
    const rendement = (dernier.dividende_par_action / cours) * 100;
    if (rendement >= RENDEMENT_NOTABLE) {
      return {
        phrase: `Le dividende versé au titre de ${annee} représente ${r1(rendement)} % du cours actuel.`,
        chiffres: [r1(rendement), Number(annee)],
      };
    }
  }

  return null;
}
