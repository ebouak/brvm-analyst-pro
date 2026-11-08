export interface Noeud { cle: string; libelle: string; valeur: number }
export interface FluxCR { ressources: Noeud[]; emplois: Noeud[]; total: number }

/**
 * Ressources = CA + hors exploitation positif + perte (+ produit d'impôt) ;
 * emplois = charges d'exploitation (CA − résultat d'exploitation) + hors exploitation négatif + impôt + bénéfice.
 * Quatre postes publiés suffisent ; un poste manquant → null, jamais un flux estimé.
 */
export function fluxCompteResultat(p: { chiffreAffaires: number | null; resultatExploitation: number | null; resultatAvantImpot: number | null; resultatNet: number | null }): FluxCR | null {
  const { chiffreAffaires: ca, resultatExploitation: re, resultatAvantImpot: rai, resultatNet: rn } = p;
  if (ca == null || re == null || rai == null || rn == null) return null;
  if (ca <= 0 || ca - re < 0) return null; // CA non comparable (ex. banques)
  const hors = rai - re, impot = rai - rn;
  const ressources: Noeud[] = [{ cle: 'chiffreAffaires', libelle: "Chiffre d'affaires", valeur: ca }];
  const emplois: Noeud[] = [{ cle: 'chargesExploitation', libelle: "Charges d'exploitation", valeur: ca - re }];
  if (hors !== 0) (hors > 0 ? ressources : emplois).push({ cle: 'horsExploitation', libelle: 'Hors exploitation', valeur: Math.abs(hors) });
  if (impot > 0) emplois.push({ cle: 'impot', libelle: 'Impôt', valeur: impot });
  else if (impot < 0) ressources.push({ cle: 'impot', libelle: "Produit d'impôt", valeur: -impot });
  if (rn < 0) ressources.push({ cle: 'perte', libelle: "Perte de l'exercice", valeur: -rn });
  else if (rn > 0) emplois.push({ cle: 'benefice', libelle: "Bénéfice de l'exercice", valeur: rn });
  return { ressources, emplois, total: ressources.reduce((a, n) => a + n.valeur, 0) };
}

export interface FluxBilan { actif: Noeud; passifs: Noeud[] }

/**
 * Actif total → capitaux propres, dette financière, autres passifs (solde).
 * Un terme manquant, un actif ≤ 0, ou un terme négatif (aucune bande de hauteur négative) → null.
 */
export function fluxBilan(p: { totalActif: number | null; capitauxPropres: number | null; detteFinanciere: number | null }): FluxBilan | null {
  const { totalActif: ta, capitauxPropres: cp, detteFinanciere: dette } = p;
  if (ta == null || cp == null || dette == null) return null;
  if (ta <= 0 || cp < 0 || dette < 0) return null;
  const autres = ta - cp - dette;
  if (autres < 0) return null;
  const passifs: Noeud[] = [
    { cle: 'capitauxPropres', libelle: 'Capitaux propres', valeur: cp },
    { cle: 'detteFinanciere', libelle: 'Dette financière', valeur: dette },
    { cle: 'autresPassifs', libelle: 'Autres passifs', valeur: autres },
  ];
  return { actif: { cle: 'actif', libelle: 'Total actif', valeur: ta }, passifs };
}
