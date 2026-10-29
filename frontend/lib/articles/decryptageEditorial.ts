/**
 * Couche ÉDITORIALE d'un décryptage : ce que la base ne contient pas (résultat
 * part du groupe, impôt, flux de trésorerie, risques réglementaires, calendrier
 * annoncé par un régulateur…).
 *
 * RÈGLE : chaque chiffre écrit ici figure tel quel dans la source citée, ou en
 * est le rapport direct. Rien n'est estimé. `verifie_le` date la relecture des
 * sources ; `comptes.exercice` doit être celui du dossier, faute de quoi les
 * comptes sont ignorés (un exercice plus récent en base rend ces chiffres
 * périmés, et les mélanger fabriquerait des ratios faux).
 *
 * Une valeur sans entrée ici donne un décryptage complet tiré de la seule
 * base : les sections éditoriales n'apparaissent simplement pas.
 */
export interface Source {
  label: string;
  url: string;
}

export interface ComptesGroupe {
  /** Exercice des comptes, identique à `chiffres_cles.exercice` du dossier. */
  exercice: string;
  source: Source;
  /** Montants en FCFA. `_prec` = exercice précédent. */
  resultat_part_groupe: number;
  resultat_part_groupe_prec: number;
  /** Capitaux propres attribuables aux propriétaires de la société mère. */
  fonds_propres_groupe: number;
  resultat_exploitation_prec: number;
  resultat_avant_impot_prec: number;
  impot_societes: number;
  impot_societes_prec: number;
  impots_taxes_exploitation: number;
  impots_taxes_exploitation_prec: number;
  free_cash_flow: number | null;
  capex: number | null;
  capex_variation: number | null;
  /** Dividende brut par action, à l'échelle du nombre d'actions actuel. */
  dividende_brut: number | null;
  ecarts_conversion: number | null;
  resultat_global: number | null;
  /** Filiales consolidées avec minoritaires : pourcentage d'intérêt du groupe. */
  filiales: { pays: string; interet: number }[];
  /** Taux d'impôt effectif d'une période intermédiaire, s'il éclaire la tendance. */
  impot_intermediaire: { libelle: string; taux: number; taux_prec: number; source: Source } | null;
}

export interface RisqueEditorial {
  titre: string;
  texte: string;
  sources: Source[];
}

export interface DateEditoriale {
  /** Date de tri (ISO) ; un catalyseur passé est écarté à la génération. */
  tri: string;
  /** Libellé affiché : « 2 nov. 2026 », « Mi-févr. 2027 ». */
  date: string;
  titre: string;
  texte: string;
  /** Date non confirmée par l'émetteur : affichée comme telle. */
  indicatif?: boolean;
  source?: Source;
}

export interface EditorialValeur {
  code: string;
  verifie_le: string;
  comptes: ComptesGroupe | null;
  risques: RisqueEditorial[];
  catalyseurs: DateEditoriale[];
  journal: DateEditoriale[];
  sources: Source[];
}

const SONATEL_FY2025: Source = {
  label: 'Sonatel, communiqué des résultats 2025',
  url: 'https://sonatel.sn/wp-content/uploads/2026/03/BRVM-FY-2025-FR-VF.pdf',
};
const SONATEL_S1_2026: Source = {
  label: 'Sonatel, résultats du premier semestre 2026',
  url: 'https://sonatel.sn/wp-content/uploads/2026/07/BRVM-S1-2026-FR-VF.pdf',
};
const BCEAO_PISPI: Source = {
  label: 'BCEAO, communiqué du 2 octobre 2026 sur PI-SPI',
  url: 'https://www.bceao.int/sites/default/files/2026-10/Communiqu%C3%A9%20du%202%20octobre%202026.pdf',
};
const GCR_SNTS: Source = {
  label: 'GCR, notation de Sonatel (30 juin 2026)',
  url: 'https://www.brvm.org/sites/default/files/20260630_-_notation_financiere_-_sonatel_sn.pdf',
};
const ECOFIN_S1: Source = {
  label: 'Ecofin Agency, analyse du S1 2026',
  url: 'https://www.ecofinagency.com/news/2707-57743-sonatel-posts-record-half-year-sales-but-the-easy-growth-is-over',
};

/* Vérifié le 2026-10-29 sur les PDF eux-mêmes (texte extrait, pas un résumé). */
const SNTS: EditorialValeur = {
  code: 'SNTS',
  verifie_le: '2026-10-29',
  comptes: {
    exercice: '2025',
    source: SONATEL_FY2025,
    resultat_part_groupe: 341_963e6,
    resultat_part_groupe_prec: 328_750e6,
    fonds_propres_groupe: 1_160_715e6,
    resultat_exploitation_prec: 619_523e6,
    resultat_avant_impot_prec: 596_255e6,
    impot_societes: 235_398e6,
    impot_societes_prec: 202_593e6,
    impots_taxes_exploitation: 182_495e6,
    impots_taxes_exploitation_prec: 148_927e6,
    free_cash_flow: 422.5e9,
    capex: 288.6e9,
    capex_variation: -0.039,
    // 1 933 F brut avant le fractionnement par 10 du 26/10/2026.
    dividende_brut: 193.3,
    ecarts_conversion: -64_079e6,
    resultat_global: 346_646e6,
    filiales: [
      { pays: 'Mali', interet: 0.694 },
      { pays: 'Guinée', interet: 0.8892 },
      { pays: 'Guinée-Bissau', interet: 0.8985 },
      { pays: 'Sierra Leone', interet: 0.5 },
    ],
    // IS / (résultat net + IS) : 124 183 / 354 145 et 121 201 / 329 308 (M FCFA).
    impot_intermediaire: { libelle: 'premier semestre 2026', taux: 0.3507, taux_prec: 0.3681, source: SONATEL_S1_2026 },
  },
  risques: [
    {
      titre: 'Mobile money : concurrence et PI-SPI',
      texte:
        'À compter du 2 novembre 2026, les transferts de monnaie électronique interopérables passent obligatoirement par PI-SPI : gratuits à l’envoi jusqu’à 8 000 F cumulés par jour, puis soumis à des frais compris entre 0 et 0,8 % (BCEAO). Les revenus Orange Money n’ont progressé que de 5,4 % au premier semestre 2026 ; selon Ecofin, l’opérateur a dû s’aligner sur les prix de ses concurrents.',
      sources: [BCEAO_PISPI, SONATEL_S1_2026, ECOFIN_S1],
    },
    {
      titre: 'Taxes hors Sénégal',
      texte:
        'Nouvelles taxes en Sierra Leone (accès au réseau, 10 % sur les recharges, 1 % sur les retraits, contribution de 0,5 % du chiffre d’affaires) et en Guinée-Bissau (mobile money, terminaux, paiements en espèces). Au Mali, la base clientèle recule de 13,7 % sous l’effet du durcissement de l’identification des abonnés.',
      sources: [SONATEL_FY2025],
    },
    {
      titre: 'Trésorerie et partage d’infrastructures',
      texte:
        'GCR relève une pression sur les flux de trésorerie, sous l’effet combiné des dividendes versés et des investissements, et note que le partage d’infrastructures imposé au Sénégal pourrait à terme diluer l’avantage compétitif de l’opérateur. Selon Ecofin, l’État sénégalais est à la fois actionnaire, régulateur du secteur et collecteur de l’impôt.',
      sources: [GCR_SNTS, ECOFIN_S1],
    },
  ],
  catalyseurs: [
    { tri: '2026-11-02', date: '2 nov. 2026', titre: 'Entrée en vigueur de PI-SPI', texte: 'Nouveau cadre tarifaire des transferts de monnaie électronique interopérables.', source: BCEAO_PISPI },
    { tri: '2027-02-15', date: 'Mi-févr. 2027', titre: 'Résultats annuels 2026', texte: 'D’après le calendrier de 2026 (publication le 16 février).', indicatif: true },
    { tri: '2027-05-15', date: 'Mai 2027', titre: 'Assemblée générale et dividende', texte: 'D’après le calendrier de 2026.', indicatif: true },
    { tri: '2027-06-01', date: '1er juin 2027', titre: 'PI-SPI étendu à l’UEMOA', texte: 'Mêmes conditions tarifaires pour les transferts entre pays de l’Union.', source: BCEAO_PISPI },
  ],
  journal: [],
  sources: [
    SONATEL_FY2025,
    SONATEL_S1_2026,
    { label: 'BRVM, avis de paiement du dividende 2025', url: 'https://www.brvm.org/fr/sonatel-sn-paiement-de-dividendes-exercice-2025' },
    GCR_SNTS,
    BCEAO_PISPI,
    ECOFIN_S1,
  ],
};

const REGISTRE: Record<string, EditorialValeur> = { SNTS };

export function editorialDe(code: string): EditorialValeur | null {
  return REGISTRE[code.toUpperCase()] ?? null;
}
