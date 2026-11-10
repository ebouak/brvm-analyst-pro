import { fmtDateCourte } from '@/lib/format';

/** Les quatre états d'absence de la spec v2 § 6. Jamais de tiret ni de zéro par défaut. */
export type EtatAbsence =
  | { etat: 'non_collecte' }
  | { etat: 'non_publie'; verifieLe: string }
  | { etat: 'sans_objet' }
  | { etat: 'ancien'; date: string };

export function texteAbsence(a: EtatAbsence): string {
  switch (a.etat) {
    case 'non_collecte': return 'Pas encore collecté par WESTBOURSE.';
    case 'non_publie': return `Non publié par la société ni par la BRVM à notre connaissance (vérifié le ${fmtDateCourte(a.verifieLe)}).`;
    case 'sans_objet': return 'Sans objet pour cette société.';
    case 'ancien': return `Dernière donnée connue : ${fmtDateCourte(a.date)}.`;
  }
}
