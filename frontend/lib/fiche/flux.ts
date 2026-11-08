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
  const hors = rai - re, impot = rai - rn;
  const ressources: Noeud[] = [{ cle: 'chiffreAffaires', libelle: "Chiffre d'affaires", valeur: ca }];
  const emplois: Noeud[] = [{ cle: 'chargesExploitation', libelle: "Charges d'exploitation", valeur: ca - re }];
  (hors >= 0 ? ressources : emplois).push({ cle: 'horsExploitation', libelle: 'Hors exploitation', valeur: Math.abs(hors) });
  if (impot >= 0) emplois.push({ cle: 'impot', libelle: 'Impôt', valeur: impot });
  else ressources.push({ cle: 'impot', libelle: "Produit d'impôt", valeur: -impot });
  if (rn < 0) ressources.push({ cle: 'perte', libelle: "Perte de l'exercice", valeur: -rn });
  else emplois.push({ cle: 'benefice', libelle: "Bénéfice de l'exercice", valeur: rn });
  return { ressources, emplois, total: ressources.reduce((a, n) => a + n.valeur, 0) };
}
