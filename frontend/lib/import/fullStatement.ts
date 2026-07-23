import { z } from 'zod';

/**
 * Montant extrait. `.optional()` autant que `.nullable()` : le prompt demande de
 * mettre `null` quand une ligne est absente du document, mais les LLM omettent
 * souvent la clé purement et simplement. Les deux expriment la même chose — une
 * rubrique absente des états financiers — et `toRows` normalise déjà `undefined`
 * en `null`. Sans cet `.optional()`, une extraction par ailleurs correcte était
 * intégralement rejetée pour une clé manquante (constaté sur ETIT).
 */
const num = z.number().nullable().optional();

export const yearStatementSchema = z.object({
  periode: z.string(),               // ex "2025"
  // Compte de résultat
  revenu_total: num, cout_ventes: num, marge_brute: num,
  frais_generaux_admin: num, depenses_rd: num, autres_depenses: num,
  resultat_exploitation: num, charges_financieres_nettes: num,
  resultat_avant_impots: num, impots: num, resultat_net: num,
  benefice_par_action: num, benefice_par_action_dilue: num,
  dividende_par_action: num, actions_en_circulation: num,
  // Bilan
  total_actifs: num, total_actif_circulant: num, tresorerie_equivalents: num,
  investissements_court_terme: num, creances_clients: num, stocks: num,
  autres_actifs_courants: num, total_actif_non_courant: num,
  immobilisations_nettes: num, goodwill: num, actifs_incorporels: num,
  investissements_long_terme: num, total_passif: num, passif_courant: num,
  fournisseurs: num, dette_court_terme: num, autres_passifs_courants: num,
  passif_non_courant: num, dette_long_terme: num, total_capitaux_propres: num,
  capital_social: num, reserves_benefices_non_repartis: num,
  // Flux de trésorerie
  flux_exploitation: num, depreciation_amortissement: num, variation_bfr: num,
  flux_investissement: num, investissements_ppe: num, acquisitions: num,
  flux_financement: num, dividendes_verses: num, remboursement_dette: num,
  emissions_actions: num, variation_tresorerie: num,
  tresorerie_debut_periode: num, tresorerie_fin_periode: num,
  depenses_capital: num, flux_tresorerie_disponible: num,
  // Lignes propres à la famille (banque/assurance). Clés libres -> nombre|null.
  lignes_specifiques: z.record(z.number().nullable()).nullable().optional(),
});

export type YearStatement = z.infer<typeof yearStatementSchema>;

export const fullExtractionSchema = z.object({
  est_banque: z.boolean(),           // SYSCOHADA banque vs industriel
  unite_source: z.enum(['milliers', 'millions', 'fcfa']),
  // Devise des tableaux réellement utilisés. Distincte de l'échelle : un document
  // ETI contient des séries en FCFA ET en USD, et confondre les deux a déjà produit
  // des flux de trésorerie 580× trop faibles (voir checkDeviseFcfa).
  // `.optional()` : les extractions antérieures à ce champ restent valides.
  devise_source: z.enum(['fcfa', 'usd', 'eur', 'autre']).optional(),
  exercices: z.array(yearStatementSchema).min(1),
});

export type FullExtraction = z.infer<typeof fullExtractionSchema>;
