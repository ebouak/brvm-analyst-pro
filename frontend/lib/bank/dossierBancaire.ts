import { borner, type ListeBornee } from '@/lib/dossier/bornes';
import type { Agregat, LectureBancaire, LigneAgregat, PeriodeBancaire, Unite } from './lecture';

/**
 * Version bancaire des feuilles « trajectoire » et « origine du bénéfice » du
 * dossier — PUR. Aucun chiffre calculé ici : la cascade vient de
 * lib/bank/cascade.ts (gabarit Academy), les montants de lib/bank/lecture.ts.
 */

/** Point annuel de la trajectoire (même forme que lib/dossier/build.ts, sans l'importer : module pur). */
export interface PointTrajectoire {
  exercice: string;
  chiffre_affaires: number | null;
  resultat_net: number | null;
}

export interface PnbExercice {
  exercice: string;
  /** PNB SOURCÉ de l'exercice, ou null (valeur de base sans document). */
  pnb: number | null;
  unite: Unite | null;
}

/** PNB sourcé de chaque exercice, du plus récent au plus ancien. */
export function pnbParExercice(periodes: PeriodeBancaire[]): PnbExercice[] {
  return periodes
    .filter((p) => p.code === 'exercice')
    .map((p) => {
      const v = p.valeurs.pnb?.source ? p.valeurs.pnb : null;
      return { exercice: String(p.annee), pnb: v ? v.valeur : null, unite: v ? v.unite : null };
    });
}

/**
 * Le PNB retenu remplace la colonne de revenu de l'exercice. Le graphique est
 * en FCFA : un PNB publié dans une autre unité (USD, ETIT) ne remplace rien —
 * jamais deux unités sur une même échelle, jamais de conversion.
 */
export function trajectoireBancaire<P extends PointTrajectoire>(base: P[], sourcee: PnbExercice[]): P[] {
  const pnb = new Map(sourcee.filter((s) => s.pnb != null && s.unite === 'fcfa').map((s) => [s.exercice, s.pnb!]));
  return base.map((p) => (pnb.has(p.exercice) ? { ...p, chiffre_affaires: pnb.get(p.exercice)! } : p));
}

const PRIORITE: Agregat[] = ['solvabilite_total', 'credits_clientele', 'depots_clientele', 'fonds_propres', 'creances_souffrance_brutes', 'taux_creances_souffrance', 'couverture_creances_souffrance', 'ratio_cet1', 'ratio_tier1', 'total_bilan'];

/** Encours affichés sous la cascade : solvabilité d'abord, au plus `max`, le reste compté (lib/dossier/bornes). */
export function encoursDossier(l: LectureBancaire, max: number): ListeBornee<LigneAgregat> {
  const tries = [...l.encours].sort((a, b) => PRIORITE.indexOf(a.cle) - PRIORITE.indexOf(b.cle));
  return borner(tries, max);
}
