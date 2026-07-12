/**
 * Cascade des états financiers PAR FAMILLE COMPTABLE.
 *
 * Une banque ne présente pas un « coût des ventes » ni une « marge brute », et
 * une compagnie d'assurance ne raisonne pas en « stocks » : leur ligne maîtresse
 * est le Produit Net Bancaire / les primes acquises. Ce module décrit, pour
 * chaque famille, l'ordre comptable réel des postes — en puisant indifféremment
 * dans les colonnes standard ET dans `lignes_specifiques` (jsonb), de sorte que
 * les postes sectoriels soient intégrés AU BON ENDROIT de la cascade plutôt que
 * relégués dans un encadré séparé.
 *
 * Fonctions pures (testées dans statementRows.test.mjs).
 */
import type { Famille } from './sectors';

/** Unité d'affichage — évite d'afficher un nombre d'actions en FCFA. */
export type RowFormat = 'xof' | 'pct' | 'count' | 'perShare';

export interface StatementRow {
  /** Colonne standard, ou clé de `lignes_specifiques` si `specific` est vrai. */
  key: string;
  label: string;
  bold?: boolean;
  indent?: boolean;
  /** Ligne d'en-tête de section (bilan) — pas de valeur. */
  section?: boolean;
  /** Lire la valeur dans `lignes_specifiques` au lieu de la colonne. */
  specific?: boolean;
  format?: RowFormat;
}

/** Ligne d'états financiers : colonnes standard + lignes_specifiques. */
export interface StatementLike {
  periode: string;
  lignes_specifiques?: Record<string, number | null> | null;
}

/** Valeur d'un poste pour une période (colonne standard ou ligne spécifique). */
export function getRowValue<T extends StatementLike>(row: StatementRow, s: T): number | null {
  if (row.section) return null;
  const raw = row.specific
    ? s.lignes_specifiques?.[row.key]
    : (s as Record<string, unknown>)[row.key];
  return typeof raw === 'number' ? raw : null;
}

/**
 * Retire les postes sans aucune valeur sur toutes les périodes (une table de
 * tirets ne dit rien), ainsi que les en-têtes de section devenues vides.
 */
export function visibleRows<T extends StatementLike>(
  rows: StatementRow[],
  statements: T[],
): StatementRow[] {
  const kept = rows.filter(
    (r) => r.section || statements.some((s) => getRowValue(r, s) != null),
  );
  // Une section n'est conservée que si elle est suivie d'au moins un poste.
  return kept.filter((r, i) => {
    if (!r.section) return true;
    const next = kept[i + 1];
    return next != null && !next.section;
  });
}

/* ── Compte de résultat ──────────────────────────────────────────────────── */

const RESULTAT_COMMUN: StatementRow[] = [
  { key: 'resultat_exploitation', label: "Résultat d'exploitation", bold: true },
  { key: 'charges_financieres_nettes', label: 'Charges financières nettes' },
  { key: 'resultat_avant_impots', label: 'Résultat avant impôts', bold: true },
  { key: 'impots', label: 'Impôts' },
  { key: 'resultat_net', label: 'Résultat net', bold: true },
];

const PAR_ACTION: StatementRow[] = [
  { key: 'benefice_par_action', label: 'BPA (de base)', format: 'perShare' },
  { key: 'benefice_par_action_dilue', label: 'BPA (dilué)', format: 'perShare' },
  { key: 'dividende_par_action', label: 'Dividende par action', format: 'perShare' },
  { key: 'actions_en_circulation', label: 'Actions en circulation', format: 'count' },
];

export const INCOME_ROWS: Record<Famille, StatementRow[]> = {
  general: [
    { key: 'revenu_total', label: "Chiffre d'affaires", bold: true },
    { key: 'cout_ventes', label: 'Coût des ventes' },
    { key: 'marge_brute', label: 'Marge brute', bold: true },
    { key: 'depenses_exploitation', label: "Dépenses d'exploitation" },
    { key: 'frais_generaux_admin', label: 'Frais généraux et administratifs' },
    { key: 'depenses_rd', label: 'Recherche & développement' },
    { key: 'autres_depenses', label: 'Autres dépenses' },
    ...RESULTAT_COMMUN,
    ...PAR_ACTION,
  ],

  // Cascade bancaire : produits d'intérêts → marge d'intérêts → PNB (ligne
  // maîtresse) → charges → résultat. Ni coût des ventes ni marge brute.
  banque: [
    { key: 'produit_interets', label: "Produits d'intérêts", specific: true },
    { key: 'marge_interets', label: "Marge d'intérêts", specific: true, bold: true },
    { key: 'revenu_total', label: 'Total des produits bancaires' },
    { key: 'pnb', label: 'Produit Net Bancaire (PNB)', specific: true, bold: true },
    { key: 'frais_generaux_admin', label: "Frais généraux d'exploitation" },
    { key: 'depenses_exploitation', label: "Charges d'exploitation" },
    { key: 'coefficient_exploitation', label: "Coefficient d'exploitation", specific: true, format: 'pct' },
    { key: 'autres_depenses', label: 'Autres charges' },
    ...RESULTAT_COMMUN,
    ...PAR_ACTION,
  ],

  // Cascade assurance : primes → sinistres → résultat technique.
  assurance: [
    { key: 'primes_emises', label: 'Primes émises', specific: true },
    { key: 'primes_acquises', label: 'Primes acquises', specific: true, bold: true },
    { key: 'charges_sinistres', label: 'Charges de sinistres', specific: true },
    { key: 'frais_generaux_admin', label: 'Frais de gestion' },
    { key: 'depenses_exploitation', label: "Charges d'exploitation" },
    { key: 'ratio_combine', label: 'Ratio combiné', specific: true, format: 'pct' },
    { key: 'autres_depenses', label: 'Autres charges' },
    ...RESULTAT_COMMUN,
    ...PAR_ACTION,
  ],
};

/* ── Bilan ───────────────────────────────────────────────────────────────── */

const CAPITAUX_PROPRES: StatementRow[] = [
  { key: '__cp__', label: 'CAPITAUX PROPRES', section: true },
  { key: 'total_capitaux_propres', label: 'Total capitaux propres', bold: true },
  { key: 'capital_social', label: 'Capital social', indent: true },
  { key: 'reserves_benefices_non_repartis', label: 'Réserves & report à nouveau', indent: true },
  { key: 'autres_capitaux_propres', label: 'Autres capitaux propres', indent: true },
  { key: 'interets_minoritaires', label: 'Intérêts minoritaires', indent: true },
];

export const BALANCE_ROWS: Record<Famille, StatementRow[]> = {
  general: [
    { key: '__actif__', label: 'ACTIF', section: true },
    { key: 'total_actifs', label: 'Total des actifs', bold: true },
    { key: 'total_actif_circulant', label: 'Actif circulant', bold: true, indent: true },
    { key: 'tresorerie_equivalents', label: 'Trésorerie & équivalents', indent: true },
    { key: 'investissements_court_terme', label: 'Investissements court terme', indent: true },
    { key: 'creances_clients', label: 'Créances clients', indent: true },
    { key: 'stocks', label: 'Stocks', indent: true },
    { key: 'autres_actifs_courants', label: 'Autres actifs courants', indent: true },
    { key: 'total_actif_non_courant', label: 'Actif non courant', bold: true, indent: true },
    { key: 'immobilisations_nettes', label: 'Immobilisations nettes', indent: true },
    { key: 'goodwill', label: 'Goodwill', indent: true },
    { key: 'actifs_incorporels', label: 'Actifs incorporels', indent: true },
    { key: 'investissements_long_terme', label: 'Investissements long terme', indent: true },
    { key: 'autres_actifs_financiers', label: 'Autres actifs financiers', indent: true },

    { key: '__passif__', label: 'PASSIF', section: true },
    { key: 'total_passif', label: 'Total du passif', bold: true },
    { key: 'passif_courant', label: 'Passif courant', bold: true, indent: true },
    { key: 'fournisseurs', label: 'Fournisseurs', indent: true },
    { key: 'dette_court_terme', label: 'Dettes court terme', indent: true },
    { key: 'revenus_differes_courants', label: 'Revenus différés', indent: true },
    { key: 'autres_passifs_courants', label: 'Autres passifs courants', indent: true },
    { key: 'passif_non_courant', label: 'Passif non courant', bold: true, indent: true },
    { key: 'dette_long_terme', label: 'Dettes long terme', indent: true },
    { key: 'autres_passifs_non_courants', label: 'Autres passifs non courants', indent: true },
    { key: 'impots_differes_passifs', label: 'Impôts différés passifs', indent: true },

    ...CAPITAUX_PROPRES,
  ],

  // Bilan bancaire : dominé par crédits (actif) et dépôts (passif). Pas de
  // stocks, pas de fournisseurs, pas de découpage courant/non courant.
  banque: [
    { key: '__actif__', label: 'ACTIF', section: true },
    { key: 'total_actifs', label: 'Total des actifs', bold: true },
    { key: 'credits_clientele', label: 'Crédits à la clientèle', specific: true, bold: true, indent: true },
    { key: 'creances_douteuses', label: 'Créances douteuses', specific: true, indent: true },
    { key: 'tresorerie_equivalents', label: 'Trésorerie & équivalents', indent: true },
    { key: 'investissements_court_terme', label: 'Placements court terme', indent: true },
    { key: 'investissements_long_terme', label: 'Portefeuille de titres', indent: true },
    { key: 'immobilisations_nettes', label: 'Immobilisations nettes', indent: true },
    { key: 'goodwill', label: 'Goodwill', indent: true },
    { key: 'autres_actifs_financiers', label: 'Autres actifs financiers', indent: true },

    { key: '__passif__', label: 'PASSIF', section: true },
    { key: 'total_passif', label: 'Total du passif', bold: true },
    { key: 'depots_clientele', label: 'Dépôts de la clientèle', specific: true, bold: true, indent: true },
    { key: 'dette_court_terme', label: 'Dettes court terme', indent: true },
    { key: 'dette_long_terme', label: 'Dettes long terme', indent: true },
    { key: 'autres_passifs_non_courants', label: 'Autres passifs', indent: true },
    { key: 'impots_differes_passifs', label: 'Impôts différés passifs', indent: true },

    ...CAPITAUX_PROPRES,
    { key: 'ratio_solvabilite', label: 'Ratio de solvabilité', specific: true, format: 'pct', indent: true },
  ],

  // Bilan assurance : provisions techniques (passif) et placements (actif).
  assurance: [
    { key: '__actif__', label: 'ACTIF', section: true },
    { key: 'total_actifs', label: 'Total des actifs', bold: true },
    { key: 'placements', label: 'Placements', specific: true, bold: true, indent: true },
    { key: 'tresorerie_equivalents', label: 'Trésorerie & équivalents', indent: true },
    { key: 'creances_clients', label: 'Créances (assurés & réassureurs)', indent: true },
    { key: 'immobilisations_nettes', label: 'Immobilisations nettes', indent: true },
    { key: 'autres_actifs_financiers', label: 'Autres actifs financiers', indent: true },

    { key: '__passif__', label: 'PASSIF', section: true },
    { key: 'total_passif', label: 'Total du passif', bold: true },
    { key: 'provisions_techniques', label: 'Provisions techniques', specific: true, bold: true, indent: true },
    { key: 'dette_court_terme', label: 'Dettes court terme', indent: true },
    { key: 'dette_long_terme', label: 'Dettes long terme', indent: true },
    { key: 'autres_passifs_non_courants', label: 'Autres passifs', indent: true },

    ...CAPITAUX_PROPRES,
  ],
};
