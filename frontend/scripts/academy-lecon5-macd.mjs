#!/usr/bin/env node
// Génère la leçon 5 du niveau 3 (Le MACD), enrichie le 2026-11-24 au niveau
// des leçons 0 à 3 : calcul pas à pas (et atelier modifiable avec scénario
// « cours figé »), calendrier BRVM et seuil des 34 séances (BBGC),
// non-comparabilité réelle en points de cours (ETIT vs SGBC vs ORAC vs NSBC),
// histogramme / croisement / ligne zéro, divergences, simulateur en direct,
// cas réel daté Orange CI (ORAC), et 1 031 croisements mesurés sur six ans
// de BRVM (dix valeurs les plus liquides).
//
//   node --no-warnings scripts/academy-lecon5-macd.mjs
//
// Les chiffres de marché viennent de
// lib/academy/contenus/niveau3/sources/macd-brvm-2026-11-24.json, produit par
// scripts/academy-lecon5-stats.mjs. Les exemples fictifs sont calculés ici
// avec lib/indicators.ts : la leçon, l’atelier, le simulateur et la mesure
// appliquent exactement les mêmes formules.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const { emaSeries, macdSeries } = await import(pathToFileURL(path.join(ICI, '..', 'lib', 'indicators.ts')).href);
const DOSSIER = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau3');
const FICHIER = path.join(DOSSIER, 'l05-macd.json');
const S = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'sources', 'macd-brvm-2026-11-24.json'), 'utf8'));

const fr = (n, d = 1) => {
  const [e, dec] = Math.abs(n).toFixed(d).split('.');
  return (n < 0 ? '−' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? `,${dec}` : '');
};
const frs = (n, d = 1) => `${n > 0 ? '+' : ''}${fr(n, d)}`;
const pc = (n, d = 1) => `${fr(n, d)} %`;
const pcs = (n, d = 1) => `${n > 0 ? '+' : ''}${pc(n, d)}`;
const ent = (n) => fr(n, 0);
const dateFr = (iso) => {
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${Number(iso.slice(8, 10))}${iso.slice(8, 10) === '01' ? 'er' : ''} ${MOIS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
};
const jjmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// ── Exemples FICTIFS, calculés avec lib/indicators.ts ────────────────────────
const PAS = [100, 100, 101, 102, 103, 105, 108, 112, 115, 116, 114, 111];
const e3 = emaSeries(PAS, 3);
const e6 = emaSeries(PAS, 6);
const mPas = macdSeries(PAS, 3, 6, 3);

// Divergence baissière pédagogique (calculée en MACD 3, 6, 3)
const DIV_C = [100, 101, 102, 104, 107, 111, 115, 119, 122, 120, 118, 117, 119, 121, 123, 124, 125, 123, 120, 117];
const DIV_M = macdSeries(DIV_C, 3, 6, 3);

// Effet mécanique d’un cours figé en MACD(12, 26, 9) : hausse 10 000 -> 12 000 puis figé
const FIGE_C = [...Array(26).fill(10000), 10200, 10500, 10800, 11100, 11400, 11600, 11800, 12000, ...Array(20).fill(12000)];
const FIGE_M = macdSeries(FIGE_C, 12, 26, 9);
const figeCroiseIdx = FIGE_M.findIndex((x, i) => i > 33 && x.hist != null && x.hist <= 0);
const figeSeancesJusquaZero = figeCroiseIdx - 33;

// Poids exponentiels (k = 2 / (N + 1))
const k12 = (2 / 13) * 100;
const k26 = (2 / 27) * 100;
const k9 = (2 / 10) * 100;

// ── Faits de marché (source) ─────────────────────────────────────────────────
const annees = Object.entries(S.seances_par_an).filter(([a]) => a < '2026');
const seancesMin = Math.min(...annees.map(([, n]) => n));
const seancesMax = Math.max(...annees.map(([, n]) => n));
const seancesMoy = annees.reduce((t, [, n]) => t + n, 0) / annees.length;
const parMois = seancesMoy / 12;

const SIG = S.croisement_signal;
const ZER = S.croisement_zero;
const RAL = S.ralentissement_hist;
const BB = S.bbgc;
const COMP = S.comparabilite_2026_11_23;
const byCode = (code) => COMP.find((x) => x.code === code);
const ETIT = byCode('ETIT');
const SGBC = byCode('SGBC');
const ORAC_ETAT = byCode('ORAC');
const NSBC = byCode('NSBC');
const ratioAbs = Math.round(Math.abs(SGBC.macd) / Math.abs(ETIT.macd));
const ratioPct = Math.round(Math.abs(ETIT.macd_pct) / Math.abs(SGBC.macd_pct));

const ORAC = S.exemples.orac;
const SGBC_EX = S.exemples.sgbc;
const SRC = `Sources : clôtures des ${S.valeurs_liquides} actions les plus liquides de la BRVM du ${jjmm(S.periode.debut)}/${S.periode.debut.slice(0, 4)} au ${jjmm(S.periode.fin)}/${S.periode.fin.slice(0, 4)} (base WESTBOURSE, lue le 24/11/2026) ; MACD (12, 26, 9) et croisements calculés par WESTBOURSE.`;

const verdict = (x) =>
  !x.assez_de_cas
    ? `Trop peu de cas (moins de ${S.parametres.min_cas})`
    : x.ecart_etabli
      ? x.ecart_sens === 'plus'
        ? 'Plus souvent qu’une séance quelconque'
        : 'Moins souvent qu’une séance quelconque'
      : 'Écart non établi';
const verdictCourt = (x) =>
  !x.assez_de_cas ? 'trop peu de cas' : x.ecart_etabli ? (x.ecart_sens === 'plus' ? 'plus souvent' : 'moins souvent') : 'écart non établi';
const cellule = (x) => `${pc(x.part_pct)} contre ${pc(x.part_base_pct)} (${ent(x.cas)} cas) : ${verdictCourt(x)}`;

const LECT_PAS = [
  'Moins de 6 clôtures',
  'Moins de 6 clôtures',
  'Moins de 6 clôtures',
  'Moins de 6 clôtures',
  'Moins de 6 clôtures',
  'Première ligne MACD',
  'Signal encore indisponible',
  'Premier histogramme',
  'Hausse, mais histogramme fléchit',
  'Sommet du cours, élan resserré',
  'Croisement baissier (signal)',
  'Baisse accélère, MACD encore > 0',
];

const LECT_ORAC = {
  '2026-10-28': 'Baisse ralentit',
  '2026-10-29': 'Croisement haussier (en retard)',
  '2026-11-02': 'Passage au-dessus de zéro',
  '2026-11-04': 'Pic de l’histogramme',
  '2026-11-05': 'Hausse ralentit',
  '2026-11-09': 'Écart se resserre',
  '2026-11-10': 'Double croisement baissier',
  '2026-11-13': 'Baisse accélère',
  '2026-11-17': 'Pic de volume, baisse accélère',
  '2026-11-18': 'Creux de l’histogramme',
  '2026-11-20': 'Baisse ralentit',
  '2026-11-23': 'Baisse ralentit',
};

// ── Quiz (12 questions, Q1 = +10 conservée, positions 3/3/3/3) ───────────────
const quiz = [
  {
    question: 'La moyenne exponentielle 12 vaut 250 et la 26 vaut 240. Que vaut la ligne MACD ?',
    options: ['−10', '+10', '490', '250'],
    correct: 1,
    explication: '250 − 240 = +10.',
  },
  {
    question: 'Combien de séances cotées faut-il au minimum pour afficher la première barre d’histogramme d’un MACD (12, 26, 9) ?',
    options: ['9 séances', '12 séances', '26 séances', '34 séances'],
    correct: 3,
    explication: 'Il faut 26 séances pour obtenir la première ligne MACD, puis 8 séances supplémentaires pour la moyenne de signal sur 9 valeurs (26 + 9 − 1 = 34).',
  },
  {
    question: 'Dans le calendrier de la BRVM (environ 21 séances par mois), à quelle durée correspond la moyenne longue de 26 séances du MACD ?',
    options: [
      'Un peu plus d’un mois de cotation',
      'Un peu moins d’une semaine de cotation',
      'Environ un trimestre complet de cotation',
      'Presque une année entière de cotation',
    ],
    correct: 0,
    explication: '26 séances sur environ 21 séances par mois représentent environ 1,2 mois de cotation.',
  },
  {
    question: 'Pourquoi ne pas comparer directement le MACD de deux actions différentes en FCFA ?',
    options: [
      'Parce que l’indicateur est confidentiel',
      'Parce qu’il est borné entre 0 et 100',
      'Parce que sa valeur dépend du prix de l’action',
      'Parce qu’il ne se calcule que sur les banques',
    ],
    correct: 2,
    explication: `Le MACD s’exprime en points de cours : ${fr(ETIT.macd, 2)} FCFA sur ETIT (${ent(ETIT.cours)} FCFA) pèsent ${pc(ETIT.macd_pct, 2)}, tandis que ${fr(SGBC.macd, 2)} FCFA sur SGBC (${ent(SGBC.cours)} FCFA) ne pèsent que ${pc(SGBC.macd_pct, 2)}.`,
  },
  {
    question: 'L’histogramme du MACD est positif, mais diminue d’une séance à l’autre. Que décrit-il ?',
    options: ['Une hausse qui ralentit', 'Une hausse qui accélère', 'Une baisse qui accélère', 'Un arrêt de cotation'],
    correct: 0,
    explication: 'L’histogramme reste positif, mais l’écart entre la ligne MACD et sa ligne de signal se resserre : la hausse ralentit.',
  },
  {
    question: 'Que signifie le passage de la ligne MACD au-dessus de zéro ?',
    options: [
      'Le cours vient de doubler en une séance',
      'L’action verse un dividende exceptionnel',
      'La moyenne exponentielle 12 passe au-dessus de la 26',
      'Le RSI vient de franchir le seuil de 70',
    ],
    correct: 2,
    explication: 'Par définition, MACD = EMA 12 − EMA 26. Il devient positif au moment exact où la moyenne exponentielle 12 séances passe au-dessus de la 26.',
  },
  {
    question: 'Qu’appelle-t-on une divergence baissière sur le MACD ?',
    options: [
      'Le cours baisse pendant que le MACD baisse plus vite',
      'Le cours fait un sommet plus haut, le MACD un sommet plus bas',
      'Les deux moyennes exponentielles restent parfaitement parallèles',
      'Le volume augmente fortement lors d’une séance sans variation',
    ],
    correct: 1,
    explication: 'Le cours inscrit un nouveau plus-haut mais l’élan mesuré par le MACD est moins élevé : c’est un signe d’essoufflement, pas une garantie de retournement.',
  },
  {
    question: 'Sur les dix valeurs les plus liquides de la BRVM (2021-2026), quelle part des croisements MACD/Signal s’est défaite dans les 10 séances suivantes ?',
    options: ['Environ 5 %', 'Environ 15 %', 'Environ 95 %', 'Environ 55 %'],
    correct: 3,
    explication: `${pc(SIG.allers_retours['10'].part_pct)} des croisements MACD/Signal (${ent(SIG.allers_retours['10'].allers_retours)} sur ${ent(SIG.allers_retours['10'].cas)}) ont été suivis d’un croisement inverse dans les 10 séances suivantes.`,
  },
  {
    question: 'Sur les mêmes données (2021-2026), que se passe-t-il après un ralentissement précoce de l’histogramme ?',
    options: [
      'Il garantit un croisement dès la séance suivante',
      'Il n’arrive presque jamais sur les actions liquides',
      'Il précède le croisement de 5 séances, mais est démenti dans 36 % des cas',
      'Il arrive toujours plusieurs séances après le croisement de la ligne zéro',
    ],
    correct: 2,
    explication: `Sur ${ent(RAL.cas)} cas mesurés, le ralentissement devance le croisement de ${ent(RAL.avance_mediane_seances)} séances en médiane quand il aboutit, mais repart dans le sens initial avant zéro dans ${pc(RAL.part_dementi_pct)} des cas.`,
  },
  {
    question: 'Après une hausse, le cours d’une action peu liquide reste figé sans aucun échange pendant 10 séances. Que fait son MACD ?',
    options: [
      'Ses courbes se rejoignent et l’histogramme peut devenir négatif',
      'Il reste bloqué à sa valeur maximale jusqu’au prochain échange',
      'Il continue de monter tant que personne ne vend de titres',
      'Il disparaît automatiquement du graphique de la valeur',
    ],
    correct: 0,
    explication: 'Sur un cours constant, l’EMA 12 rejoint le prix plus vite que l’EMA 26, puis la ligne MACD recule vers zéro et passe sous sa ligne de signal : un faux croisement baissier sans aucun vendeur.',
  },
  {
    question: 'Le jour du détachement d’un dividende important, le cours baisse du montant du coupon. Quel est l’effet sur le MACD ?',
    options: [
      'Aucun effet, le MACD corrige automatiquement les dividendes',
      'Il chute brusquement, car l’EMA 12 réagit plus vite que l’EMA 26',
      'Il monte fortement en raison de l’entrée d’argent des actionnaires',
      'Il passe immédiatement à exactement zéro dès la clôture',
    ],
    correct: 1,
    explication: 'L’EMA 12 absorbe la baisse mécanique deux fois plus vite que l’EMA 26, créant un plongeon qui reflète le dividende et non une vague de ventes.',
  },
  {
    question: 'Comment le MACD complète-t-il le RSI ?',
    options: [
      'Il le remplace car il mesure aussi sur une échelle de 0 à 100',
      'Il calcule le bénéfice par action de la société cotée',
      'Il supprime le retard propre aux moyennes mobiles',
      'Le RSI mesure l’excès récent ; le MACD, l’accélération de la tendance',
    ],
    correct: 3,
    explication: 'Deux questions complémentaires : l’intensité récente sur une échelle fixe (RSI) et la dynamique de tendance en points de cours (MACD).',
  },
];

// ── Leçon ───────────────────────────────────────────────────────────────────
const lecon = {
  titre: 'Leçon 5 — Le MACD : calcul, lecture et ce que valent ses croisements',
  module: 'Module 2 — Indicateurs',
  categorie: 'technical',
  duree_min: 18,
  sous_titre: 'Deux moyennes exponentielles, leur écart, une ligne de signal et un histogramme : calcul pas à pas, divergences, cas réel Orange CI, et six ans de croisements mesurés à la BRVM.',
  resume: `Le MACD mesure l’écart entre une moyenne exponentielle courte et une longue. Quand l’écart grandit, la tendance accélère ; quand il se resserre, elle ralentit. Cette leçon construit ses trois composantes pas à pas, explique pourquoi deux actions ne se comparent pas en points de cours, présente l’histogramme et les divergences, puis met l’indicateur à l’épreuve sur la BRVM : un cas réel daté sur Orange Côte d’Ivoire, et ${ent(SIG.croisements)} croisements mesurés depuis 2021 sur les valeurs les plus liquides.`,
  nouveaute: { type: 'mis_a_jour', depuis: '2026-11-24' },
  sections: [
    {
      type: 'definition',
      titre: 'Trois composantes, un calcul pas à pas',
      contenu: [
        'Le MACD (moving average convergence divergence, ou convergence et divergence de moyennes mobiles) a été présenté par Gerald Appel à la fin des années 1970. Il prolonge directement la leçon 3 : il repose sur deux moyennes mobiles exponentielles du cours, une courte et une longue, et mesure l’écart entre elles.',
        `La ligne MACD est la différence entre la moyenne exponentielle sur 12 séances (poids de la dernière clôture : ${pc(k12)}) et celle sur 26 séances (poids : ${pc(k26)}). Positive, elle indique une moyenne courte au-dessus de la longue ; négative, l’inverse. La ligne de signal est une moyenne exponentielle sur 9 séances de la ligne MACD elle-même (poids : ${pc(k9)}) : elle la lisse.`,
        'L’histogramme représente l’écart entre la ligne MACD et sa ligne de signal, sous forme de barres ; il a été ajouté plus tard par Thomas Aspray. Il exige d’abord 26 clôtures pour obtenir la première ligne MACD, puis 8 séances de plus pour la moyenne de signal, soit 34 séances cotées au total avant la première barre complète.',
        `Le tableau ci-dessous suit le calcul séance par séance sur des paramètres réduits (3, 6, 3) pour rester vérifiable à la main. Observez les séances 9 et 10 : le cours continue pourtant de monter (${PAS[8]} puis ${PAS[9]}), mais l’histogramme diminue déjà (${frs(mPas[8].hist, 2)} puis ${frs(mPas[9].hist, 2)}). Il montre que la poussée ralentit avant même que le cours ne recule.`,
      ].join('\n'),
      formules: [
        { nom: 'Ligne MACD', expression: 'Moyenne exponentielle 12 − Moyenne exponentielle 26', exemple: '105 − 102 = +3 : la moyenne courte est au-dessus de la longue' },
        { nom: 'Ligne de signal', expression: 'Moyenne exponentielle sur 9 séances de la ligne MACD', exemple: `Elle lisse la ligne MACD (poids de ${pc(k9)} à la dernière valeur)` },
        { nom: 'Histogramme', expression: 'Ligne MACD − Ligne de signal', exemple: 'Positif et croissant : l’élan haussier se renforce' },
        { nom: 'Séances minimales', expression: 'Lente + Signal − 1', exemple: '26 + 9 − 1 = 34 séances avant la première barre d’histogramme' },
      ],
      tableau: {
        colonnes: ['Séance', 'Clôture', 'EMA 3', 'EMA 6', 'MACD', 'Signal 3', 'Histogramme', 'Lecture'],
        lignes: PAS.map((c, i) => [
          `S${i + 1}`,
          String(c),
          e3[i] == null ? '—' : fr(e3[i], 2),
          e6[i] == null ? '—' : fr(e6[i], 2),
          mPas[i].macd == null ? '—' : frs(mPas[i].macd, 2),
          mPas[i].signal == null ? '—' : frs(mPas[i].signal, 2),
          mPas[i].hist == null ? '—' : frs(mPas[i].hist, 2),
          LECT_PAS[i],
        ]),
        note: 'Valeurs d’exemple, paramètres réduits (3, 6, 3) calculés avec les formules exactes de WESTBOURSE. Le même décalage vaut en (12, 26, 9) : 25 séances sans MACD, 33 sans histogramme.',
      },
      simulation: {
        type: 'atelier_macd',
        consigne: 'Modifiez une clôture ou cliquez sur « Tester un cours figé » : regardez la ligne MACD et l’histogramme basculer en négatif sans aucune baisse de prix.',
        clotures: PAS,
        rapide: 3,
        lente: 6,
        signal: 3,
      },
    },
    {
      type: 'importance',
      titre: 'Pourquoi 12, 26 et 9 ? Et pourquoi deux actions ne se comparent pas',
      contenu: [
        `Les paramètres 12, 26 et 9 viennent des marchés où l’indicateur a été conçu, mais ils se traduisent simplement dans le calendrier de la BRVM. Avec ${ent(seancesMin)} à ${ent(seancesMax)} séances par an entre 2021 et 2025 (environ ${ent(Math.round(parMois))} par mois), 12 séances couvrent un peu plus de deux semaines, 26 séances un peu plus d’un mois de cotation, et 9 séances près de deux semaines.`,
        `Comme pour les moyennes mobiles, ce sont des conventions partagées, pas des lois : elles rendent les lectures comparables d’un outil à l’autre. Une valeur récemment introduite n’a pas tout de suite de MACD complet : Bridge Bank Group Côte d’Ivoire (BBGC), admise le ${dateFr(BB.premiere_date)}, n’a obtenu sa première barre d’histogramme qu’à sa ${BB.premier_histogramme_seance}e séance, le ${dateFr(BB.premier_histogramme_date)}.`,
        `Contrairement au RSI (borné de 0 à 100), le MACD s’exprime en points de cours, donc en FCFA. Sa valeur brute dépend directement du prix de l’action. Le ${dateFr(SGBC.derniere_date)}, le MACD de Société Générale CI (SGBC, ${ent(SGBC.cours)} FCFA) valait ${fr(SGBC.macd, 2)} FCFA, soit ${ratioAbs} fois plus en valeur absolue que celui d’ETI Togo (ETIT, ${ent(ETIT.cours)} FCFA, MACD ${fr(ETIT.macd, 2)} FCFA). Rapporté au cours, l’écart d’ETIT (${pc(ETIT.macd_pct, 2)}) était pourtant ${ratioPct} fois plus fort que celui de SGBC (${pc(SGBC.macd_pct, 2)}).`,
        'On compare donc le MACD d’une action à son propre passé, jamais à celui d’une autre. Pour comparer deux titres entre eux, il faut rapporter l’écart au cours, en pourcentage (un indicateur appelé PPO, percentage price oscillator).',
      ].join('\n'),
      formules: [
        {
          nom: 'MACD rapporté au cours (%)',
          expression: '(Ligne MACD ÷ Cours de clôture) × 100',
          exemple: `${fr(ETIT.macd, 2)} ÷ ${ent(ETIT.cours)} = ${pc(ETIT.macd_pct, 2)} pour ETIT contre ${fr(SGBC.macd, 2)} ÷ ${ent(SGBC.cours)} = ${pc(SGBC.macd_pct, 2)} pour SGBC`,
        },
      ],
      stats: [
        { label: '12 séances', valeur: '≈ 2,5 sem.', detail: `moyenne courte, poids ${pc(k12)} à la clôture` },
        { label: '26 séances', valeur: `≈ ${fr(26 / parMois)} mois`, detail: `moyenne longue, poids ${pc(k26)} à la clôture` },
        { label: '34 séances', valeur: 'Seuil minimal', detail: '26 + 9 − 1 avant le premier histogramme' },
      ],
      tableau: {
        colonnes: ['Valeur', 'Clôture (FCFA)', 'Ligne MACD (FCFA)', 'MACD rapporté au cours', 'Lecture'],
        lignes: [
          ['ETIT (Ecobank TI)', ent(ETIT.cours), fr(ETIT.macd, 2), pc(ETIT.macd_pct, 2), 'Petit en FCFA, fort en pourcentage'],
          ['SGBC (Société Générale CI)', ent(SGBC.cours), fr(SGBC.macd, 2), pc(SGBC.macd_pct, 2), 'Grand en FCFA, très faible en %'],
          ['ORAC (Orange CI)', ent(ORAC_ETAT.cours), fr(ORAC_ETAT.macd, 2), pc(ORAC_ETAT.macd_pct, 2), 'Écart marqué sur les deux échelles'],
          ['NSBC (NSIA Banque CI)', ent(NSBC.cours), fr(NSBC.macd, 2), pc(NSBC.macd_pct, 2), 'Plus fort écart relatif des quatre'],
        ],
        note: `Clôtures publiées par la BRVM au ${dateFr(SGBC.derniere_date)} (base WESTBOURSE) ; MACD (12, 26, 9) calculé par WESTBOURSE.`,
      },
    },
    {
      type: 'definition',
      titre: 'Lire l’histogramme, les croisements et la ligne zéro',
      contenu: [
        'Le MACD se lit à trois niveaux, du plus réactif au plus lent. Le premier est l’évolution de l’histogramme, qui décrit l’accélération ou le ralentissement de la tendance selon deux critères : son signe et sa pente. Positif et croissant, la hausse accélère ; positif et décroissant, elle ralentit. Les deux cas symétriques décrivent la baisse.',
        'Le deuxième niveau est le croisement entre la ligne MACD et sa ligne de signal, qui correspond exactement au passage de l’histogramme par zéro. Beaucoup le traitent comme un signal d’achat ou de vente : il hérite pourtant du retard des deux moyennes exponentielles et arrive souvent après le début du mouvement.',
        'Le troisième niveau est le franchissement de la ligne zéro par la ligne MACD elle-même. Comme la ligne MACD vaut EMA 12 moins EMA 26, son passage au-dessus de zéro signifie que la moyenne exponentielle 12 séances passe au-dessus de la 26 : c’est un croisement de moyennes mobiles, plus lent et moins fréquent que le croisement avec la ligne de signal.',
      ].join('\n'),
      tableau: {
        colonnes: ['Ce que l’on observe', 'Ce que cela décrit', 'Réactivité'],
        lignes: [
          ['Histogramme positif et croissant', 'La tendance haussière s’accélère', 'Précoce (bruité)'],
          ['Histogramme positif et décroissant', 'La hausse ralentit', 'Précoce (souvent démenti)'],
          ['Histogramme négatif et décroissant', 'La tendance baissière s’accélère', 'Précoce (bruité)'],
          ['Histogramme négatif et croissant', 'La baisse ralentit', 'Précoce (souvent démenti)'],
          ['Ligne MACD croise la ligne de signal', 'L’histogramme change de signe (croisement court)', 'Intermédiaire'],
          ['Ligne MACD franchit la ligne zéro', 'EMA 12 croise EMA 26 (tendance sur ~1 mois)', 'Plus lent, plus rare'],
        ],
        note: 'Des descriptions du passé. Aucune ligne de ce tableau n’est une raison d’acheter ou de vendre.',
      },
      graphiques: [
        {
          type: 'bar',
          titre: 'Les quatre phases d’un histogramme de MACD (exemple)',
          labels: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'],
          valeurs: [-3, -2, -0.5, 1, 2.5, 3, 2, 0.5],
          unite: '',
          note: 'Valeurs d’exemple. Négatif et croissant (S1 à S3) : la baisse ralentit. Il devient positif à S4 (croisement MACD/Signal), grandit jusqu’à S6 (la hausse accélère), puis diminue (la hausse ralentit). Aucune de ces phases ne dit combien de temps durera la suivante.',
          reel: false,
        },
      ],
      encadres: [
        {
          ton: 'info',
          titre: 'Deux croisements à ne pas confondre',
          texte: 'Un croisement MACD/Signal qui se produit sous la ligne zéro décrit un rebond d’élan dans une tendance encore orientée à la baisse (EMA 12 reste sous EMA 26). Un croisement au-dessus de zéro décrit une reprise d’élan dans une tendance déjà haussière. La mesure présentée plus bas vérifie si cette distinction améliore les résultats à la BRVM.',
        },
      ],
    },
    {
      type: 'definition',
      titre: 'Les divergences : quand le cours et l’élan ne racontent plus la même histoire',
      contenu: [
        'Une divergence apparaît quand le cours et le MACD évoluent dans des directions opposées d’un sommet ou d’un creux au suivant. Dans une divergence baissière, le cours atteint un nouveau sommet plus haut que le précédent, mais la ligne MACD (ou l’histogramme) forme un sommet moins élevé : la hausse se poursuit, mais avec moins d’élan qu’avant.',
        `Dans une divergence haussière, c’est l’inverse : le cours touche un nouveau plus-bas, tandis que le MACD forme un creux moins profond. La pression baissière ralentit, même si le prix recule encore. Sur le graphique d’exemple ci-dessous, le cours monte de ${DIV_C[8]} (S9) à ${DIV_C[16]} (S17), mais la ligne MACD passe d’un pic de ${frs(DIV_M[8].macd, 2)} à ${frs(DIV_M[15].macd, 2)}.`,
        'Les divergences sont l’usage le plus commenté du MACD — et une source fréquente de déception. Une divergence signale une perte d’élan, pas un retournement garanti : dans une tendance forte, le cours peut enchaîner deux ou trois nouveaux sommets successifs avec un MACD qui s’essouffle avant de corriger réellement.',
      ].join('\n'),
      graphiques: [
        {
          type: 'line',
          titre: 'Une divergence baissière : nouveau sommet du cours, sommet plus bas du MACD (exemple)',
          labels: DIV_C.slice(7).map((_, idx) => `S${idx + 8}`),
          series: [
            { nom: 'Clôture', valeurs: DIV_C.slice(7), axe: 'gauche' },
            { nom: 'Ligne MACD', valeurs: DIV_M.slice(7).map((x) => Number(x.macd.toFixed(2))), axe: 'droite' },
          ],
          unite: 'FCFA',
          unite_droite: 'MACD',
          note: `Valeurs d’exemple (calculées en MACD 3, 6, 3). Le cours marque un second sommet plus haut (${DIV_C[16]} à S17 contre ${DIV_C[8]} à S9), tandis que la ligne MACD culmine nettement plus bas (${frs(DIV_M[15].macd, 2)} contre ${frs(DIV_M[8].macd, 2)}) : la poussée haussière perd de son élan.`,
          reel: false,
        },
      ],
      encadres: [
        {
          ton: 'attention',
          titre: 'Divergence ne veut pas dire retournement immédiat',
          texte: 'Agir dès qu’une divergence se dessine revient souvent à sortir trop tôt d’une hausse ou à entrer trop tôt dans une baisse. Elle se lit comme une alerte de contexte, à croiser avec les niveaux de prix, les volumes et un niveau d’invalidation (leçon 0).',
        },
      ],
    },
    {
      type: 'cas',
      titre: 'Sur la BRVM : le MACD en direct',
      reel: true,
      contenu: [
        'Le simulateur ci-dessous calcule le MACD sur les clôtures réelles de six valeurs très échangées de la BRVM, avec le cours de clôture synchronisé au-dessus pour situer chaque croisement par rapport au mouvement réel du prix.',
        'Essayez deux manipulations. D’abord, passez d’une valeur à faible cours nominal (ETIT) à une valeur à cours élevé (SGBC) et observez l’échelle verticale : le MACD change d’ordre de grandeur, mais son rapport au cours en pourcentage reste comparable. Ensuite, raccourcissez les moyennes (par exemple 6, 13, 5) : les croisements arrivent plus tôt, mais se multiplient.',
        'Le tableau en direct, en dessous, donne pour les mêmes valeurs les moyennes mobiles 20 et 50 séances et le RSI 14 : le MACD se lit toujours dans ce contexte plus large.',
      ].join('\n'),
      simulation: {
        type: 'technique',
        indicateur: 'macd',
        consigne: 'Changez de valeur ou ajustez les trois réglages (rapide, lente, signal) : le cours s’affiche au-dessus du MACD pour mesurer le retard des croisements.',
        codes: ['SNTS', 'ORAC', 'SGBC', 'SIBC', 'ETIT', 'BOAC'],
        rapide: 12,
        lente: 26,
        signal: 9,
      },
      donnees_reelles: {
        vue: 'technique',
        codes: ['SNTS', 'ORAC', 'SGBC', 'SIBC', 'ETIT', 'BOAC'],
      },
    },
    {
      type: 'cas',
      titre: 'Un cas réel : Orange Côte d’Ivoire (ORAC), octobre–novembre 2026',
      reel: true,
      contenu: [
        'Entre le 28 octobre et le 23 novembre 2026, Orange Côte d’Ivoire (ORAC) montre en moins d’un mois toutes les phases de lecture du MACD. Le 29 octobre, la ligne MACD croise sa ligne de signal à la hausse (histogramme à +6,3), alors même que le cours recule ce jour-là de 21 500 à 21 000 FCFA : le croisement hérite du rebond des séances précédentes.',
        'Le 2 novembre, la ligne MACD franchit zéro (+1,4) et l’histogramme grandit jusqu’au 4 novembre (+95,5), où le cours plafonne à 21 500 FCFA. Dès le 5 novembre, l’histogramme commence à se resserrer (+70,0 puis +25,4 le 9 novembre) : la poussée ralentit cinq jours avant la cassure.',
        'Le 10 novembre, le cours décroche de 4,8 % à 20 000 FCFA (2 197 titres échangés) : la ligne MACD passe à la fois sous sa ligne de signal et sous zéro. L’histogramme creuse ensuite jusqu’au 18 novembre (−213,7) alors que le cours atteint 19 000 FCFA avec un pic de 10 360 titres le 17 novembre. Du 19 au 23 novembre, l’histogramme remonte vers zéro (−151,4) : la baisse ralentit, sans dire si elle s’arrêtera.',
      ].join('\n'),
      tableau: {
        colonnes: ['Séance', 'Clôture (FCFA)', 'Titres échangés', 'Ligne MACD', 'Signal', 'Histogramme', 'Lecture'],
        lignes: ORAC.seances.map((x) => [
          jjmm(x.date),
          ent(x.cloture),
          ent(x.volume),
          frs(x.macd, 1),
          frs(x.signal, 1),
          frs(x.hist, 1),
          LECT_ORAC[x.date] ?? '',
        ]),
        note: 'Clôtures et titres échangés publiés par la BRVM (sélection de 12 séances entre le 28/10 et le 23/11/2026) ; MACD (12, 26, 9) calculé par WESTBOURSE (base lue le 24/11/2026). Un cas daté : le simulateur ci-dessous montre la situation d’aujourd’hui.',
      },
      simulation: {
        type: 'technique',
        indicateur: 'macd',
        consigne: 'La même valeur, en direct : comparez le cours de clôture (en haut) aux croisements de l’histogramme et de la ligne zéro (en bas).',
        codes: ['ORAC'],
        rapide: 12,
        lente: 26,
        signal: 9,
      },
      donnees_reelles: {
        vue: 'technique',
        codes: ['ORAC'],
      },
    },
    {
      type: 'importance',
      titre: 'Ce que valent les croisements du MACD à la BRVM',
      contenu: [
        `Nous avons mesuré tous les croisements du MACD (12, 26, 9) sur les dix valeurs les plus liquides de la BRVM (71,9 % des capitaux échangés), du ${dateFr(S.periode.debut)} au ${dateFr(S.periode.fin)} : ${ent(SIG.croisements)} croisements MACD/Signal (${ent(SIG.haussiers)} haussiers, ${ent(SIG.baissiers)} baissiers), soit environ ${ent(Math.round(SIG.par_valeur_et_par_an))} par valeur et par an — trois fois et demie plus que les croisements de moyennes 20/50 de la leçon 3.`,
        `Le premier constat est le nombre d’allers-retours : ${pc(SIG.allers_retours['5'].part_pct)} des croisements MACD/Signal se défont en 5 séances ou moins, ${pc(SIG.allers_retours['10'].part_pct)} en 10 séances, et ${pc(SIG.allers_retours['20'].part_pct)} en 20 séances. Le retard se chiffre aussi : au croisement haussier, le cours avait déjà monté de ${pcs(SIG.avant_26.haussier_mediane_pct)} depuis son plus-bas des 26 séances précédentes (médiane) ; au croisement baissier, déjà perdu ${pc(Math.abs(SIG.avant_26.baissier_mediane_pct))} depuis son plus-haut.`,
        `Vingt séances après un croisement, le cours n’a pas bougé plus souvent dans son sens qu’après une séance quelconque. Sur ${ent(SIG.base_20.cas)} séances mesurées, il était plus haut 20 séances plus tard dans ${pc(SIG.base_20.part_hausse_pct)} des cas, plus bas dans ${pc(SIG.base_20.part_baisse_pct)}. Après un croisement haussier MACD/Signal, il était plus haut dans ${pc(SIG.apres_20.haussier.part_pct)} des cas (moins souvent qu’une séance quelconque, sur 2021-2023 comme sur 2024-2026) ; après un baissier, plus bas dans ${pc(SIG.apres_20.baissier.part_pct)} (écart non établi).`,
        `Deux règles classiques des manuels ont été testées sur les mêmes données. Filtrer les croisements haussiers selon la ligne zéro (sous zéro : ${pc(SIG.robustesse.sous_zero.haussier.part_pct)} ; au-dessus : ${pc(SIG.robustesse.sur_zero.haussier.part_pct)}) ou attendre le franchissement de zéro (${ent(ZER.croisements)} cas, ${pc(ZER.apres_20.haussier.part_pct)} à la hausse, ${pc(ZER.apres_20.baissier.part_pct)} à la baisse) ne fait jamais mieux qu’une séance quelconque. Quant au ralentissement précoce de l’histogramme (${ent(RAL.cas)} cas), il devance le croisement de ${ent(RAL.avance_mediane_seances)} séances en médiane, mais est démenti avant zéro dans ${pc(RAL.part_dementi_pct)} des cas.`,
        'Cette mesure a ses limites : elle porte sur les dix valeurs les plus liquides (sur les titres peu échangés, le bruit est plus fort encore), les cas contemporains sur plusieurs titres ne sont pas indépendants, et ni frais ni dividendes ne sont inclus. Retenez l’ordre de grandeur : à la BRVM, un croisement du MACD constate une variation d’élan passée ; pris seul, il n’annonce pas la suite.',
      ].join('\n'),
      stats: [
        { label: 'Croisements MACD/Signal', valeur: ent(SIG.croisements), detail: `≈ ${ent(Math.round(SIG.par_valeur_et_par_an))} par valeur et par an, 2021-2026` },
        { label: 'Défaits en 10 séances', valeur: pc(SIG.allers_retours['10'].part_pct), detail: `${pc(SIG.allers_retours['5'].part_pct)} dès 5 séances · ${pc(SIG.allers_retours['20'].part_pct)} en 20 séances` },
        { label: 'Déjà parcouru au croisement haussier', valeur: pcs(SIG.avant_26.haussier_mediane_pct), detail: 'depuis le plus-bas des 26 séances, médiane' },
        { label: 'Ralentissements démentis', valeur: pc(RAL.part_dementi_pct), detail: `avant zéro (${ent(RAL.avance_mediane_seances)} séances d’avance sinon)` },
      ],
      tableau: {
        colonnes: ['Signal mesuré', 'Cas', 'Sens attendu', 'Part, 20 séances après', 'Séance quelconque', 'Intervalle à 95 %', 'Verdict'],
        lignes: [
          ['MACD / Signal — Haussier', SIG.apres_20.haussier, 'Hausse'],
          ['MACD / Signal — Baissier', SIG.apres_20.baissier, 'Baisse'],
          ['Passage ligne zéro — Haussier', ZER.apres_20.haussier, 'Hausse'],
          ['Passage ligne zéro — Baissier', ZER.apres_20.baissier, 'Baisse'],
        ].map(([lib, x, sens]) => [
          lib,
          ent(x.cas),
          sens,
          pc(x.part_pct),
          pc(x.part_base_pct),
          `${fr(x.ic95_pct[0])} à ${fr(x.ic95_pct[1])} %`,
          verdict(x),
        ]),
        note: `Part des cas où le cours, 20 séances après le croisement, était dans le sens attendu. Intervalle de Wilson à 95 %, au moins ${S.parametres.min_cas} cas. ${SRC}`,
      },
      tableaux: [
        {
          colonnes: ['Découpage (croisements MACD/Signal)', 'Haussier : plus haut 20 séances après', 'Baissier : plus bas 20 séances après'],
          lignes: [
            ['2021 à 2023', cellule(SIG.robustesse['2021-2023'].haussier), cellule(SIG.robustesse['2021-2023'].baissier)],
            ['2024 à 2026', cellule(SIG.robustesse['2024-2026'].haussier), cellule(SIG.robustesse['2024-2026'].baissier)],
            ['Croisement sous la ligne zéro', cellule(SIG.robustesse.sous_zero.haussier), cellule(SIG.robustesse.sous_zero.baissier)],
            ['Croisement au-dessus de la ligne zéro', cellule(SIG.robustesse.sur_zero.haussier), cellule(SIG.robustesse.sur_zero.baissier)],
          ],
          note: 'Chaque sous-période est comparée à ses propres séances quelconques. « Écart non établi » : l’intervalle à 95 % contient la part d’une séance quelconque.',
        },
      ],
      graphiques: [
        {
          type: 'bar',
          titre: 'Après le croisement MACD, le cours est-il allé dans son sens plus souvent ? (%, 20 séances après)',
          labels: ['Signal, haussier', 'Signal, baissier', 'Zéro, haussier', 'Zéro, baissier'],
          series: [
            {
              nom: 'Après le croisement',
              valeurs: [SIG.apres_20.haussier, SIG.apres_20.baissier, ZER.apres_20.haussier, ZER.apres_20.baissier].map((x) => x.part_pct),
            },
            {
              nom: 'Séance quelconque',
              valeurs: [SIG.apres_20.haussier, SIG.apres_20.baissier, ZER.apres_20.haussier, ZER.apres_20.baissier].map((x) => x.part_base_pct),
            },
          ],
          unite: '%',
          note: `Dans chaque paire, la barre « après le croisement » n’est jamais au-dessus de celle d’une séance quelconque. ${SRC}`,
          reel: true,
        },
      ],
      encadres: [
        {
          ton: 'cle',
          titre: 'Ce que cela veut dire pour vous',
          texte: 'Le MACD reste utile pour lire le rythme d’une tendance : il montre si un mouvement accélère ou s’essouffle, et aide à éviter de courir après une hausse déjà essoufflée. Un croisement seul ne justifie ni un achat ni une vente : la grille de décision de la leçon 0 demande toujours la tendance de fond, les niveaux de prix, les volumes et un niveau d’invalidation.',
        },
      ],
    },
    {
      type: 'piege',
      titre: 'Les cinq pièges du MACD à la BRVM',
      contenu: 'Construit sur deux moyennes exponentielles, le MACD hérite de leurs défauts et en ajoute un propre à son calcul : sans mouvement de cours, ses deux courbes se rattrapent mécaniquement. Sur la BRVM, cinq pièges reviennent régulièrement.',
      points: [
        {
          titre: 'Les allers-retours en marché sans direction',
          detail: `Dans un marché qui oscille, les croisements s’enchaînent. Sur Société Générale CI (SGBC), du 29 octobre au 9 novembre 2026, le cours évolue dans un couloir de 3,9 % (38 505 à 39 990 FCFA) : en huit séances, le MACD déclenche quatre croisements successifs (haussier le 29/10, baissier le 02/11, haussier le 06/11 sur ${ent(SGBC_EX.seances.find((x) => x.date === '2026-11-06').volume)} titres, baissier dès le 09/11).`,
          verifier: 'La pente de la moyenne 50 séances et l’amplitude du couloir des prix récents.',
        },
        {
          titre: 'Le retard intégré',
          detail: `Au moment d’un croisement haussier MACD/Signal sur les dix valeurs liquides (2021-2026), le cours avait déjà pris ${pcs(SIG.avant_26.haussier_mediane_pct)} en médiane depuis son plus-bas des 26 séances.`,
          verifier: 'La distance déjà parcourue par le cours depuis le dernier creux ou sommet.',
        },
        {
          titre: 'Comparer deux actions en points de cours',
          detail: `Le ${dateFr(SGBC.derniere_date)}, un MACD de ${fr(SGBC.macd, 2)} FCFA sur SGBC (${ent(SGBC.cours)} FCFA) représente ${pc(SGBC.macd_pct, 2)} du cours ; ${fr(ETIT.macd, 2)} FCFA sur ETIT (${ent(ETIT.cours)} FCFA) représentent ${pc(ETIT.macd_pct, 2)}.`,
          verifier: 'Toujours rapporter le MACD au cours de l’action (en %), ou ne le comparer qu’à son propre passé.',
        },
        {
          titre: 'Les séances sans échange : un faux croisement mécanique',
          detail: `Si un cours monte de 10 000 à 12 000 FCFA puis reste figé sans échange, l’EMA 12 rattrape 12 000 plus vite que l’EMA 26 : au bout de ${figeSeancesJusquaZero} séances figées, l’histogramme atteint zéro puis passe négatif sans qu’un seul vendeur n’ait fait baisser le prix. Sur des titres figés 50 séances (${S.liquidite_figees_50.codes.join(' et ')} du ${jjmm(S.liquidite_figees_50.du)} au ${jjmm(S.liquidite_figees_50.au)}/2026), le MACD vaut exactement zéro.`,
          verifier: 'Les volumes récents sur la fiche de la valeur, et sa classe de liquidité.',
        },
        {
          titre: 'Le détachement d’un dividende',
          detail: 'Le jour du détachement d’un dividende important, le cours baisse mécaniquement du montant du coupon. L’EMA 12 réagit deux fois plus vite que l’EMA 26 : le MACD et l’histogramme plongent brutalement, ce qui reflète le dividende et non un retournement de tendance.',
          verifier: 'Le calendrier des dividendes WESTBOURSE avant d’interpréter un plongeon soudain du MACD.',
        },
      ],
    },
    {
      type: 'retenir',
      titre: 'L’essentiel : moyennes mobiles, RSI ou MACD ?',
      contenu: [
        'Le MACD mesure un élan, pas une destination. Il dit si une tendance accélère ou ralentit ; il ne dit ni jusqu’où elle ira, ni quand elle s’arrêtera.',
        'Il complète les moyennes mobiles (leçon 3) et le RSI (leçon 4) sans les remplacer : chacun répond à une question différente. Lus ensemble avec les volumes, ils décrivent l’état d’un graphique. Aucun des trois ne dit si la société mérite votre argent : cette réponse reste dans ses comptes (niveau 2).',
      ].join('\n'),
      tableau: {
        colonnes: ['Indicateur', 'Question posée', 'Échelle', 'Ce qu’il montre bien', 'Limite principale'],
        lignes: [
          ['Moyennes mobiles (20 / 50)', 'Quelle est la direction ?', 'Prix (FCFA)', 'Tendance de fond, lissage du bruit', 'Retard fort, croisements tardifs'],
          ['RSI (14)', 'Le mouvement récent est-il excessif ?', '0 à 100 (comparable)', 'Intensité récente, zones extrêmes', 'Peut rester en excès longtemps'],
          ['MACD (12, 26, 9)', 'La tendance accélère-t-elle ou ralentit-elle ?', 'Points de cours (non comparable)', 'Rythme, essoufflement, divergences', '21 croisements/an, 55 % défaits en 10 séances'],
        ],
        note: 'Synthèse du Module 2 : trois indicateurs, trois questions complémentaires. Aucun ne prévoit le cours de demain.',
      },
      points: [
        { titre: 'Trois composantes', detail: 'MACD = EMA 12 − EMA 26 ; Signal = EMA 9 du MACD ; Histogramme = MACD − Signal (34 séances minimales).' },
        { titre: 'Lire l’histogramme', detail: 'Signe et pente montrent si la hausse ou la baisse accélère ou ralentit ; le changement de signe correspond au croisement MACD/Signal.' },
        { titre: 'Ne jamais comparer entre actions', detail: 'Exprimé en FCFA, le MACD se compare à son propre historique ou se rapporte au cours en pourcentage.' },
        { titre: 'Les croisements, mesurés à la BRVM', detail: 'Près de 21 par an sur les valeurs liquides, plus de la moitié défaits en 10 séances, sans avantage établi à 20 séances face à une séance quelconque.' },
        { titre: 'Toujours vérifier le contexte BRVM', detail: 'Un cours figé fabrique mécaniquement un croisement baissier ; un détachement de dividende fausse l’indicateur pendant plusieurs semaines.' },
      ],
    },
  ],
  charts: [],
  quiz,
  qcm: quiz[0],
  liens: [
    { label: 'Les fiches valeur et leurs graphiques', href: '/actions' },
    { label: 'Le scanner technique', href: '/scanner' },
    { label: 'Notre méthodologie des signaux', href: '/methodologie' },
    { label: 'Le classement de liquidité', href: '/liquidite' },
    { label: 'Le calendrier des dividendes et des assemblées', href: '/calendrier' },
  ],
  avertissement: 'Ceci n’est pas un conseil en investissement. Un indicateur technique décrit le passé des cours ; il ne prédit pas l’avenir. Investir en actions comporte un risque de perte en capital.',
};

const total = lecon.sections.reduce((n, s) => n + s.contenu.length, 0);
const longs = lecon.sections.flatMap((s) => s.contenu.split(/\n+/).filter((p) => p.length > 650).map((p) => `${s.titre} : ${p.length}`));
let plusLongues = 0;
const positions = [0, 0, 0, 0];
for (const q of quiz) {
  const autres = q.options.filter((_, k) => k !== q.correct).map((o) => o.length);
  if (q.options[q.correct].length > Math.max(...autres)) plusLongues += 1;
  positions[q.correct] += 1;
}
fs.writeFileSync(FICHIER, `${JSON.stringify(lecon, null, 2)}\n`, 'utf8');

const MIGRATION = path.join(ICI, '..', '..', 'supabase', 'migrations', '0267_academy_niveau3_lecon5_macd.sql');
const sql = [
  '-- 0267 — Academy niveau 3, leçon 5 enrichie : le MACD, calcul, lecture et croisements mesurés sur la BRVM (2026-11-24).',
  '--',
  '-- Améliorations vérifiées :',
  '--   · calcul pas à pas (paramètres réduits 3, 6, 3) et atelier interactif',
  '--     « atelier_macd » avec scénario « cours figé (sans échange) » ;',
  '--   · traduction des paramètres (12, 26, 9) dans le calendrier réel BRVM',
  '--     (247 à 259 séances/an) et seuil minimal de 34 séances (BBGC : 10/11/2026) ;',
  '--   · non-comparabilité en points de cours chiffrée sur quatre titres réels',
  '--     au 23/11/2026 (ETIT −2,23 = −4,21 % vs SGBC −118,44 = −0,31 %) et MACD en % ;',
  '--   · distinction histogramme / croisement signal / ligne zéro + divergences ;',
  '--   · simulateur technique MACD enrichi : cours synchronisé au-dessus, curseurs',
  '--     12/26/9, synthèse chiffrée dont MACD/cours (%) ;',
  '--   · cas réel daté Orange Côte d’Ivoire (ORAC, oct.–nov. 2026) et piège SGBC ;',
  '--   · 1 031 croisements MACD/Signal, 464 passages zéro et 1 783 ralentissements',
  '--     mesurés sur les 10 valeurs les plus liquides (2021-2026, Wilson 95 %).',
  '-- Source : frontend/lib/academy/contenus/niveau3/l05-macd.json, générée par',
  '-- frontend/scripts/academy-lecon5-macd.mjs depuis',
  '-- niveau3/sources/macd-brvm-2026-11-24.json (scripts/academy-lecon5-stats.mjs).',
  '-- Testée : niveaux3-4.test.ts, simTechnique.test.ts, simulations-contenus.test.ts.',
  '--',
  '-- ⚠️ ORDRE : APRÈS le déploiement du frontend qui connaît le simulateur',
  '-- « atelier_macd » et les champs « rapide / lente / signal ». Sans lui,',
  '-- courseContentSchema refuse le cours et TOUT le niveau 3 répond 404.',
  '--',
  '-- Remplacement de la seule position 5 (leçons 0 à 4 avant elle), gardée par',
  '-- titre (ancien OU nouveau, même préfixe) ; l’ordre des leçons ne change pas,',
  '-- la progression reste valide. Fusion || : les clés absentes (image…) sont',
  '-- conservées. Idempotente. Aucun schéma ne change ; aucune donnée personnelle.',
  '',
  'begin;',
  '',
  'do $do$',
  'declare',
  '  v_titre text;',
  'begin',
  "  select content->'lessons'->5->>'titre' into v_titre",
  "    from public.academy_courses where slug = 'academy-niveau-3-technique' for update;",
  "  if v_titre is null or v_titre not like 'Leçon 5 — Le MACD%' then",
  "    raise exception '0267 : position 5 inattendue (%)', v_titre;",
  '  end if;',
  '',
  '  update public.academy_courses',
  `     set content = jsonb_set(content, '{lessons,5}', (content->'lessons'->5) || $wb$${JSON.stringify(lecon)}$wb$::jsonb),`,
  '         updated_at = now()',
  "   where slug = 'academy-niveau-3-technique';",
  '',
  "  raise notice '0267 : leçon 5 du niveau 3 enrichie';",
  'end',
  '$do$;',
  '',
  'commit;',
  '',
  '-- Vérification : titre, sections, nouveauté.',
  "-- select c.content->'lessons'->5->>'titre', jsonb_array_length(c.content->'lessons'->5->'sections'),",
  "--        c.content->'lessons'->5->'nouveaute'",
  "--   from public.academy_courses c where c.slug = 'academy-niveau-3-technique';",
  '',
].join('\n');
fs.writeFileSync(MIGRATION, sql, 'utf8');

console.log(`écrit l05-macd.json et 0267_academy_niveau3_lecon5_macd.sql — ${lecon.sections.length} sections, ${quiz.length} questions, ${total} caractères ; bonne réponse la plus longue ${plusLongues}/${quiz.length} ; positions A-D ${positions.join('/')}`);
if (longs.length) { console.error('paragraphes trop longs :', longs); process.exitCode = 1; }
if (/NaN|undefined|Infinity/.test(JSON.stringify(lecon))) { console.error('valeur non calculée'); process.exitCode = 1; }
