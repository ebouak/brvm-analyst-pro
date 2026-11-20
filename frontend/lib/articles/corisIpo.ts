export const CORIS_IPOS = [
  {
    code: 'CI',
    nom: 'Coris Bank International Côte d’Ivoire',
    montantMd: 62,
    bilanMd: 1323.1,
    pnbMd: 55.8,
    resultatNetMd: 24.5,
    croissanceBilanPct: 24.5,
    croissancePnbPct: 32.8,
    croissanceResultatPct: 45.4,
    coefficientExploitationPct: 41.8,
    roePct: 21.1,
    partAnnoncedPct: 62 / 81 * 100,
  },
  {
    code: 'BJ',
    nom: 'Coris Bank Bénin',
    montantMd: 19,
    bilanMd: 850.3,
    pnbMd: 20.5,
    resultatNetMd: 8.08,
    croissanceBilanPct: 10.3,
    croissancePnbPct: 0,
    croissanceResultatPct: 9.8,
    coefficientExploitationPct: null,
    roePct: 16.5,
    partAnnoncedPct: 19 / 81 * 100,
  },
] as const;

export type WpliInput = {
  souscriptionsMd: number;
  partVentes: number;
  valeur20jMd: number;
};

export type WpliResult =
  | { statut: 'calculable'; cashVenteMd: number; seancesEquivalentes: number }
  | { statut: 'indisponible' };

export function calculerWpli({
  souscriptionsMd,
  partVentes,
  valeur20jMd,
}: WpliInput): WpliResult {
  if (
    !Number.isFinite(souscriptionsMd) ||
    !Number.isFinite(partVentes) ||
    !Number.isFinite(valeur20jMd) ||
    souscriptionsMd < 0 ||
    partVentes < 0 ||
    partVentes > 1 ||
    valeur20jMd <= 0
  ) {
    return { statut: 'indisponible' };
  }
  const cashVenteMd = souscriptionsMd * partVentes;
  return {
    statut: 'calculable',
    cashVenteMd,
    seancesEquivalentes: cashVenteMd / valeur20jMd,
  };
}

/**
 * Offre CBI CI — chiffres de la note d'information visée par l'AMF-UMOA
 * (visa OA/26-05, publiée le 20 novembre 2026). Les dérivés (valorisation,
 * dividende par action, rendements) sont calculés plus bas, jamais saisis.
 */
export const OFFRE_CBI_CI = {
  actionsTotal: 40_800_000,
  actionsOffertes: 8_160_000,
  actionsPublic: 7_996_800,
  actionsPersonnel: 163_200,
  prixPublic: 7720,
  prixPersonnel: 6175,
  montantGlobal: 62_743_056_000,
  perNote: 12.83,
  pbNote: 2.71,
  resultatNet2025Md: 24.507,
  fondsPropres2025Md: 115.974,
  visa: 'OA/26-05',
  isin: 'CI0000010740',
} as const;

export const VALORISATION_CBI_CI = {
  valorisationMd: (OFFRE_CBI_CI.actionsTotal * OFFRE_CBI_CI.prixPublic) / 1e9,
  montantRecalculeMd:
    (OFFRE_CBI_CI.actionsPublic * OFFRE_CBI_CI.prixPublic +
      OFFRE_CBI_CI.actionsPersonnel * OFFRE_CBI_CI.prixPersonnel) / 1e9,
  bpa2025: (OFFRE_CBI_CI.resultatNet2025Md * 1e9) / OFFRE_CBI_CI.actionsTotal,
} as const;

export const CALENDRIER_CBI_CI = [
  { date: '20 nov. 2026', etape: 'Lancement de l’offre' },
  { date: '30 nov. – 4 déc.', etape: 'Période de souscription (clôture anticipée possible)' },
  { date: '9 déc.', etape: 'Compte rendu à l’AMF-UMOA (3 déc. si clôture anticipée)' },
  { date: '21 déc.', etape: 'Allocations définitives (15 déc. si clôture anticipée)' },
  { date: '28 déc.', etape: 'Règlement-livraison (18 déc. si clôture anticipée)' },
  { date: '15 janv. 2027', etape: 'Première cotation, compartiment Prestige' },
] as const;

export const ACTIONNARIAT_CBI_CI = [
  { nom: 'Coris Holding SA', avant: 84.6, apres: 64.6 },
  { nom: 'Equity Finance Corporation', avant: 10, apres: 10 },
  { nom: 'Coris Bourse SA', avant: 3.6, apres: 3.6 },
  { nom: 'Coris Assurances SA', avant: 1.8, apres: 1.8 },
  { nom: 'Public (flottant BRVM)', avant: 0, apres: 20 },
] as const;

/** Valeur de 100 % des fonds propres selon l'évaluateur (Adenka), en Md FCFA. */
export const METHODES_VALORISATION = [
  { methode: 'Comparables boursiers, PER', valeurMd: 217.498 },
  { methode: 'Transactions, PER', valeurMd: 288.072 },
  { methode: 'Dividendes actualisés', valeurMd: 288.293 },
  { methode: 'Comparables boursiers, P/B', valeurMd: 311.73 },
  { methode: 'Transactions, P/B', valeurMd: 370.13 },
  { methode: 'Excès de fonds propres', valeurMd: 372.671 },
] as const;

/** Multiples retenus par la note : cours au 31/12/2025, ou prix d'introduction. */
export const COMPARABLES_MULTIPLES = [
  { banque: 'BOA Côte d’Ivoire', reference: 'Cours 31/12/2025', per: 8.08, pb: 2.26 },
  { banque: 'BICICI', reference: 'Cours 31/12/2025', per: 8.87, pb: 2.69 },
  { banque: 'Société Ivoirienne de Banque', reference: 'Cours 31/12/2025', per: 10.34, pb: 2.81 },
  { banque: 'BIIC (Bénin)', reference: 'Introduction 2025', per: 11.07, pb: 3.17 },
  { banque: 'Bridge Bank Group CI', reference: 'Introduction 2026', per: 12.4, pb: 3.21 },
] as const;

export const TAUX_DISTRIBUTION_VISE = 0.65;
export const IRVM_CI_PERSONNE_PHYSIQUE = 0.12;

/** Résultat net prévu par le plan d'affaires 2026-2030 (Md FCFA). */
export const PLAN_RESULTAT_MD = [
  { exercice: 2026, resultatMd: 32.636 },
  { exercice: 2027, resultatMd: 37.714 },
  { exercice: 2028, resultatMd: 41.009 },
  { exercice: 2029, resultatMd: 45.099 },
  { exercice: 2030, resultatMd: 49.267 },
] as const;

export function dividendesProjetes() {
  return PLAN_RESULTAT_MD.map(({ exercice, resultatMd }) => {
    const dpa = (resultatMd * 1e9 * TAUX_DISTRIBUTION_VISE) / OFFRE_CBI_CI.actionsTotal;
    const rendementBrut = dpa / OFFRE_CBI_CI.prixPublic;
    return {
      exercice,
      resultatMd,
      dpa,
      rendementBrutPct: rendementBrut * 100,
      rendementNetPct: rendementBrut * (1 - IRVM_CI_PERSONNE_PHYSIQUE) * 100,
    };
  });
}

export const VIGILANCES_CBI_CI = [
  ['Solvabilité', '15,01 % fin 2025 (22,53 % en 2024), puis 12,4 % à 13,3 % prévus jusqu’en 2030, pour un minimum de 11,5 %.'],
  ['Concentration', 'Grands risques à 24,86 % des fonds propres pour une limite de 25 %.'],
  ['Plan d’affaires', '+28 % de PNB et +44 % de crédits nets prévus dès 2026, après +6 % de crédits en 2025.'],
  ['Cession', 'Aucun engagement de conservation de Coris Holding (64,6 % après l’offre), aucun contrat de liquidité.'],
  ['Litiges', 'Affaire KKF : 717 M FCFA, entièrement provisionnés. Enquête du Pôle pénal économique et financier, dossier au parquet.'],
] as const;

export const SOURCES_CASH = [
  {
    nom: 'Épargne disponible',
    description: 'Dépôts et liquidités déjà détenus : transfert vers l’IPO sans vente nécessaire.',
    pression: 'limitée',
  },
  {
    nom: 'Nouveaux capitaux',
    description: 'Particuliers, diaspora et investisseurs institutionnels entrant sur le marché.',
    pression: 'apport net',
  },
  {
    nom: 'Financement bancaire',
    description: 'Crédit ou facilité de caisse : souscription financée par du levier.',
    pression: 'indirecte',
  },
  {
    nom: 'Ventes de positions',
    description: 'Liquidation d’actions déjà cotées : seule source qui exerce une pression directe sur le secondaire.',
    pression: 'directe',
  },
] as const;

export const SCENARIOS = [
  {
    code: 'fluide',
    titre: 'Absorption fluide',
    niveau: 'Favorable',
    conditions: ['Épargne disponible dominante', 'Nouveaux investisseurs', 'Remboursement rapide'],
    consequence: 'Les introductions élargissent l’offre sans désorganiser le secondaire.',
  },
  {
    code: 'rotation',
    titre: 'Rotation sectorielle',
    niveau: 'Central',
    conditions: ['Arbitrages sur les banques cotées', 'Ordres concentrés sur Coris', 'Retour progressif du cash'],
    consequence: 'Tension temporaire des valeurs bancaires et opportunités d’arbitrage.',
  },
  {
    code: 'contraction',
    titre: 'Contraction prolongée',
    niveau: 'Défavorable',
    conditions: ['Deux IPO rapprochées', 'Ventes secondaires importantes', 'Remboursement lent'],
    consequence: 'Moins de profondeur, spreads plus larges et pression sur les valeurs liquides.',
  },
] as const;

export const INDICATEURS_SUIVI = [
  ['Quotidien', 'Volume actions / moyenne 20 séances', 'Contraction ou reprise'],
  ['Quotidien', 'Valeur bancaire / moyenne 20 séances', 'Pression sectorielle'],
  ['Quotidien', 'Spread médian des banques', 'Dégradation de la liquidité'],
  ['Quotidien', 'Profondeur cumulée des carnets', 'Capacité d’absorption'],
  ['Par opération', 'Part des souscriptions particuliers', 'Concentration des financements'],
  ['Par opération', 'Ratio demandes / offre', 'Intensité de la demande'],
  ['Par opération', 'Délai de remboursement', 'Durée d’immobilisation du cash'],
  ['Hebdomadaire', 'Flux net des banques cotées', 'Arbitrages sectoriels'],
  ['Quotidien', 'Indices sectoriels relatifs', 'Performance relative'],
  ['Événementiel', 'Rendement des dividendes', 'Arbitrages de rendement'],
  ['Par opération', 'Part de nouveaux investisseurs', 'Apport d’épargne nouvelle'],
  ['Après cotation', 'Performance à J+5 et J+20', 'Comportement post-IPO'],
] as const;

export const COMPARABLES = ['CBIBF', 'BBGC', 'BICC', 'BICB', 'BOAB', 'BOABF', 'ETIT', 'NSBC'] as const;

export const MARCHE = {
  totalIpoMd: 81,
  valeurSeanceMd: 11.075,
  capitalisationMd: 19235.5,
  volumeAnnuel2025Md: 274.4,
  brvmc: 490.51,
  brvmcJourPct: -2.08,
  brvm30JourPct: -2.29,
  financeJourPct: -2.31,
} as const;

export const BRIDGE_EVENTS = [
  {
    date: '20 juil.',
    phase: 'Ouverture OPV',
    brvmcPct: -1.06,
    financePct: -2.07,
    actionMedianePct: -0.12,
    titresBaissiersPct: 57.4,
    valeurMd: 1.136,
    valeurVsRefPct: 46.8,
  },
  {
    date: '21 juil.',
    phase: 'Clôture anticipée',
    brvmcPct: -0.35,
    financePct: 0.31,
    actionMedianePct: 0.02,
    titresBaissiersPct: 36.2,
    valeurMd: 1.824,
    valeurVsRefPct: 79,
  },
  {
    date: '24 sept.',
    phase: 'Première cotation',
    brvmcPct: 2.97,
    financePct: -5.18,
    actionMedianePct: 1.91,
    titresBaissiersPct: 20.8,
    valeurMd: 3.448,
    valeurVsRefPct: 97.7,
  },
] as const;

export const DIVIDENDE_WINDOW = [
  { phase: '5 séances avant', variationPct: 1.09, ajustee: true },
  { phase: 'Ex-date', variationPct: -1.96, ajustee: true },
  { phase: '5 séances après', variationPct: -1.76, ajustee: true },
] as const;

export const DIVIDENDE_STATS = {
  echantillon: 26,
  partHausseAvantPct: 69.2,
  partHausseExDatePct: 23.1,
  partHausseApresPct: 26.9,
  volumeExDateVsAvant: 0.62,
} as const;

export const CORIS_RATIOS = {
  foisSeance: MARCHE.totalIpoMd / MARCHE.valeurSeanceMd,
  capitalisationPct: MARCHE.totalIpoMd / MARCHE.capitalisationMd * 100,
  volumeAnnuelPct: MARCHE.totalIpoMd / MARCHE.volumeAnnuel2025Md * 100,
} as const;

export const SOURCES = [
  {
    label: 'Coris Bank — identité officielle',
    url: 'https://coris.bank/',
  },
  {
    label: 'Bridge Bank Group Côte d’Ivoire — site officiel',
    url: 'https://www.bridgebankgroup.com/',
  },
  {
    label: 'BRVM — institution du marché',
    url: 'https://www.brvm.org/',
  },
  {
    label: 'Sika Finance — double IPO Coris, 62 Md / 19 Md',
    url: 'https://www.sikafinance.com/marches/brvm-le-groupe-coris-prepare-lintroduction-en-bourse-de-ses-filiales-de-cote-divoire-et-du-benin_65787',
  },
  {
    label: 'Coris Bourse — note d’information CBI CI (visa AMF-UMOA OA/26-05)',
    url: 'https://coris-bourse.com/produits-services/souscription-actionnariat/01a1d651-3551-713d-aed6-b672bdb6f3fe',
  },
  {
    label: 'Financial Afrik — Coris Bank Côte d’Ivoire ouvre 20 % de son capital',
    url: 'https://www.financialafrik.com/2026/11/20/coris-bank-cote-divoire-ouvre-20-de-son-capital-au-public/',
  },
  {
    label: 'BRVM — résultat de première cotation BBGC',
    url: 'https://www.brvm.org/fr/resultats-de-premiere-cotation-bridge-bank-group-cote-divoire-bbgc',
  },
  {
    label: 'BRVM — résumé de marché du 19 novembre 2026',
    url: 'https://www.brvm.org/fr/resume',
  },
  {
    label: 'Données WESTBOURSE — fenêtres de marché et dividendes',
    url: '#methodologie',
  },
] as const;
