import { describe, expect, it } from 'vitest';
import { computeLevels, pasDeCotation, arrondiPas, MARGE_SORTIE_PCT } from './levels';
import {
  construireAnalyse, variationHebdomadaire, perFiable, dividendeNet, qualiteBenefice, carnetFige, lundiDe,
  type EntreeAnalyse, type PointSerie,
} from './analyse';
import {
  buildSkeleton, assertNoForeignNumber, assertNoCausalClaim, assertNoRecommendation, TITRES,
} from './narrative';
import { buildPost } from './post';
import { selectHebdo } from './select';
import type { HebdoMetrics } from './types';

/**
 * SLBC, semaine du 13/11/2026, reconstruite : plafond des 20 séances précédentes
 * à 42 945 FCFA (clôture du 12/11), clôture finale 42 950 FCFA (+5 FCFA, 0,01 %).
 */
const DATES_SLBC = [
  '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
  '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02',
  '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11',
  '2026-11-12', '2026-11-13',
];
const CLOSES_SLBC = [
  38500, 38495, 38600, 38700, 38800, 38900, 38710, 38800, 38700, 38710, 38710, 39000, 39990, 38995,
  39000, 38700, 39100, 39120, 40000, 40000, 40000, 42945, 42950,
];
const serieSlbc: PointSerie[] = DATES_SLBC.map((date, i) => ({
  date, close: CLOSES_SLBC[i]!, volume: i === DATES_SLBC.length - 1 ? 931 : 250,
  valeur: i === DATES_SLBC.length - 1 ? 38_275_185 : 10_000_000,
}));

function entreeSlbc(sur: Partial<EntreeAnalyse> = {}): EntreeAnalyse {
  return {
    dateEdition: '2026-11-13',
    serie: serieSlbc,
    clotureFinAnnee: { date: '2025-12-31', close: 28_895 },
    operations: [],
    bornes52: { haut: 44_505, bas: 24_995 },
    indices: {
      BRVMC: { points: [{ date: '2026-11-06', valeur: 520.74 }, { date: '2026-11-13', valeur: 515.94 }] },
      BRVMCBASE: { points: [{ date: '2026-11-06', valeur: 259.54 }, { date: '2026-11-13', valeur: 265.65 }] },
    },
    secteur: 'Consommation de base',
    valeurMarcheSemaine: 8_300_000_000,
    liquidite: { classe: 'C', valeur_moyenne_30j: 13_796_164 },
    carnet: { date_marche: '2026-11-12', cours_achat: 40_010, cours_vente: 42_945, achat_au_marche: false, vente_au_marche: false },
    titres: 16_460_840,
    income: [
      { periode: '2025', resultat_net: 45_781_000_000, resultat_exploitation: 65_165_000_000, resultat_avant_impots: 61_970_000_000, benefice_par_action: 2781 },
      { periode: '2024', resultat_net: 21_472_000_000, resultat_exploitation: 34_735_000_000, resultat_avant_impots: 29_615_000_000, benefice_par_action: 1304 },
    ],
    dividendes: [
      { exercice: 2025, montant: 1871.76, base_fiscale: 'net', ex_date: '2026-07-29', payment_date: '2026-07-30' },
      { exercice: 2024, montant: 1074, base_fiscale: 'inconnu', ex_date: null, payment_date: null },
    ],
    pairs: [
      { code: 'AAAA', cours: 1000, titres: 1_000_000, income: [{ periode: '2025', resultat_net: 100_000_000, resultat_exploitation: null, resultat_avant_impots: null, benefice_par_action: 100 }], dividendes: [{ exercice: 2025, montant: 50, base_fiscale: 'net', ex_date: null, payment_date: null }] },
      { code: 'BBBB', cours: 2000, titres: 1_000_000, income: [{ periode: '2025', resultat_net: 200_000_000, resultat_exploitation: null, resultat_avant_impots: null, benefice_par_action: 200 }], dividendes: [{ exercice: 2025, montant: 120, base_fiscale: 'net', ex_date: null, payment_date: null }] },
      { code: 'CCCC', cours: 3000, titres: 1_000_000, income: [{ periode: '2025', resultat_net: 250_000_000, resultat_exploitation: null, resultat_avant_impots: null, benefice_par_action: 250 }], dividendes: [{ exercice: 2025, montant: 90, base_fiscale: 'net', ex_date: null, payment_date: null }] },
    ],
    publications: [],
    actualites: [],
    ...sur,
  };
}

function metricsSlbc(sur: Partial<EntreeAnalyse> = {}): HebdoMetrics {
  const closes = CLOSES_SLBC;
  const analyse = construireAnalyse(entreeSlbc(sur));
  return {
    code: 'SLBC', dates: DATES_SLBC, closes, rsi: closes.map(() => null), dernier: 42_950,
    variationHebdo: variationHebdomadaire(serieSlbc, '2026-11-13').variation, volume: 931, ratioVolume: 2.64,
    rsiDernier: 81.8, macdPositif: true,
    levels: computeLevels(closes, { pas: pasDeCotation(closes), margePct: MARGE_SORTIE_PCT }), analyse,
  };
}

/** Les milliers sont séparés par une espace fine insécable : on la ramène à une espace pour les motifs. */
const norm = (t: string) => t.replace(/[  ]/g, ' ');
const texteDe = (m: HebdoMetrics) => norm(buildSkeleton(m).sections.map((s) => s.texte).join(' '));
const sectionDe = (m: HebdoMetrics, titre: string) => norm(buildSkeleton(m).sections.find((s) => s.titre === titre)!.texte);

describe('défaut 1 — fausse cassure (SLBC, 13/11/2026)', () => {
  it('l’ancien calcul voyait une cassure à 5 FCFA du plafond', () => {
    const ancien = computeLevels(CLOSES_SLBC)!;
    expect(ancien.resistance).toBe(42_945);
    expect(ancien.cassureHaut).toBe(true);
  });
  it('avec la marge de 1 %, 42 950 contre 42 945 n’est pas une sortie de canal', () => {
    const l = computeLevels(CLOSES_SLBC, { pas: 5, margePct: MARGE_SORTIE_PCT })!;
    expect(l.cassureHaut).toBe(false);
    expect(l.contactHaut).toBe(true);
    expect(l.ecartPlafondPct).toBe(0.01);
  });
  it('le texte dit « au contact de son plafond », jamais « franchi » ni « sort de son canal »', () => {
    const t = texteDe(metricsSlbc());
    expect(t).toMatch(/au contact de son plafond/);
    expect(t).not.toMatch(/a franchi son plafond|sort de son canal|dépasse 42/);
  });
  it('un écart au-delà de la marge reste une sortie de canal', () => {
    const closes = [...CLOSES_SLBC.slice(0, -1), 43_500];
    const l = computeLevels(closes, { pas: 5, margePct: MARGE_SORTIE_PCT })!;
    expect(l.cassureHaut).toBe(true);
  });
  it('la sélection ne compte plus de « cassure » au contact', () => {
    const picks = selectHebdo([
      { code: 'SLBC', closes: [...Array(10).fill(38_500), ...CLOSES_SLBC], variationHebdo: 9.79, volume: 931, avgVolume20: 352 },
    ]);
    expect(picks[0]!.raison).not.toMatch(/sortie du canal|cassure/);
  });
});

describe('défaut 2 — niveaux arrondis au pas de cotation', () => {
  it('pas de 5 FCFA pour une série conforme, 1 FCFA sinon', () => {
    expect(pasDeCotation(CLOSES_SLBC)).toBe(5);
    expect(pasDeCotation([59, 61, 63, 64])).toBe(1);
  });
  it('arrondiPas', () => {
    expect(arrondiPas(37_382.5, 5)).toBe(37_385); // demi-pas : arrondi au pas supérieur
    expect(arrondiPas(37_382, 5)).toBe(37_380);
    expect(arrondiPas(37_383, 5)).toBe(37_385);
    expect(arrondiPas(1192.5, 5)).toBe(1195);
    expect(arrondiPas(2, 5)).toBe(5);
  });
  it('l’ancien calcul produisait un prix impossible ; le nouveau, un multiple du pas', () => {
    const closes = [...Array(30).fill(0).map((_, i) => 38_495 + (i % 2) * 4_450)];
    expect(computeLevels(closes)!.invalidation % 5).not.toBe(0);
    const l = computeLevels(closes, { pas: 5, margePct: 1 })!;
    for (const x of [l.objectif1, l.objectif2, l.objectifBas1, l.objectifBas2, l.invalidation]) expect(x % 5).toBe(0);
  });
});

describe('défaut 3 — objectifs mécaniques retirés du texte', () => {
  it('aucune extension d’amplitude ni « seuil technique » dans le narratif', () => {
    const m = metricsSlbc();
    const t = texteDe(m);
    const l = m.levels!;
    for (const x of [l.objectif1, l.objectif2, l.invalidation]) expect(t).not.toContain(String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' '));
    expect(t).not.toMatch(/seuils? techniques?|paliers? suivants?|objectif/i);
  });
});

describe('défaut 4 — le bénéfice et ce que paie le marché', () => {
  it('PER, médiane du secteur, rendement et qualité du bénéfice', () => {
    const t = sectionDe(metricsSlbc(), TITRES.valorisation);
    expect(t).toMatch(/15,4 fois le bénéfice de l’exercice 2025/);
    expect(t).toMatch(/médiane de 10,0 fois pour les 3 autres valeurs/);
    expect(t).toMatch(/1 871,76 FCFA net par action/);
    expect(t).toMatch(/113,2 %/);
    expect(t).toMatch(/résultat d’exploitation progresse de 87,6 %/);
    expect(t).toMatch(/ne repose pas sur des éléments hors exploitation/);
  });
  it('signale un bénéfice porté par des éléments hors exploitation', () => {
    const m = metricsSlbc({
      income: [
        { periode: '2025', resultat_net: 45_781_000_000, resultat_exploitation: 30_000_000_000, resultat_avant_impots: 61_970_000_000, benefice_par_action: 2781 },
        { periode: '2024', resultat_net: 21_472_000_000, resultat_exploitation: 29_000_000_000, resultat_avant_impots: 29_615_000_000, benefice_par_action: 1304 },
      ],
    });
    const t = texteDe(m);
    expect(t).toMatch(/51,6 % du résultat avant impôts provient d’éléments situés hors de l’exploitation/);
    expect(t).toMatch(/Une part notable du bénéfice provient d’éléments hors exploitation/);
  });
  it('perFiable refuse un BPA incohérent avec résultat ÷ titres, et des comptes trop anciens', () => {
    const rows = [{ periode: '2025', resultat_net: 45_781_000_000, resultat_exploitation: null, resultat_avant_impots: null, benefice_par_action: 2781 }];
    expect(perFiable(rows, 1_520_000, 42_950, 2026)).toBeNull(); // nombre de titres d'avant fractionnement
    expect(perFiable(rows, 16_460_840, 42_950, 2026)!.per).toBe(15.4);
    expect(perFiable(rows, 16_460_840, 42_950, 2029)).toBeNull();
  });
  it('dividendeNet ignore les bases inconnues, les zéros et les lignes montant = exercice', () => {
    expect(dividendeNet([{ exercice: 2025, montant: 2025, base_fiscale: 'net', ex_date: null, payment_date: null }], 2026)).toBeNull();
    expect(dividendeNet([{ exercice: 2025, montant: 0, base_fiscale: 'net', ex_date: null, payment_date: null }], 2026)).toBeNull();
    expect(dividendeNet([{ exercice: 2025, montant: 700, base_fiscale: 'inconnu', ex_date: null, payment_date: null }], 2026)).toBeNull();
  });
  it('une perte : pas de multiple, mention du résultat d’exploitation', () => {
    const b = qualiteBenefice([
      { periode: '2025', resultat_net: -6_131_800_226, resultat_exploitation: 1_828_947_146, resultat_avant_impots: -6_096_800_226, benefice_par_action: -313 },
    ], 2026);
    expect(b!.partHorsExploitationPct).toBeNull();
    const m = metricsSlbc({
      income: [{ periode: '2025', resultat_net: -6_131_800_226, resultat_exploitation: 1_828_947_146, resultat_avant_impots: -6_096_800_226, benefice_par_action: -313 }],
    });
    const t = texteDe(m);
    expect(t).toMatch(/perte nette de 6,1 milliards FCFA/);
    expect(t).toMatch(/la perte se forme sous l’exploitation/);
    expect(t).not.toMatch(/fois le bénéfice/);
  });
});

describe('défaut 5 — marché, secteur, année, liquidité, événements', () => {
  it('la variation de la semaine part de la clôture précédant le lundi', () => {
    const v = variationHebdomadaire(serieSlbc, '2026-11-13');
    expect(v.dateReference).toBe('2026-11-06');
    expect(Math.round(v.variation! * 100) / 100).toBe(9.79); // l'ancien calcul donnait 7,38
    expect(lundiDe('2026-11-13')).toBe('2026-11-09');
  });
  it('comparaison au BRVM Composite et à l’indice sectoriel', () => {
    const t = sectionDe(metricsSlbc(), TITRES.semaine);
    expect(t).toMatch(/BRVM Composite recule de 0,92 %/);
    expect(t).toMatch(/Consommation de base progresse de 2,35 %/);
    expect(t).toMatch(/fait mieux que le marché de 10,7 points et mieux que son secteur de 7,4 points/);
  });
  it('position sur un an et depuis janvier', () => {
    const t = texteDe(metricsSlbc());
    expect(t).toMatch(/entre 24 995 FCFA et 44 505 FCFA/);
    expect(t).toMatch(/3,5 % sous son plus haut/);
    expect(t).toMatch(/Depuis le 1er janvier, le titre gagne 48,64 %/);
  });
  it('depuis janvier refusé si une opération sur titres sépare les deux cours', () => {
    const a = construireAnalyse(entreeSlbc({ operations: [{ date_effet: '2026-03-02', type: 'fractionnement' }] }));
    expect(a.annee.depuisJanvier).toBeNull();
  });
  it('liquidité réelle : titres, valeur, part du marché, carnet, classe', () => {
    const t = sectionDe(metricsSlbc(), TITRES.liquidite);
    expect(t).toMatch(/La dernière séance a porté sur 931 titres \(38,3 millions FCFA\), 2,6 fois/);
    expect(t).toMatch(/des capitaux échangés sur l’ensemble de la cote/);
    expect(t).toMatch(/fourchette de 7,08 %/);
    expect(t).toMatch(/Classe de liquidité WestBourse : C \(peu négociable\)/);
    expect(carnetFige({ date_marche: '2026-11-12', cours_achat: 100, cours_vente: null, achat_au_marche: false, vente_au_marche: true })!.fourchettePct).toBeNull();
  });
  it('événements de la semaine et détachement à venir', () => {
    const m = metricsSlbc({
      publications: [{ date_publication: '2026-11-10', libelle: 'Rapport d’activité du troisième trimestre 2026' }],
      dividendes: [{ exercice: 2025, montant: 1871.76, base_fiscale: 'net', ex_date: '2026-11-25', payment_date: '2026-11-27' }],
    });
    const t = texteDe(m);
    expect(t).toMatch(/Cette semaine, nos données enregistrent : publication « Rapport d’activité du troisième trimestre 2026 » le 10 novembre/);
    expect(t).toMatch(/À venir : détachement du dividende de l’exercice 2025 le 25 novembre ; paiement/);
  });
  it('les risques factuels de la valeur', () => {
    const t = sectionDe(metricsSlbc(), TITRES.vigilance);
    expect(t).toMatch(/classe C/);
    expect(t).toMatch(/surachat/);
    expect(t).toMatch(/bénéfice en hausse de 113,2 %/);
  });
});

describe('garde-fous du nouveau texte', () => {
  it('le squelette passe ses trois garde-fous', () => {
    const sk = buildSkeleton(metricsSlbc());
    const t = sk.sections.map((s) => s.texte).join(' ');
    expect(assertNoForeignNumber(t, sk.chiffres)).toBe(true);
    expect(assertNoCausalClaim(t)).toBe(true);
    expect(assertNoRecommendation(t)).toBe(true);
  });
  it('un chiffre inventé est rejeté', () => {
    const sk = buildSkeleton(metricsSlbc());
    expect(assertNoForeignNumber('Le cours pourrait atteindre 51 000 FCFA.', sk.chiffres)).toBe(false);
  });
  it('aucune recommandation : les formules d’incitation sont rejetées', () => {
    for (const x of ['Il faut acheter SLBC.', 'Vendez avant la baisse.', 'Une belle opportunité.', 'Objectif de cours : 50 000.', 'Nous recommandons ce titre.']) {
      expect(assertNoRecommendation(x)).toBe(false);
    }
    expect(assertNoRecommendation('une meilleure offre d’achat à 40 010 FCFA, zone de surachat')).toBe(true);
  });
  it('sections absentes sans donnée : un snapshot sans analyse n’a que la semaine et la technique', () => {
    const m = metricsSlbc();
    const nu: HebdoMetrics = { ...m, analyse: undefined };
    const titres = buildSkeleton(nu).sections.map((s) => s.titre);
    expect(titres).toEqual([TITRES.semaine, TITRES.technique, TITRES.vigilance]);
    const vide: HebdoMetrics = { ...nu, rsiDernier: null, macdPositif: null, levels: null };
    expect(buildSkeleton(vide).sections.map((s) => s.titre)).toEqual([TITRES.semaine]);
  });
  it('une valeur sans comptes ni dividende n’a pas de section « Ce que paie le marché »', () => {
    const m = metricsSlbc({ income: [], dividendes: [], liquidite: null, carnet: null });
    const titres = buildSkeleton(m).sections.map((s) => s.titre);
    expect(titres).not.toContain(TITRES.valorisation);
  });
  it('le post court tient en un message et garde l’avertissement', () => {
    const m = metricsSlbc();
    const p = buildPost(buildSkeleton(m), m, 'court');
    expect(p.length).toBeLessThanOrEqual(700);
    expect(p).toMatch(/pas un conseil en investissement/);
  });
});
