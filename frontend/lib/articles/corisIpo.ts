export const CORIS_IPOS = [
  {
    code: 'CI',
    nom: 'Coris Bank International Côte d’Ivoire',
    montantMd: 62,
    bilanMd: 1319.1,
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
    label: 'Ocean’s News — conditions encore inconnues',
    url: 'https://oceans-news.com/introduction-bourse-coris-bank-cote-d-ivoire-benin-brvm/',
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
