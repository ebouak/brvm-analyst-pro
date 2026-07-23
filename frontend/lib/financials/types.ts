export interface IncomeStatement {
  periode: string;
  type_periode: string;
  revenu_total: number | null;
  cout_ventes: number | null;
  marge_brute: number | null;
  depenses_exploitation: number | null;
  frais_generaux_admin: number | null;
  depenses_rd: number | null;
  autres_depenses: number | null;
  resultat_exploitation: number | null;
  charges_financieres_nettes: number | null;
  resultat_avant_impots: number | null;
  impots: number | null;
  resultat_net: number | null;
  benefice_par_action: number | null;
  benefice_par_action_dilue: number | null;
  actions_en_circulation: number | null;
  actions_diluees: number | null;
  dividende_par_action: number | null;
  lignes_specifiques: Record<string, number | null> | null;
}

export interface BalanceSheet {
  periode: string;
  type_periode: string;
  total_actifs: number | null;
  total_actif_circulant: number | null;
  tresorerie_equivalents: number | null;
  investissements_court_terme: number | null;
  creances_clients: number | null;
  stocks: number | null;
  autres_actifs_courants: number | null;
  total_actif_non_courant: number | null;
  immobilisations_nettes: number | null;
  goodwill: number | null;
  actifs_incorporels: number | null;
  investissements_long_terme: number | null;
  autres_actifs_financiers: number | null;
  total_passif: number | null;
  passif_courant: number | null;
  fournisseurs: number | null;
  dette_court_terme: number | null;
  revenus_differes_courants: number | null;
  autres_passifs_courants: number | null;
  passif_non_courant: number | null;
  dette_long_terme: number | null;
  autres_passifs_non_courants: number | null;
  impots_differes_passifs: number | null;
  total_capitaux_propres: number | null;
  capital_social: number | null;
  reserves_benefices_non_repartis: number | null;
  autres_capitaux_propres: number | null;
  interets_minoritaires: number | null;
  lignes_specifiques: Record<string, number | null> | null;
}

export interface CashFlowStatement {
  periode: string;
  type_periode: string;
  /** Devise du document source si ce n'est pas le FCFA (ex. 'USD' pour ETI). */
  devise_origine?: string | null;
  /** Taux moyen d'exercice appliqué pour convertir en FCFA (IAS 21). */
  taux_conversion?: number | null;
  flux_exploitation: number | null;
  resultat_net: number | null;
  depreciation_amortissement: number | null;
  impots_reportes: number | null;
  remuneration_actions: number | null;
  variation_bfr: number | null;
  autres_elements_hors_caisse: number | null;
  flux_investissement: number | null;
  investissements_ppe: number | null;
  acquisitions: number | null;
  achats_placements: number | null;
  ventes_placements: number | null;
  autres_activites_investissement: number | null;
  flux_financement: number | null;
  remboursement_dette: number | null;
  dividendes_verses: number | null;
  rachats_actions: number | null;
  emissions_actions: number | null;
  autres_activites_financement: number | null;
  effet_forex_tresorerie: number | null;
  variation_tresorerie: number | null;
  tresorerie_debut_periode: number | null;
  tresorerie_fin_periode: number | null;
  depenses_capital: number | null;
  flux_tresorerie_disponible: number | null;
}

export interface FundamentalRatios {
  capitalisation: number | null;
  bpa: number | null;
  rendement_dividende: number | null;
  per: number | null;
  pb: number | null;
  ps: number | null;
  roe: number | null;
  marge_nette: number | null;
  dette_sur_capitaux_propres: number | null;
  payout: number | null;
  croissance_ca: number | null;
  croissance_rn: number | null;
  cours_bas_52s: number | null;
  cours_haut_52s: number | null;
  cours_actuel: number | null;
}

export interface Publication {
  id: string;
  libelle: string | null;
  date_publication: string;
  type_publication: string | null;
  source_url: string | null;
}

export interface FinancialsData {
  instrument: {
    code: string;
    designation: string | null;
    secteur: string | null;
    shares: number | null;
    famille_comptable: 'banque' | 'assurance' | 'general';
  };
  latestDaily: {
    cours_jour: number | null;
    cours_bas_52s: number | null;
    cours_haut_52s: number | null;
  } | null;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  cashFlowStatements: CashFlowStatement[];
  publications: Publication[];
}
