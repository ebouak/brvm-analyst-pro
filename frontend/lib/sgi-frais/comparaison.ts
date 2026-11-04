/**
 * Comparaison de 2 ou 3 SGI sur un même scénario. Pur et testé : chaque
 * constat est dérivé des données et porte le chiffre qui le justifie ; un
 * fait absent n'est jamais affirmé.
 */
export interface LigneComparee {
  nom: string;
  total: number;
  /** Courtage, garde et tenue de compte tous connus. */
  complet: boolean;
  /** Barème lu dans une décision d'homologation. */
  homologue: boolean;
  /** Dépôt minimum relevé (FCFA) ; null ou 0 : non publié. */
  depotMinimum: number | null;
  /** Des frais de « bourse en ligne » figurent au barème. */
  bourseEnLigne: boolean;
}

export const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/** La moins chère parmi les barèmes COMPLETS ; null si aucun. */
export function meilleureLigne(lignes: LigneComparee[]): LigneComparee | null {
  return lignes.filter((l) => l.complet).sort((a, b) => a.total - b.total)[0] ?? null;
}

/** Écart d'une SGI à la moins chère, en FCFA et en % du coût de la moins chère. */
export function ecartALaMeilleure(ligne: LigneComparee, meilleure: LigneComparee | null): { montant: number; pct: number } | null {
  if (!meilleure || ligne.nom === meilleure.nom || !ligne.complet || meilleure.total <= 0) return null;
  const montant = ligne.total - meilleure.total;
  return { montant, pct: (montant / meilleure.total) * 100 };
}

const liste = (noms: string[]) => (noms.length <= 1 ? noms.join('') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`);

export function constatsComparaison(lignes: LigneComparee[]): string[] {
  const constats: string[] = [];
  const meilleure = meilleureLigne(lignes);
  const completes = lignes.filter((l) => l.complet).sort((a, b) => a.total - b.total);

  if (meilleure) constats.push(`${meilleure.nom} affiche le coût total le plus faible pour ce scénario : ${fmtFcfa(meilleure.total)}.`);
  if (completes.length >= 2) {
    const plusChere = completes[completes.length - 1]!;
    const e = ecartALaMeilleure(plusChere, meilleure);
    if (e && e.montant > 0) {
      constats.push(`Écart entre la moins chère et la plus chère : ${fmtFcfa(e.montant)}, soit ${e.pct.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} % de plus.`);
    } else if (e) {
      constats.push('Les barèmes comparés donnent le même coût total pour ce scénario.');
    }
  }
  const incompletes = lignes.filter((l) => !l.complet).map((l) => l.nom);
  if (incompletes.length) constats.push(`Barème incomplet pour ${liste(incompletes)} : coût sous-estimé, jamais classé comme le moins cher.`);
  const agreges = lignes.filter((l) => !l.homologue).map((l) => l.nom);
  if (agreges.length) constats.push(`${liste(agreges)} : barème agrégé de sources publiques, à confirmer auprès de la SGI.`);
  const enLigne = lignes.filter((l) => l.bourseEnLigne).map((l) => l.nom);
  if (enLigne.length) constats.push(`Bourse en ligne facturée au barème homologué : ${liste(enLigne)}.`);
  const depots = lignes.filter((l) => l.depotMinimum != null && l.depotMinimum > 0).sort((a, b) => a.depotMinimum! - b.depotMinimum!);
  if (depots.length) constats.push(`Dépôt minimum relevé le plus bas : ${depots[0]!.nom} (${fmtFcfa(depots[0]!.depotMinimum!)}, à confirmer auprès de la SGI).`);
  return constats;
}
