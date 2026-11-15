/**
 * Catalogue des agrégats bancaires extraits des documents publiés — PUR.
 * Spec 2026-11-15 §3. Source unique de la correspondance indicateur →
 * (table, clé de lignes_specifiques). Un ratio CALCULÉ n'apparaît jamais ici :
 * il est dérivé à l'affichage (frontend/lib/bank/lecture.ts). Le coefficient
 * d'exploitation déjà stocké sert seulement de recoupement (controles.ts).
 *
 * Signes : charges d'intérêts, charges d'exploitation et coût du risque sont
 * stockés tels qu'imprimés ; un coût du risque négatif est une reprise nette
 * (même convention que src/annuel/complement.ts).
 *
 * ⚠️ Copié dans frontend/lib/agregats/pure/ (scripts/copier-agregats-purs.mjs,
 * vérifié par copie.test.ts) : corriger ICI, puis relancer le script.
 */
export type Nature = 'flux' | 'encours' | 'ratio';
export type TableCible = 'income_statements' | 'balance_sheets';

export interface DefIndicateur {
  indicateur: string;
  libelle: string;
  nature: Nature;
  table: TableCible;
  /** Clé de lignes_specifiques ; null = lu pour recoupement seulement. */
  cle: string | null;
}

export const AGREGATS: readonly DefIndicateur[] = [
  { indicateur: 'pnb', libelle: 'Produit net bancaire', nature: 'flux', table: 'income_statements', cle: 'pnb' },
  { indicateur: 'produits_interets', libelle: 'Intérêts et produits assimilés', nature: 'flux', table: 'income_statements', cle: 'produit_interets' },
  { indicateur: 'charges_interets', libelle: 'Intérêts et charges assimilées', nature: 'flux', table: 'income_statements', cle: 'charges_interets' },
  { indicateur: 'marge_interets', libelle: 'Marge d’intérêts', nature: 'flux', table: 'income_statements', cle: 'marge_interets' },
  { indicateur: 'commissions_nettes', libelle: 'Commissions nettes', nature: 'flux', table: 'income_statements', cle: 'commissions_nettes' },
  { indicateur: 'charges_exploitation', libelle: 'Charges d’exploitation', nature: 'flux', table: 'income_statements', cle: 'charges_exploitation' },
  { indicateur: 'resultat_brut_exploitation', libelle: 'Résultat brut d’exploitation', nature: 'flux', table: 'income_statements', cle: 'resultat_brut_exploitation' },
  { indicateur: 'cout_du_risque', libelle: 'Coût du risque', nature: 'flux', table: 'income_statements', cle: 'cout_du_risque' },
  { indicateur: 'resultat_net', libelle: 'Résultat net', nature: 'flux', table: 'income_statements', cle: null },
  { indicateur: 'total_bilan', libelle: 'Total du bilan', nature: 'encours', table: 'balance_sheets', cle: 'total_bilan' },
  { indicateur: 'credits_clientele', libelle: 'Crédits à la clientèle', nature: 'encours', table: 'balance_sheets', cle: 'credits_clientele' },
  { indicateur: 'depots_clientele', libelle: 'Dépôts de la clientèle', nature: 'encours', table: 'balance_sheets', cle: 'depots_clientele' },
  { indicateur: 'fonds_propres', libelle: 'Fonds propres', nature: 'encours', table: 'balance_sheets', cle: 'fonds_propres' },
  { indicateur: 'creances_souffrance_brutes', libelle: 'Créances en souffrance brutes', nature: 'encours', table: 'balance_sheets', cle: 'creances_souffrance_brutes' },
  { indicateur: 'taux_creances_souffrance', libelle: 'Taux de créances en souffrance', nature: 'ratio', table: 'balance_sheets', cle: 'taux_creances_souffrance' },
  { indicateur: 'couverture_creances_souffrance', libelle: 'Couverture des créances en souffrance', nature: 'ratio', table: 'balance_sheets', cle: 'couverture_creances_souffrance' },
  { indicateur: 'solvabilite_total', libelle: 'Solvabilité totale', nature: 'ratio', table: 'balance_sheets', cle: 'ratio_solvabilite' },
  { indicateur: 'ratio_cet1', libelle: 'Ratio CET1', nature: 'ratio', table: 'balance_sheets', cle: 'ratio_cet1' },
  { indicateur: 'ratio_tier1', libelle: 'Ratio Tier 1', nature: 'ratio', table: 'balance_sheets', cle: 'ratio_tier1' },
];

export const INDICATEURS_AGREGATS: string[] = AGREGATS.map((a) => a.indicateur);

const PAR_INDICATEUR = new Map(AGREGATS.map((a) => [a.indicateur, a]));

export function defDe(indicateur: string): DefIndicateur | null {
  return PAR_INDICATEUR.get(indicateur) ?? null;
}
