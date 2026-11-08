import { bpaAffichable } from './affichage';

interface LigneResultat { resultat_net: number | null; benefice_par_action: number | null }

/**
 * BPA des exercices : la valeur publiée manque souvent alors que résultat net et
 * nombre de titres sont connus. Le plus récent exercice (premier du tableau) est
 * toujours recalculé avec `bpaAffichable`, comme la fiche : un chiffre, une source.
 * Les exercices antérieurs gardent leur BPA publié ; sans lui, on le calcule.
 */
export function avecBpaCalcule<T extends LigneResultat>(statements: T[], titres: number | null): T[] {
  return statements.map((s, i) => {
    const calcule = bpaAffichable(s.resultat_net, titres).valeur;
    if (calcule == null) return s;
    if (i === 0 || s.benefice_par_action == null) return { ...s, benefice_par_action: calcule };
    return s;
  });
}

/** Croissance signée du résultat net : seulement quand les deux exercices sont bénéficiaires. */
export function croissanceRnSignee(rn: number | null, rnPrecedent: number | null, pct: number | null): number | null {
  if (rn == null || rnPrecedent == null || !(rn > 0) || !(rnPrecedent > 0)) return null;
  return pct;
}

export function libelleValorisationSimplifiee(): string {
  return 'Valorisation simplifiée (Graham, PER, P/B)';
}
