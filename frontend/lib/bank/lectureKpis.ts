import type { BankKpis } from './kpis';
import type { LectureBancaire } from './lecture';

/**
 * La carte « Analyse bancaire » affiche le même coefficient d'exploitation,
 * la même transformation et la même solvabilité que la Revue et le dossier :
 * quand une lecture extraite existe, ses ratios remplacent ceux de
 * computeBankKpis.
 *
 * Coefficient d'exploitation (avenant du 2026-11-15) : SEUL celui de la
 * lecture (charges d'exploitation ÷ PNB) s'affiche. computeBankKpis calcule
 * « frais généraux ÷ PNB », une autre définition qui donnerait un autre
 * chiffre que la Revue : sans lecture, la carte n'en affiche aucun.
 */
export function appliquerLecture(kpis: BankKpis, lecture: LectureBancaire | null): BankKpis {
  if (!lecture?.extrait) return { ...kpis, costIncome: null };
  const ratio = (cle: string) => lecture.ratios.find((r) => r.cle === cle)?.valeur;
  const solva = lecture.encours.find((l) => l.cle === 'solvabilite_total');
  return {
    ...kpis,
    costIncome: ratio('coefficient_exploitation') ?? null,
    transformation: ratio('credits_sur_depots') ?? kpis.transformation,
    ratioSolvabilite: solva && solva.unite === 'pct' ? solva.valeur.valeur / 100 : kpis.ratioSolvabilite,
  };
}
