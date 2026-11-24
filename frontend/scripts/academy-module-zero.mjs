#!/usr/bin/env node
// Génère les leçons du MODULE ZÉRO du niveau 2 (cours complet d'analyse
// fondamentale appliquée à la BRVM) à partir de
// lib/academy/contenus/niveau2/sources/cours-complet-2026-11-23.json.
//
//   node scripts/academy-module-zero.mjs
//
// Aucun chiffre n'est recopié à la main : chaque ratio affiché (croissance,
// TCAM, ROE, marge, PER, rendement, capitalisation, performances) est
// recalculé ici depuis les données lues en base. Les chiffres de tiers
// (Sika Finance, StockAnalysis / S&P Global, BCEAO) sont cités avec leur
// source. niveau2.test.ts recalcule les mêmes valeurs et échoue si un JSON
// diverge de ses sources.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DOSSIER = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau2');
const S = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'sources', 'cours-complet-2026-11-23.json'), 'utf8'));
const T = S.tiers;
const sp = T.stockanalysis_sp;
const ANS = ['2021', '2022', '2023', '2024', '2025'];

// ── Mise en forme française (espace ordinaire en milliers, virgule décimale, signe moins typographique) ──
const fr = (n, d = 1) => {
  if (n == null || !Number.isFinite(n)) return '—';
  const arrondi = Math.abs(n).toFixed(d);
  const [ent, dec] = arrondi.split('.');
  const moins = n < 0 && Number(arrondi) !== 0 ? '−' : '';
  return moins + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? `,${dec}` : '');
};
const pc = (n, d = 1) => (n == null || !Number.isFinite(n) ? '—' : `${fr(n, d)} %`);
const sg = (n, d = 1) => {
  if (n == null || !Number.isFinite(n)) return '—';
  const signe = Number(Math.abs(n).toFixed(d)) === 0 ? '' : n > 0 ? '+' : '−';
  return `${signe}${fr(Math.abs(n), d)} %`;
};
const r = (n, d = 2) => (n == null || !Number.isFinite(n) ? null : Number(n.toFixed(d)));
const md = (v) => fr(v, 1);
const ent = (v) => fr(v, 0);
const fcfa2 = (v) => fr(v, 2);
const mult = (v) => fr(v, 2);

// ── Calculs ──
const varPct = (a, b) => (a == null || b == null || !(b > 0) ? null : (a / b - 1) * 100);
const tcam = (a, b, n) => (Math.pow(b / a, 1 / n) - 1) * 100;

function calculer(code) {
  const s = S.societes[code];
  const A = ANS.map((y) => s.annuel[y]);
  const col = (k) => A.map((a) => a[k] ?? null);
  const revenu = col('revenu');
  const rn = col('rn');
  const cp = col('cp');
  const actif = col('actif');
  const bpa = col('bpa');
  const dpa = col('dpa_comptes');
  const cloture = col('cloture');
  const cours = s.cours['2026-11-23'];
  const d25 = s.dividende_2025;
  return {
    s, revenu, rn, cp, actif, bpa, dpa, cloture, cours, d25,
    croisRev: revenu.map((v, i) => (i === 0 ? null : varPct(v, revenu[i - 1]))),
    croisRn: rn.map((v, i) => (i === 0 ? null : varPct(v, rn[i - 1]))),
    roeClot: rn.map((v, i) => (v / cp[i]) * 100),
    roeMoy: rn.map((v, i) => (i === 0 ? null : (v / ((cp[i - 1] + cp[i]) / 2)) * 100)),
    marge: rn.map((v, i) => (v / revenu[i]) * 100),
    per: cloture.map((c, i) => (c == null ? null : c / bpa[i])),
    rdt: cloture.map((c, i) => (c == null ? null : (dpa[i] / c) * 100)),
    base100: rn.map((v) => (v / rn[0]) * 100),
    cap: (cours * s.titres) / 1e9,
    perAuj: cours / bpa[4],
    perBoc: s.cours['2026-11-20'] / bpa[4],
    perf: {
      jour: varPct(cours, s.cours['2026-11-20']),
      ytd: varPct(cours, cloture[4]),
      unAn: varPct(cours, s.cours['2025-11-24']),
      troisAns: varPct(cours, s.cours['2023-11-23']),
    },
    rdtBrutAuj: d25.brut ? (d25.brut / cours) * 100 : null,
    rdtNetAuj: (d25.net / cours) * 100,
    payoutNet: (d25.net / bpa[4]) * 100,
    tcamRev: tcam(revenu[0], revenu[4], 4),
    tcamRn: tcam(rn[0], rn[4], 4),
    interim: (p, k) => s.interim[p]?.[k] ?? null,
    vi: (p, k, q) => varPct(s.interim[p]?.[k] ?? null, s.interim[q]?.[k] ?? null),
  };
}

const E = calculer('ECOC');
const G = calculer('SGBC');
const N = calculer('SNTS');
const O = calculer('ORAC');
const tE = T.sika_finance.ECOC;
const tG = T.sika_finance.SGBC;
const tO = T.sika_finance.ORAC;
const credDep = (X) => (X.s.annuel['2025'].credits / X.s.annuel['2025'].depots) * 100;
/** ROA et levier sur bilans et capitaux MOYENS 2024-2025 : ROA × levier = ROE moyen. */
const roaMoy = (X) => (X.rn[4] / ((X.actif[3] + X.actif[4]) / 2)) * 100;
const levier = (X) => (X.actif[3] + X.actif[4]) / (X.cp[3] + X.cp[4]);

// ── Briques de leçon ──
const MODULE = 'Module 0 — Le cours complet : analyse fondamentale appliquée à la BRVM';
const AVERT = 'Ceci n’est pas un conseil en investissement. Les ratios décrivent le passé et ne garantissent aucune performance future. Investir en actions comporte un risque de perte en capital.';
const NOUVEAUTE = { type: 'nouveau', depuis: '2026-11-24' };
const SRC_BASE = 'Sources : états financiers publiés (base WESTBOURSE) et clôtures de la BRVM, exercices 2021 à 2025, lus le 24/11/2026 ; calculs WESTBOURSE.';

const ligne = (libelle, valeurs, fmt) => [libelle, ...valeurs.map((v) => (typeof v === 'string' ? v : fmt(v)))];

function lecon(o) {
  return {
    titre: o.titre,
    module: MODULE,
    categorie: 'fundamental',
    duree_min: o.duree_min,
    sous_titre: o.sous_titre,
    resume: o.resume,
    nouveaute: NOUVEAUTE,
    sections: o.sections,
    quiz: o.quiz,
    qcm: o.quiz[0],
    liens: o.liens,
    avertissement: AVERT,
  };
}

function graphique({ type = 'bar', titre, series, valeurs, unite = '', unite_droite = '', note, labels = ANS }) {
  const g = { type, titre, labels, unite, note, reel: true };
  if (series) g.series = series.map((x) => ({ ...x, valeurs: x.valeurs.map((v) => r(v)) }));
  else g.valeurs = valeurs.map((v) => r(v));
  if (unite_droite) g.unite_droite = unite_droite;
  return g;
}

// ════════════════════════════════════════════════════════════════════════════
// Leçon 0.1 — Le principe, le marché BRVM et les sources
// ════════════════════════════════════════════════════════════════════════════
const l01 = lecon({
  titre: 'Leçon 0.1 — Le principe, le marché BRVM et les sources',
  duree_min: 14,
  sous_titre: 'Analyser l’entreprise avant son action : quatre questions, un parcours en six étapes, les particularités de la BRVM et les sources à privilégier.',
  resume: 'L’analyse fondamentale estime la valeur économique d’une entreprise à partir de ses comptes, de son activité, de ses perspectives et des risques qu’elle encourt, puis compare cette valeur estimée au cours de bourse. Cette leçon ouvre le cours complet : les quatre questions à se poser, le parcours d’analyse en six étapes, ce qui distingue la BRVM d’une grande place financière, et les sources à consulter, dans l’ordre de fiabilité.',
  sections: [
    {
      type: 'definition',
      titre: 'Le principe : analyser l’entreprise avant son action',
      contenu: [
        'L’analyse fondamentale consiste à estimer la valeur économique d’une entreprise à partir de ses comptes, de son activité, de ses perspectives et des risques qu’elle encourt. L’objectif est de comparer cette valeur estimée avec le cours en bourse, puis de juger si l’écart justifie un investissement.',
        'Elle s’oppose à une lecture qui ne regarde que le graphique du cours. Un cours monte ou baisse pour des raisons très diverses ; l’analyse fondamentale cherche ce que l’entreprise produit réellement, en bénéfices et en trésorerie, et ce que l’acheteur paie pour y avoir droit.',
        'Quatre questions structurent tout le travail. Chacune renvoie à des documents et à des ratios précis, que les leçons suivantes détaillent un par un, puis appliquent à quatre sociétés cotées : deux banques, Ecobank Côte d’Ivoire et Société Générale Côte d’Ivoire, et deux opérateurs de télécommunications, Sonatel et Orange Côte d’Ivoire.',
      ].join('\n'),
      points: [
        { titre: 'L’entreprise est-elle solide ?', detail: 'Qualité des actifs, niveau d’endettement, liquidité, réserves, risques identifiés dans le rapport d’audit.', verifier: 'Le rapport des commissaires aux comptes : opinion sans réserve ?' },
        { titre: 'Est-elle rentable ?', detail: 'Croissance du chiffre d’affaires ou du produit net bancaire (PNB), évolution des marges, rendement des capitaux propres (ROE), rendement des actifs (ROA).', verifier: 'Les marges sur au moins trois exercices, pas sur un seul.' },
        { titre: 'Génère-t-elle de la trésorerie ?', detail: 'Le bénéfice comptable n’est pas la trésorerie. Il faut examiner les flux de trésorerie opérationnels et disponibles (free cash flow).', verifier: 'Le tableau des flux : les flux d’exploitation suivent-ils le résultat ?' },
        { titre: 'Le cours est-il raisonnable ?', detail: 'Le PER, le P/B et le rendement du dividende permettent de comparer le prix payé avec les résultats générés, en tenant compte de la liquidité du titre.', verifier: 'Le volume échangé : le cours affiché est-il un prix réellement praticable ?' },
      ],
      etapes: [
        { titre: 'Comprendre l’activité et le modèle économique', detail: 'Ce que l’entreprise vend, à qui, avec quels coûts et face à quels concurrents.' },
        { titre: 'Vérifier les comptes et leur qualité', detail: 'Rapport d’audit, annexes, changements de méthode, opérations exceptionnelles.' },
        { titre: 'Mesurer croissance, rentabilité et risques sur plusieurs années', detail: 'Au moins trois exercices, avec les mêmes définitions d’une année sur l’autre.' },
        { titre: 'Estimer la valeur de l’action', detail: 'Multiples (PER, P/B), actualisation des flux (DCF), dividende.', cle: true },
        { titre: 'Tenir compte du cours, de la liquidité et du prix d’exécution', detail: 'Volumes, flottant, écart entre le prix demandé et le prix offert.' },
        { titre: 'Conclure avec des hypothèses et des risques explicites', detail: 'Une valorisation est une approximation : ses hypothèses doivent être écrites.', cle: true },
      ],
      etapes_style: 'frise',
      encadres: [
        { ton: 'cle', titre: 'Règle d’or', texte: 'Un PER faible ne suffit pas à prouver qu’une action est bon marché. Le bénéfice peut être exceptionnel, le risque élevé, la liquidité insuffisante ou les perspectives dégradées. Toujours croiser plusieurs indicateurs.' },
      ],
    },
    {
      type: 'importance',
      titre: 'La BRVM : ce qui change la lecture des chiffres',
      contenu: [
        'La Bourse Régionale des Valeurs Mobilières (BRVM) regroupe les sociétés de l’UEMOA, soit huit pays : Côte d’Ivoire, Sénégal, Burkina Faso, Mali, Niger, Bénin, Togo et Guinée-Bissau. Son marché présente des particularités qui influencent directement l’analyse fondamentale.',
        `La liquidité en donne la mesure. Lors de la séance du 23 novembre 2026, ${ent(N.s.volume_2026_11_23)} actions Sonatel ont changé de mains, contre ${ent(O.s.volume_2026_11_23)} actions Orange Côte d’Ivoire. Les deux sociétés pèsent pourtant plusieurs milliers de milliards de FCFA en bourse : sur la seconde, un ordre important peut à lui seul déplacer le cours.`,
        'Le tableau ci-dessous reprend les six particularités à garder en tête, leur effet sur l’analyse et la précaution qui va avec. Le bloc suivant affiche les derniers cours de quatre grandes valeurs, lus en base au moment où vous ouvrez la leçon.',
      ].join('\n'),
      stats: [
        { label: 'Titres Sonatel échangés le 23/11/2026', valeur: ent(N.s.volume_2026_11_23), detail: 'Séance de la BRVM, base WESTBOURSE' },
        { label: 'Titres Orange CI échangés le même jour', valeur: ent(O.s.volume_2026_11_23), detail: `Soit ${fr(N.s.volume_2026_11_23 / O.s.volume_2026_11_23, 0)} fois moins` },
      ],
      tableau: {
        colonnes: ['Caractéristique', 'Impact sur l’analyse', 'Précaution'],
        lignes: [
          ['Liquidité parfois limitée', 'Certaines actions s’échangent peu. Le dernier cours affiché peut ne pas représenter un prix auquel on peut acheter ou vendre une quantité importante.', 'Vérifier les volumes quotidiens et l’écart achat-vente (bid-ask spread).'],
          ['Flottant variable', 'Une grande partie du capital est souvent détenue par des actionnaires de référence, ce qui réduit les titres réellement disponibles.', 'Consulter le nombre d’actions en circulation et le pourcentage de flottant.'],
          ['Écarts achat-vente importants', 'Le prix demandé par les vendeurs peut être très éloigné du prix offert par les acheteurs.', 'Ne pas se fier au seul cours de clôture. Examiner le carnet d’ordres.'],
          ['Données à dates variables', 'Les rapports peuvent être publiés à des dates différentes selon les sociétés.', 'Homogénéiser les périodes comparées. Toujours indiquer la date de chaque donnée.'],
          ['Diversité sectorielle', 'Banque, assurance, télécoms, agro-industrie, distribution, énergie : les ratios pertinents ne sont pas les mêmes.', 'Ne pas comparer mécaniquement les postes d’une banque avec ceux d’une entreprise industrielle.'],
          ['Référentiel SYSCOHADA', 'Les états financiers sont préparés selon le SYSCOHADA révisé, avec des règles propres aux banques et aux assurances.', 'Vérifier si des comptes consolidés en normes IFRS sont aussi publiés.'],
        ],
        note: 'Le carnet d’ordres de chaque valeur figure sur sa fiche société : la BRVM publie chaque séance la meilleure limite de chaque côté dans son Bulletin officiel de la cote.',
      },
      donnees_reelles: { vue: 'cours', codes: ['SNTS', 'ORAC', 'ECOC', 'SGBC'], actions: 10 },
    },
    {
      type: 'definition',
      titre: 'Les sources à privilégier, dans l’ordre',
      contenu: [
        'Une analyse ne vaut que par ses données. Les sources n’ont pas toutes le même statut : les documents publiés par la société et par la bourse font foi ; les sites d’information et les bases de données retraitent ces documents, parfois avec des définitions différentes.',
        'Ce cours le montre sur des cas réels. Pour une même banque, deux séries de produit net bancaire circulent selon qu’on lit les comptes publiés ou une base standardisée ; pour un même opérateur, trois PER coexistent selon le bénéfice retenu. Aucune n’est fausse : elles ne mesurent pas la même chose.',
      ].join('\n'),
      etapes: [
        { titre: 'BRVM (brvm.org)', detail: 'Rapports d’activité, états financiers, avis et communiqués, cours quotidiens et Bulletin officiel de la cote. Source primaire pour les données officielles.', cle: true },
        { titre: 'Le site de la société cotée', detail: 'Rapport annuel complet, présentation aux investisseurs, communiqués de presse, documents d’assemblée générale.' },
        { titre: 'Sika Finance (sikafinance.com)', detail: 'Cotations en différé, historiques, fiches sociétés, dividendes, actualités et analyses.' },
        { titre: 'Richbourse (richbourse.com)', detail: 'Outils de suivi, historiques, fiches de sociétés et informations de marché BRVM.' },
        { titre: 'StockAnalysis / S&P Global Market Intelligence', detail: 'États financiers standardisés sur cinq ans et plus, ratios calculés : utile pour comparer plusieurs années, à condition de connaître ses définitions.' },
        { titre: 'FGI Bourse, CGF Bourse, allAfrica, Daba Finance', detail: 'Analyses sectorielles, commentaires de résultats trimestriels, contexte macroéconomique régional.' },
      ],
      encadres: [
        { ton: 'info', titre: 'Règle éditoriale', texte: 'Distinguez toujours les données publiées par la société (rapports, communiqués), les cours de marché (BRVM, Sika Finance) et vos propres calculs. Indiquez la période comptable, la date du cours retenu, la devise, les unités et la définition du ratio utilisé.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'L’essentiel',
      contenu: 'L’analyse fondamentale compare une valeur estimée à un prix. Elle se construit sur plusieurs exercices, avec des définitions stables, et elle tient compte de ce qui fait la BRVM : une liquidité inégale, un flottant souvent réduit et des comptes publiés à des dates différentes.',
      points: [
        { titre: 'Quatre questions', detail: 'Solidité, rentabilité, trésorerie, prix : aucune ne suffit seule.' },
        { titre: 'Six étapes', detail: 'De la compréhension de l’activité à une conclusion qui écrit ses hypothèses.' },
        { titre: 'Une source datée pour chaque chiffre', detail: 'Les comptes et la cote font foi ; les bases de données les retraitent.' },
      ],
    },
  ],
  quiz: [
    {
      question: 'Quel est l’objectif de l’analyse fondamentale ?',
      options: [
        'Prévoir le cours de la prochaine séance à partir du graphique',
        'Comparer une valeur estimée de l’entreprise à son cours',
        'Suivre les volumes échangés chaque jour sur la cote',
        'Classer les sociétés cotées selon leur taille',
      ],
      correct: 1,
      explication: 'Elle estime la valeur économique de l’entreprise à partir de ses comptes, de son activité et de ses risques, puis la compare au cours.',
    },
    {
      question: `Le 23 novembre 2026, une société a vu s’échanger ${ent(O.s.volume_2026_11_23)} de ses actions. Quelle précaution s’impose avant de se fier à son dernier cours ?`,
      options: [
        'Aucune, le dernier cours est toujours exécutable',
        'Regarder le volume et le carnet d’ordres',
        'Ne regarder que le PER',
        'Attendre la publication du rapport annuel',
      ],
      correct: 1,
      explication: 'Sur un titre peu échangé, le dernier cours peut ne pas être un prix praticable pour une quantité importante : volume et carnet d’ordres le disent.',
    },
    {
      question: 'Pourquoi un PER faible ne suffit-il pas à conclure qu’une action est bon marché ?',
      options: [
        'Parce que le PER ne dépend pas du cours de bourse',
        'Parce que le bénéfice peut être exceptionnel ou le risque élevé',
        'Parce que le PER n’existe que sur les bourses européennes et américaines',
        'Parce qu’un PER faible est toujours une erreur de calcul',
      ],
      correct: 1,
      explication: 'Un bénéfice non récurrent, un risque élevé, une liquidité insuffisante ou des perspectives dégradées peuvent expliquer un PER bas : c’est la règle d’or de la leçon.',
    },
    {
      question: 'Quelle source fait foi pour les états financiers d’une société cotée à la BRVM ?',
      options: [
        'Un forum de discussion entre investisseurs de la région',
        'Une base de données standardisée',
        'Les documents publiés par la société et par la BRVM',
        'Le dernier article de presse publié sur la société',
      ],
      correct: 2,
      explication: 'Les rapports et états financiers publiés par la société et diffusés par la BRVM sont la source primaire ; les bases de données les retraitent.',
    },
    {
      question: 'Selon quel référentiel les sociétés cotées à la BRVM préparent-elles leurs comptes ?',
      options: [
        'Le SYSCOHADA révisé, avec des plans propres aux banques',
        'Les normes comptables américaines, communes à toutes les places financières',
        'Aucun référentiel commun',
        'Le plan comptable français de 1982',
      ],
      correct: 0,
      explication: 'Le SYSCOHADA révisé s’applique ; banques et assurances suivent des plans spécifiques, et certains groupes publient aussi des comptes consolidés en IFRS.',
    },
  ],
  liens: [
    { label: 'Toutes les actions de la BRVM', href: '/actions' },
    { label: 'La liquidité de chaque valeur', href: '/liquidite' },
    { label: 'Les fiches sociétés', href: '/societes' },
  ],
});

// ════════════════════════════════════════════════════════════════════════════
// Leçon 0.2 — Les ratios essentiels : formules et calculateurs
// ════════════════════════════════════════════════════════════════════════════
const roaE = (E.rn[4] / ((E.actif[3] + E.actif[4]) / 2)) * 100;
const pbE = E.cours / ((E.cp[4] * 1e9) / E.s.titres);
const l02 = lecon({
  titre: 'Leçon 0.2 — Les ratios essentiels : formules et calculateurs',
  duree_min: 18,
  sous_titre: 'Croissance, rentabilité, valorisation, endettement : chaque formule, un exemple tiré des comptes réels et un calculateur pour s’exercer.',
  resume: 'Quatre familles de ratios suffisent pour l’essentiel de l’analyse : la croissance (d’une année sur l’autre et en moyenne annuelle), la rentabilité (marge, ROE, ROA), la valorisation boursière (BPA, PER, P/B, rendement du dividende) et, pour les entreprises non financières, l’endettement. Chaque formule est illustrée par un calcul posé sur des comptes publiés, et des calculateurs permettent de refaire les calculs avec vos propres chiffres.',
  sections: [
    {
      type: 'definition',
      titre: 'Croissance : d’une année sur l’autre, et en moyenne annuelle',
      contenu: [
        'La croissance se mesure d’abord d’une année sur l’autre. Sur plusieurs années, on calcule un taux de croissance annuel moyen (TCAM), qui lisse le parcours : il dit à quel rythme régulier il aurait fallu croître pour passer de la valeur de départ à la valeur d’arrivée.',
        `Exemple réel : le produit net bancaire d’Ecobank Côte d’Ivoire est passé de ${md(E.revenu[0])} à ${md(E.revenu[4])} milliards de FCFA entre 2021 et 2025, soit ${sg(varPct(E.revenu[4], E.revenu[0]))} en quatre ans et un TCAM de ${pc(E.tcamRev)}. En 2025 seule, la progression est de ${pc(E.croisRev[4])}.`,
        'Le nombre d’années n est l’écart entre les deux exercices : de 2021 à 2025, il y en a quatre, pas cinq. C’est l’erreur la plus fréquente sur ce calcul.',
      ].join('\n'),
      formules: [
        { nom: 'Croissance annuelle (chiffre d’affaires ou PNB)', expression: 'Croissance = (CA de l’année N ÷ CA de l’année N−1 − 1) × 100', exemple: `${md(E.revenu[4])} ÷ ${md(E.revenu[3])} − 1 = ${sg(E.croisRev[4])} (PNB d’Ecobank CI en 2025)` },
        { nom: 'Taux de croissance annuel moyen (TCAM)', expression: 'TCAM = (valeur finale ÷ valeur initiale)^(1/n) − 1', exemple: `(${md(E.revenu[4])} ÷ ${md(E.revenu[0])})^(1/4) − 1 = ${pc(E.tcamRev)} par an` },
      ],
      simulation: {
        type: 'croissance',
        consigne: 'Reprenez le PNB d’Ecobank Côte d’Ivoire, puis remplacez par les chiffres d’une autre société : la croissance totale et le TCAM se recalculent.',
        valeur_initiale: E.revenu[0], valeur_finale: E.revenu[4], annees: 4, unite: 'Md FCFA',
      },
    },
    {
      type: 'definition',
      titre: 'Rentabilité : marge nette, ROE et ROA',
      contenu: [
        'La marge nette rapporte le résultat net au chiffre d’affaires. Pour une banque, le produit net bancaire (PNB) remplace le chiffre d’affaires. Le ROE rapporte le résultat net aux capitaux propres, le ROA au total des actifs.',
        'Le ROE se calcule normalement sur les capitaux propres moyens, c’est-à-dire la moyenne entre le début et la fin de l’exercice. Faute de cette moyenne, un ROE calculé sur les capitaux propres de clôture reste indicatif : quand les capitaux propres augmentent dans l’année, il sous-estime légèrement le rendement réellement obtenu.',
        `Exemple réel, Ecobank Côte d’Ivoire en 2025 : ${md(E.rn[4])} milliards de résultat pour des capitaux propres passés de ${md(E.cp[3])} à ${md(E.cp[4])} milliards. ROE de clôture : ${pc(E.roeClot[4])} ; ROE sur capitaux moyens : ${pc(E.roeMoy[4])}. Les deux chiffres sont justes ; ils ne se comparent qu’à méthode égale.`,
      ].join('\n'),
      formules: [
        { nom: 'Marge nette', expression: 'Marge nette = (résultat net ÷ chiffre d’affaires ou PNB) × 100', exemple: `${md(E.rn[4])} ÷ ${md(E.revenu[4])} = ${pc(E.marge[4])} (Ecobank CI, 2025)` },
        { nom: 'ROE', expression: 'ROE = (résultat net ÷ capitaux propres moyens) × 100', exemple: `${md(E.rn[4])} ÷ ((${md(E.cp[3])} + ${md(E.cp[4])}) ÷ 2) = ${pc(E.roeMoy[4])}` },
        { nom: 'ROA', expression: 'ROA = (résultat net ÷ total des actifs moyens) × 100', exemple: `${md(E.rn[4])} ÷ ((${md(E.actif[3])} + ${md(E.actif[4])}) ÷ 2) = ${pc(roaE, 2)}` },
      ],
      simulation: {
        type: 'roe_moyen',
        consigne: 'Les valeurs proposées sont celles d’Ecobank Côte d’Ivoire pour 2025. Modifiez les capitaux propres du début : l’écart entre les deux ROE apparaît.',
        resultat_net: E.rn[4], capitaux_debut: E.cp[3], capitaux_fin: E.cp[4], actif_debut: E.actif[3], actif_fin: E.actif[4], unite: 'Md FCFA',
      },
    },
    {
      type: 'definition',
      titre: 'Valorisation boursière : BPA, PER, P/B et rendement',
      contenu: [
        'Le bénéfice par action (BPA) rapporte le résultat net attribuable aux actionnaires au nombre moyen pondéré d’actions. Le PER divise le cours par le BPA : il dit combien d’années de bénéfice actuel le marché paie. Le P/B compare le cours à la valeur comptable par action. Le rendement du dividende rapporte le dividende au cours.',
        `Exemple réel : à la clôture 2025, l’action Société Générale Côte d’Ivoire valait ${ent(G.cloture[4])} FCFA pour un BPA 2025 de ${fcfa2(G.bpa[4])} FCFA, soit un PER de ${mult(G.per[4])}. Au 23 novembre 2026, au cours de ${ent(N.cours)} FCFA, le dividende net 2025 de Sonatel (${ent(N.d25.net)} FCFA) représente un rendement de ${pc(N.rdtNetAuj, 2)}.`,
        'Deux précautions. Le PER se calcule avec un cours et un bénéfice de la même période ; et pour un groupe qui a des filiales, il faut savoir si le BPA porte sur le résultat consolidé ou sur la seule part du groupe. Les calculateurs ci-dessous lisent aussi les données réelles en base.',
      ].join('\n'),
      formules: [
        { nom: 'BPA', expression: 'BPA = résultat net attribuable aux actionnaires ÷ nombre moyen pondéré d’actions', exemple: `${md(N.rn[4])} milliards ÷ 1 milliard d’actions = ${fcfa2(N.bpa[4])} FCFA (Sonatel 2025, après fractionnement)` },
        { nom: 'PER', expression: 'PER = cours ÷ BPA, ou capitalisation ÷ résultat net', exemple: `${ent(G.cloture[4])} ÷ ${fcfa2(G.bpa[4])} = ${mult(G.per[4])} (SGBC, clôture 2025)` },
        { nom: 'P/B (price to book)', expression: 'P/B = cours ÷ valeur comptable par action', exemple: `Ecobank CI au 23/11/2026 : ${ent(E.cours)} ÷ (${md(E.cp[4])} milliards ÷ ${fr(E.s.titres / 1e6, 2)} millions d’actions) = ${mult(pbE)}` },
        { nom: 'Rendement du dividende', expression: 'Rendement = (dividende par action ÷ cours) × 100', exemple: `${ent(N.d25.net)} ÷ ${ent(N.cours)} = ${pc(N.rdtNetAuj, 2)} (Sonatel, dividende net 2025)` },
      ],
      simulations: [
        {
          type: 'per',
          consigne: 'Le PER de Sonatel au 23/11/2026, sur le BPA consolidé 2025. La croissance de 5 % par an est une hypothèse à modifier, pas une prévision. Choisissez une valeur pour passer aux données réelles.',
          cours: N.cours, bpa: N.bpa[4], croissance_pct: 5, annees: 3, codes: ['SNTS', 'ORAC', 'ECOC', 'SGBC'],
        },
        {
          type: 'pb_roe',
          consigne: 'P/B = PER × ROE : les deux opérateurs de télécommunications au 23/11/2026, sur les comptes 2025.',
          societes: [
            { nom: 'Sonatel (SNTS)', per: r(N.perAuj, 1), roe_pct: r(N.roeClot[4], 1) },
            { nom: 'Orange CI (ORAC)', per: r(O.perAuj, 1), roe_pct: r(O.roeClot[4], 1) },
          ],
          codes: ['SNTS', 'ORAC'],
        },
      ],
    },
    {
      type: 'definition',
      titre: 'Endettement et solvabilité des entreprises non financières',
      contenu: [
        'La dette financière nette retranche la trésorerie des emprunts. Le gearing la rapporte aux capitaux propres ; la couverture des intérêts dit combien de fois le résultat opérationnel paie les charges financières.',
        `Une dette nette négative signifie que l’entreprise détient plus de trésorerie qu’elle ne doit d’emprunts. Selon S&P Global, Sonatel est ainsi passée d’une trésorerie nette (une dette nette de ${ent(sp.dette_nette.SNTS[0])} milliards en 2021) à une dette nette de ${ent(sp.dette_nette.SNTS[4])} milliards en 2025, pendant que ses investissements annuels passaient de ${ent(sp.capex.SNTS[0])} à ${ent(sp.capex.SNTS[4])} milliards.`,
      ].join('\n'),
      formules: [
        { nom: 'Dette financière nette', expression: 'Dette nette = emprunts et dettes financières − trésorerie' },
        { nom: 'Gearing', expression: 'Gearing = (dette nette ÷ capitaux propres) × 100' },
        { nom: 'Couverture des intérêts', expression: 'Couverture = résultat opérationnel ÷ charges d’intérêts' },
      ],
      simulation: {
        type: 'endettement',
        consigne: 'Exemple fictif d’entreprise industrielle : modifiez la trésorerie ou les charges d’intérêts et observez le gearing et la couverture.',
        dettes_financieres: 300, tresorerie: 100, capitaux_propres: 400, resultat_operationnel: 120, charges_interets: 20, unite: 'Md FCFA',
      },
      encadres: [
        { ton: 'alerte', titre: 'Important pour les banques', texte: 'Les ratios de dette nette, de gearing et d’EV/EBITDA sont inadaptés aux banques. Leur bilan est fait de dépôts, de crédits et de placements : la dette y est la matière première. Pour une banque, on examine plutôt la qualité des actifs, les créances en souffrance, le coût du risque, le ratio de solvabilité, le ROE et le P/B (leçon 0.3).' },
      ],
    },
    {
      type: 'retenir',
      titre: 'L’essentiel',
      contenu: 'Chaque ratio répond à une question précise, et chacun a ses pièges de calcul : le nombre d’années du TCAM, les capitaux propres moyens du ROE, la même période pour le cours et le bénéfice du PER, le périmètre consolidé ou part du groupe du BPA.',
      points: [
        { titre: 'Croissance', detail: 'Annuelle pour suivre le rythme, TCAM pour comparer des trajectoires.' },
        { titre: 'Rentabilité', detail: 'Marge, ROE et ROA, à méthode identique d’une société à l’autre.' },
        { titre: 'Valorisation', detail: 'PER, P/B et rendement, toujours datés et sourcés.' },
        { titre: 'Endettement', detail: 'Dette nette, gearing et couverture, jamais pour une banque.' },
      ],
    },
  ],
  quiz: [
    {
      question: 'Un chiffre d’affaires passe de 100 à 146,4 en quatre ans. Quel est le TCAM ?',
      options: ['10 %', '11,6 %', '9,2 %', '46,4 %'],
      correct: 0,
      explication: '(146,4 ÷ 100)^(1/4) − 1 = 1,10 − 1 = 10 % par an. 46,4 % est la croissance totale, pas annuelle.',
    },
    {
      question: 'Résultat net 60, capitaux propres 200 au début et 240 à la fin de l’exercice. Quel est le ROE sur capitaux moyens ?',
      options: ['25,0 %', '27,3 %', '30,0 %', '22,0 %'],
      correct: 1,
      explication: 'Capitaux moyens = (200 + 240) ÷ 2 = 220 ; 60 ÷ 220 = 27,3 %. Sur la seule clôture, on trouverait 25,0 %.',
    },
    {
      question: 'Une action cote 12 000 FCFA pour un BPA de 1 500 FCFA. Quel est son PER ?',
      options: ['6', '8', '12', '18'],
      correct: 1,
      explication: '12 000 ÷ 1 500 = 8 : le marché paie huit années du bénéfice actuel.',
    },
    {
      question: 'Dettes financières 300, trésorerie 100, capitaux propres 400. Quel est le gearing ?',
      options: ['75 %', '100 %', '50 %', '25 %'],
      correct: 2,
      explication: 'Dette nette = 300 − 100 = 200 ; 200 ÷ 400 = 50 %.',
    },
    {
      question: 'Pourquoi n’applique-t-on pas le gearing à une banque ?',
      options: [
        'Parce qu’une banque n’a jamais de capitaux propres au bilan',
        'Parce que ses dépôts sont une dette par nature',
        'Parce que les banques ne publient aucun bilan détaillé',
        'Parce que le gearing d’une banque est toujours égal à zéro',
      ],
      correct: 1,
      explication: 'Les dépôts de la clientèle figurent au passif comme une dette : rapporter cette « dette » aux capitaux propres ne dit rien du risque de la banque.',
    },
  ],
  liens: [
    { label: 'La valorisation de toutes les valeurs', href: '/premium/valorisation' },
    { label: 'Comparer des actions', href: '/actions/compare' },
    { label: 'Le screener', href: '/screener' },
  ],
});

// ════════════════════════════════════════════════════════════════════════════
// Leçon 0.3 — Analyser une banque cotée
// ════════════════════════════════════════════════════════════════════════════
const l03 = lecon({
  titre: 'Leçon 0.3 — Analyser une banque cotée',
  duree_min: 14,
  sous_titre: 'PNB, coût du risque, créances en souffrance, couverture, coefficient d’exploitation, solvabilité : les indicateurs propres aux banques.',
  resume: 'Les banques représentent une part majeure de la capitalisation de la BRVM. Leur analyse exige des indicateurs qui n’ont pas d’équivalent dans l’industrie : le produit net bancaire tient lieu de chiffre d’affaires, le coût du risque mesure la qualité des crédits, et le ratio de solvabilité borne ce que la banque peut prêter. Cette leçon les définit, montre le chemin du crédit accordé au résultat net, et affiche les ratios réels des banques cotées.',
  sections: [
    {
      type: 'definition',
      titre: 'Pourquoi une banque se lit à part',
      contenu: [
        'Une banque vend de l’argent : elle collecte des dépôts, qu’elle prête à un taux plus élevé. Son bilan est fait de dépôts au passif et de crédits à l’actif, et son « chiffre d’affaires » est un écart de taux, complété par des commissions.',
        'Les banques représentent une part majeure de la capitalisation de la BRVM. Leur analyse exige donc des indicateurs spécifiques, qui n’ont pas d’équivalent dans l’industrie classique, et elle se lit toujours avec la qualité du portefeuille de crédits : c’est là que se loge le risque.',
      ].join('\n'),
    },
    {
      type: 'importance',
      titre: 'Les sept indicateurs d’une banque',
      contenu: [
        'Le tableau réunit les indicateurs à suivre, ce qu’ils mesurent et la lecture qui en découle. La plupart sont publiés par les banques elles-mêmes dans leur rapport d’activité ; le ratio de solvabilité est un ratio réglementaire, contrôlé par la Commission bancaire de l’UMOA.',
        `Appliqués aux deux banques étudiées ensuite, ces indicateurs donnent déjà des repères. En 2025, Société Générale Côte d’Ivoire prête ${pc(credDep(G))} de ses dépôts à sa clientèle, Ecobank Côte d’Ivoire ${pc(credDep(E))}. Un rapport élevé n’est pas un défaut en soi : la banque transforme une plus grande part de ses ressources en crédits, ce qui lui rapporte davantage d’intérêts et l’expose davantage au risque de crédit.`,
        `Côté efficacité, Sika Finance donne pour Société Générale Côte d’Ivoire un coefficient d’exploitation de ${pc(tG.coefficient_exploitation_9m_2026_pct)} sur les neuf premiers mois de 2026 : sur 100 francs de PNB, environ ${fr(tG.coefficient_exploitation_9m_2026_pct, 0)} paient les frais généraux. Côté solvabilité, la même banque affiche ${pc(tG.solvabilite_pct)} au premier semestre 2026, pour un minimum réglementaire de ${pc(T.bceao.solvabilite_minimum_pct)}.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Indicateur bancaire', 'Définition', 'Pourquoi c’est important'],
        lignes: [
          ['Produit net bancaire (PNB)', 'Revenus d’intérêts, commissions et autres produits, nets des charges correspondantes, avant le coût du risque.', 'Équivalent du chiffre d’affaires pour une banque : il mesure l’activité globale.'],
          ['Coût du risque', 'Dotations aux provisions pour créances en souffrance, nettes des reprises.', 'Il traduit la qualité du portefeuille de crédits ; un coût du risque faible et stable est un signal positif.'],
          ['Créances en souffrance (NPL)', 'Encours de crédits dont le remboursement est retardé ou compromis.', 'Plus leur part est élevée, plus le risque de crédit est important.'],
          ['Taux de couverture', 'Provisions ÷ créances en souffrance : la part des pertes potentielles déjà provisionnée.', 'Un taux élevé, de l’ordre de 80 % ou plus, traduit une approche prudente.'],
          ['Coefficient d’exploitation', 'Frais généraux ÷ PNB : l’efficacité opérationnelle.', 'Plus il est bas, plus la banque est efficace ; sous 50 %, il est généralement jugé très bon.'],
          ['Ratio de solvabilité', `Fonds propres ÷ actifs pondérés par leur risque. Minimum réglementaire de l’UMOA : ${pc(T.bceao.solvabilite_minimum_pct)} depuis 2023 (rapports annuels de la BCEAO).`, 'Un ratio élevé donne une marge de sécurité réglementaire et de la capacité à prêter.'],
          ['Ratio crédits ÷ dépôts', 'Crédits nets à la clientèle ÷ dépôts de la clientèle.', 'Il indique si la banque finance ses crédits par les ressources qu’elle collecte.'],
        ],
        note: T.bceao.note,
      },
    },
    {
      type: 'importance',
      titre: 'Du crédit accordé au résultat net',
      contenu: [
        'Tout part d’un crédit. S’il est remboursé normalement, il produit des intérêts qui alimentent le PNB puis le résultat. S’il ne l’est pas, il devient une créance en souffrance, que la banque doit provisionner : la provision passe en coût du risque et réduit le résultat net, puis les fonds propres.',
        'C’est pourquoi une banque peut afficher un bénéfice élevé une année et le voir fondre la suivante : il suffit que des crédits accordés trop facilement se dégradent. Le cas d’Ecobank Côte d’Ivoire en 2026, étudié à la leçon 0.4, en donne un exemple mesuré.',
      ].join('\n'),
      flux: [
        { titre: 'Crédit accordé', detail: 'La banque prête l’argent de ses dépôts.', icone: 'paiement' },
        { titre: 'Remboursement régulier ?', detail: 'Le client paie ses échéances.', icone: 'decision' },
        { titre: 'Intérêts → PNB → résultat', detail: 'Si oui : l’écart de taux devient du résultat.', icone: 'benefices' },
      ],
      etapes: [
        { titre: 'Sinon : créance en souffrance', detail: 'Le remboursement est retardé ou compromis.' },
        { titre: 'Provision, puis coût du risque', detail: 'La banque anticipe la perte et la passe en charge.', cle: true },
        { titre: 'Impact sur le résultat net et les fonds propres', detail: 'Moins de résultat, donc moins de réserves et de dividende.' },
      ],
      encadres: [
        { ton: 'cle', titre: 'Lecture clé', texte: 'Une banque peut afficher un bénéfice élevé tout en portant des risques cachés sur ses crédits. Le résultat net doit toujours être lu avec la qualité des actifs, le coût du risque et le niveau de provisionnement.' },
      ],
    },
    {
      type: 'cas',
      titre: 'Calculateur : ce que les frais et le coût du risque laissent à la banque',
      contenu: 'Exemple fictif : une banque dégage 100 milliards de PNB, dépense 45 milliards de frais généraux et provisionne 5 milliards. Faites varier le coût du risque pour voir ce qu’il retire au résultat avant impôt.',
      simulation: { type: 'banque', consigne: 'Doublez le coût du risque : l’effet sur le résultat avant impôt est immédiat.', pnb: 100, frais_generaux: 45, cout_risque: 5, unite: 'Md FCFA' },
    },
    {
      type: 'cas',
      titre: 'Les banques de la BRVM, en direct',
      reel: true,
      contenu: 'Les ratios ci-dessous sont recalculés au chargement de la leçon, sur le dernier exercice publié et le dernier cours connu en base. Ils ne sont donc pas figés à la date de rédaction : comparez-les à ceux du 23 novembre 2026 cités dans les leçons 0.4 à 0.6.',
      donnees_reelles: { vue: 'ratios', codes: ['ECOC', 'SGBC', 'SIBC', 'BOAC', 'NSBC', 'BICC'] },
    },
    {
      type: 'retenir',
      titre: 'L’essentiel',
      contenu: 'Une banque se lit avec ses propres indicateurs : le PNB pour l’activité, le coefficient d’exploitation pour l’efficacité, le coût du risque, les créances en souffrance et leur couverture pour la qualité des crédits, et le ratio de solvabilité pour la marge réglementaire.',
      points: [
        { titre: 'Le risque est dans les crédits', detail: 'Coût du risque et couverture se lisent avant le résultat net.' },
        { titre: `Solvabilité : ${pc(T.bceao.solvabilite_minimum_pct)} au minimum`, detail: 'Ratio de solvabilité total de l’UMOA depuis 2023.' },
        { titre: 'Pas de gearing pour une banque', detail: 'Les dépôts sont une dette par nature.' },
      ],
    },
  ],
  quiz: [
    {
      question: 'Que mesure le coefficient d’exploitation d’une banque ?',
      options: ['La part des crédits en souffrance', 'Les frais généraux rapportés au PNB', 'Les fonds propres rapportés aux actifs', 'Les dépôts rapportés aux crédits'],
      correct: 1,
      explication: 'Frais généraux ÷ PNB : plus il est bas, plus la banque transforme son activité en résultat.',
    },
    {
      question: 'PNB 100, frais généraux 45, coût du risque 5. Quel est le résultat avant impôt ?',
      options: ['55', '50', '45', '60'],
      correct: 1,
      explication: '100 − 45 = 55 de résultat brut d’exploitation, moins 5 de coût du risque : 50.',
    },
    {
      question: 'Quel est le ratio de solvabilité total minimum dans l’UMOA depuis 2023 ?',
      options: ['8,0 %', '10,0 %', '11,5 %', '12,5 %'],
      correct: 2,
      explication: 'Les rapports annuels de la BCEAO donnent 11,5 % depuis la fin de la période transitoire (11,25 % à fin 2022).',
    },
    {
      question: 'Une banque a 40 de créances en souffrance et 36 de provisions. Quel est son taux de couverture ?',
      options: ['80 %', '111 %', '90 %', '36 %'],
      correct: 2,
      explication: '36 ÷ 40 = 90 % : neuf dixièmes des pertes potentielles sont déjà provisionnés.',
    },
    {
      question: 'Pourquoi un bénéfice bancaire élevé ne suffit-il pas à juger une banque ?',
      options: [
        'Parce qu’il peut masquer des crédits qui se dégradent',
        'Parce que les banques ne paient pas d’impôt',
        'Parce que le PNB n’est jamais publié',
        'Parce que le bénéfice d’une banque est toujours exceptionnel',
      ],
      correct: 0,
      explication: 'Le coût du risque et les créances en souffrance disent si le bénéfice tiendra : un portefeuille qui se dégrade finit par peser sur le résultat.',
    },
  ],
  liens: [
    { label: 'Les secteurs', href: '/secteurs' },
    { label: 'Comparer des actions', href: '/actions/compare' },
    { label: 'La valorisation de toutes les valeurs', href: '/premium/valorisation' },
  ],
});

// ════════════════════════════════════════════════════════════════════════════
// Cas réels bancaires : mêmes blocs pour les deux banques, chiffres recalculés
// ════════════════════════════════════════════════════════════════════════════
function tableauBanque(X, revStd) {
  const an = (k) => ANS.map((y) => X.s.annuel[y][k] ?? null);
  const dep = an('depots');
  const cre = an('credits');
  return {
    colonnes: ['Indicateur', ...ANS],
    lignes: [
      ligne('Produit net bancaire, comptes publiés (Md FCFA)', X.revenu, md),
      ligne('Croissance du PNB', X.croisRev, (v) => sg(v)),
      ligne('PNB, série standardisée S&P / StockAnalysis (Md FCFA)', revStd, md),
      ligne('Résultat net (Md FCFA)', X.rn, md),
      ligne('Croissance du résultat net', X.croisRn, (v) => sg(v)),
      ligne('Total du bilan (Md FCFA)', X.actif, md),
      ligne('Capitaux propres (Md FCFA)', X.cp, md),
      ligne('Dépôts de la clientèle (Md FCFA)', dep, md),
      ligne('Crédits à la clientèle (Md FCFA)', cre, md),
      ligne('Crédits ÷ dépôts', cre.map((c, i) => (c == null ? null : (c / dep[i]) * 100)), (v) => pc(v)),
      ligne('ROE sur capitaux propres de clôture', X.roeClot, (v) => pc(v)),
      ligne('ROE sur capitaux propres moyens', X.roeMoy, (v) => pc(v)),
      ligne('Marge nette (résultat net ÷ PNB)', X.marge, (v) => pc(v)),
      ligne('BPA (FCFA)', X.bpa, fcfa2),
      ligne('Cours de clôture de l’année (FCFA)', X.cloture, ent),
      ligne('PER à la clôture de l’année', X.per, mult),
      ligne('Dividende par action publié (FCFA)', X.dpa.map((v, i) => (i === 4 ? `${ent(X.d25.brut)} brut / ${fcfa2(X.d25.net)} net` : fcfa2(v))), (v) => v),
      ligne('Rendement à la clôture de l’année', X.rdt, (v) => pc(v)),
    ],
    note: 'Dividende : montant publié par exercice ; la base fiscale (brut ou net d’impôt) n’est connue avec certitude que pour 2025, d’après le calendrier de paiement des dividendes de la BRVM. Rendement à la clôture = dividende publié de l’exercice ÷ dernier cours de l’année. « — » : donnée absente de la source.',
  };
}

function graphiquesBanque(X, nom) {
  return [
    graphique({
      titre: `${nom} : PNB et résultat net (2021-2025, Md FCFA)`,
      series: [{ nom: 'PNB', valeurs: X.revenu }, { nom: 'Résultat net', valeurs: X.rn }],
      unite: 'Md FCFA',
      note: `Le résultat net progresse de ${pc(varPct(X.rn[4], X.rn[0]))} en quatre ans, le PNB de ${pc(varPct(X.revenu[4], X.revenu[0]))}. ${SRC_BASE}`,
    }),
    graphique({
      titre: `${nom} : cours de clôture de l’année et PER (2021-2025)`,
      series: [{ nom: 'Cours de clôture (FCFA)', valeurs: X.cloture }, { nom: 'PER', valeurs: X.per, type: 'line', axe: 'droite' }],
      unite: 'FCFA', unite_droite: 'x',
      note: `Le PER passe de ${mult(X.per[0])} à ${mult(X.per[4])} : le cours a monté plus vite que le bénéfice. Cliquez sur la légende pour masquer une série. ${SRC_BASE}`,
    }),
    graphique({
      titre: `${nom} : dividende par action publié (FCFA, exercices 2021-2025)`,
      valeurs: X.dpa,
      unite: 'FCFA',
      note: `Dividende de l’exercice tel que publié ; 2025 : ${ent(X.d25.brut)} FCFA brut, ${fcfa2(X.d25.net)} FCFA net. ${SRC_BASE}`,
    }),
  ];
}

function tableauInterim(X, t9m, notes) {
  const L = (lib, p, q, src) => [lib, md(X.interim(p, 'revenu')), sg(X.vi(p, 'revenu', q)), md(X.interim(p, 'rn')), sg(X.vi(p, 'rn', q)), src];
  return {
    colonnes: ['Période 2026', 'PNB (Md FCFA)', 'Variation', 'Résultat net (Md FCFA)', 'Variation', 'Source'],
    lignes: [
      L('1er trimestre (31 mars)', '2026-T1', '2025-T1', 'Base WESTBOURSE'),
      L('1er semestre (30 juin)', '2026-S1', '2025-S1', notes.s1),
      ['9 premiers mois (30 sept.)', md(t9m.pnb_9m_2026), sg(varPct(t9m.pnb_9m_2026, X.interim('2025-T3', 'revenu'))), `${notes.approx ? '≈ ' : ''}${md(t9m.rn_9m_2026)}`, sg(varPct(t9m.rn_9m_2026, X.interim('2025-T3', 'rn'))), `Sika Finance, articles du ${t9m.articles}`],
    ],
    note: 'Comptes non audités. Variations calculées par rapport à la même période de 2025, en base. Les comptes intermédiaires sont des cumuls depuis le 1er janvier.',
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Leçon 0.4 — Ecobank Côte d'Ivoire
// ════════════════════════════════════════════════════════════════════════════
const l04 = lecon({
  titre: 'Leçon 0.4 — Cas réel : Ecobank Côte d’Ivoire (ECOC)',
  duree_min: 18,
  sous_titre: 'Cinq exercices de comptes, le cours, le PER et le dividende, puis les comptes de 2026 : une banque très rentable face à un provisionnement en hausse.',
  resume: `Filiale d’Ecobank Transnational Incorporated (ETI), cotée à la BRVM depuis décembre 2017, Ecobank Côte d’Ivoire affiche un ROE de ${pc(E.roeClot[4])} en 2025 sur ses capitaux propres de clôture. Cette leçon reprend ses comptes 2021-2025 tels qu’ils sont publiés, recalcule chaque ratio, compare deux séries de PNB, puis lit les comptes de 2026 : la hausse du coût du risque y fait reculer le résultat.`,
  sections: [
    {
      type: 'cas',
      titre: 'La fiche au 23 novembre 2026',
      reel: true,
      contenu: [
        `Au 23 novembre 2026, l’action Ecobank Côte d’Ivoire cotait ${ent(E.cours)} FCFA, en recul de ${fr(Math.abs(E.perf.jour), 2)} % sur la séance. Avec ${fr(E.s.titres / 1e6, 2)} millions d’actions, la capitalisation atteint ${md(E.cap)} milliards de FCFA.`,
        `Sur le BPA de l’exercice 2025 (${fcfa2(E.bpa[4])} FCFA), le PER ressort à ${mult(E.perAuj)}. StockAnalysis affiche ${fr(sp.per_ttm.ECOC, 2)} sur douze mois glissants : ce PER intègre les trimestres de 2026, où le résultat recule. Le dividende brut 2025 de ${ent(E.d25.brut)} FCFA représente ${pc(E.rdtBrutAuj, 2)} du cours, soit ${pc(E.rdtNetAuj, 2)} après retenue à la source.`,
        `Depuis le 1er janvier 2026, le titre perd ${fr(Math.abs(E.perf.ytd), 2)} % ; sur un an (depuis le 24/11/2025), ${fr(Math.abs(E.perf.unAn), 2)} %. Sur trois ans (depuis le 23/11/2023), il a gagné ${pc(E.perf.troisAns)}. Le bloc en direct, en bas de section, recalcule ces ratios sur les derniers chiffres disponibles.`,
      ].join('\n'),
      stats: [
        { label: 'Cours au 23/11/2026', valeur: `${ent(E.cours)} FCFA`, detail: `${sg(E.perf.jour, 2)} sur la séance` },
        { label: 'Capitalisation', valeur: `${md(E.cap)} Md FCFA`, detail: `${fr(E.s.titres / 1e6, 2)} millions d’actions` },
        { label: 'PER sur le BPA 2025', valeur: mult(E.perAuj), detail: `${fr(sp.per_ttm.ECOC, 2)} sur 12 mois glissants (StockAnalysis)` },
        { label: 'Rendement du dividende 2025', valeur: pc(E.rdtBrutAuj, 2), detail: `brut ; ${pc(E.rdtNetAuj, 2)} net` },
        { label: 'Depuis le 1er janvier', valeur: sg(E.perf.ytd, 2), detail: `sur un an : ${sg(E.perf.unAn, 2)}` },
        { label: 'Bêta sur un an', valeur: fr(sp.beta_1an.ECOC, 2), detail: 'StockAnalysis / S&P Global' },
      ],
      donnees_reelles: { vue: 'ratios', codes: ['ECOC'] },
    },
    {
      type: 'cas',
      titre: 'Les comptes 2021-2025, recalculés',
      reel: true,
      contenu: [
        `Le tableau reprend les comptes publiés et recalcule chaque ratio. Le PNB passe de ${md(E.revenu[0])} à ${md(E.revenu[4])} milliards de FCFA, soit un TCAM de ${pc(E.tcamRev)} ; le résultat net, de ${md(E.rn[0])} à ${md(E.rn[4])} milliards, soit ${pc(E.tcamRn)} par an. Le résultat croît plus vite que l’activité : la marge nette gagne ${fr(E.marge[4] - E.marge[0], 1)} points en quatre ans.`,
        `Deux séries de PNB circulent. Celle des comptes publiés, ici en première ligne, et celle de S&P Global / StockAnalysis, qui standardise les postes pour comparer des banques du monde entier. Elles concordent pour 2025 (${md(E.revenu[4])} milliards) et divergent avant, signe que les deux séries ne retiennent pas les mêmes postes. Pour suivre une banque dans le temps, gardez une seule série.`,
        'Le rendement est ici calculé à la clôture de l’exercice : dividende de l’année divisé par le dernier cours de l’année. D’autres sites le calculent sur le dividende versé dans l’année ou sur un cours moyen, d’où des chiffres différents pour une même année.',
      ].join('\n'),
      tableau: tableauBanque(E, sp.revenus_standardises.ECOC),
      graphiques: graphiquesBanque(E, 'Ecobank CI'),
      donnees_reelles: { vue: 'historique', codes: ['ECOC'] },
    },
    {
      type: 'cas',
      titre: '2026 : les comptes intermédiaires',
      reel: true,
      contenu: [
        `Les comptes de 2026 ne sont pas audités. Le PNB continue de progresser (${sg(E.vi('2026-S1', 'revenu', '2025-S1'))} au premier semestre), mais le résultat net recule : ${sg(E.vi('2026-S1', 'rn', '2025-S1'))} au premier semestre, et ${sg(varPct(tE.rn_9m_2026, E.interim('2025-T3', 'rn')))} sur neuf mois si l’on rapporte le chiffre de Sika Finance (environ ${md(tE.rn_9m_2026)} milliards) aux ${md(E.interim('2025-T3', 'rn'))} milliards de neuf mois 2025 en base. Sika Finance annonce ${sg(tE.variation_rn_9m_2026_pct)}.`,
        `La cause est connue : un provisionnement renforcé. Selon Sika Finance, le coût du risque atteint ${md(tE.cout_du_risque_s1_2026)} milliards au premier semestre 2026, contre ${md(tE.cout_du_risque_s1_2025)} milliard un an plus tôt. Le taux de couverture des créances en souffrance avoisine ${tE.couverture_s1_2026_pct} % à fin juin 2026, après un coût du risque de seulement ${fr(tE.cout_du_risque_2025_pct, 1)} % en 2025.`,
      ].join('\n'),
      tableau: tableauInterim(E, tE, { s1: `Base WESTBOURSE ; total du bilan ≈ ${fr(tE.bilan_s1_2026, 0)} Md (Sika Finance)`, approx: true }),
      donnees_reelles: { vue: 'cours', codes: ['ECOC'], actions: 10 },
    },
    {
      type: 'importance',
      titre: 'La lecture d’Ecobank Côte d’Ivoire',
      contenu: [
        `Croissance : le PNB progresse chaque année, de ${pc(E.tcamRev)} par an en moyenne de 2021 à 2025, et le résultat net plus vite encore, de ${pc(E.tcamRn)} par an.`,
        `Rentabilité : ROE de ${pc(E.roeClot[4])} sur les capitaux de clôture 2025, ${pc(E.roeMoy[4])} sur les capitaux moyens ; comparez-le aux autres banques cotées dans le bloc en direct de la leçon 0.3. La marge nette atteint ${fr(E.marge[4], 0)} % du PNB en 2025.`,
        `Risque : un coût du risque très faible en 2025, puis un provisionnement nettement renforcé en 2026, qui explique le recul du résultat. Valorisation : le PER de fin d’année passe de ${mult(E.per[0])} en 2021 à ${mult(E.per[4])} en 2025 ; le cours a été réévalué plus vite que le bénéfice, puis il recule en 2026 (${sg(E.perf.ytd, 1)} depuis le 1er janvier).`,
      ].join('\n'),
      simulation: {
        type: 'per',
        consigne: 'Le PER d’Ecobank CI au 23/11/2026, sur le BPA 2025. Passez aux données réelles pour le recalculer au dernier cours.',
        cours: E.cours, bpa: E.bpa[4], croissance_pct: 0, annees: 3, codes: ['ECOC'],
      },
    },
    {
      type: 'retenir',
      titre: 'L’essentiel',
      contenu: 'Ecobank Côte d’Ivoire illustre une banque très rentable dont le résultat dépend, à court terme, de son provisionnement. Ses chiffres se lisent avec une seule série de PNB, un ROE à méthode constante et un dividende dont on connaît la base fiscale.',
      points: [
        { titre: 'Une série, une méthode', detail: 'Comptes publiés et base standardisée divergent : ne les mélangez pas.' },
        { titre: 'Le coût du risque fait le résultat', detail: 'En 2026, il fait reculer le bénéfice malgré un PNB en hausse.' },
        { titre: 'Un PER qui a presque doublé', detail: 'La réévaluation du cours a précédé le bénéfice.' },
      ],
    },
  ],
  quiz: [
    {
      question: `Le PNB d’Ecobank CI passe de ${md(E.revenu[0])} à ${md(E.revenu[4])} milliards entre 2021 et 2025. Quel est le TCAM ?`,
      options: [pc(E.tcamRev), pc(varPct(E.revenu[4], E.revenu[0])), pc(varPct(E.revenu[4], E.revenu[0]) / 5), pc(E.croisRev[4])],
      correct: 0,
      explication: `(${md(E.revenu[4])} ÷ ${md(E.revenu[0])})^(1/4) − 1 = ${pc(E.tcamRev)}. ${pc(varPct(E.revenu[4], E.revenu[0]))} est la croissance totale.`,
    },
    {
      question: `Cours de clôture 2025 : ${ent(E.cloture[4])} FCFA ; BPA 2025 : ${fcfa2(E.bpa[4])} FCFA. Quel est le PER ?`,
      options: [mult(E.perAuj), mult(E.per[4]), mult(E.per[3]), mult(E.per[4] * 1.2)],
      correct: 1,
      explication: `${ent(E.cloture[4])} ÷ ${fcfa2(E.bpa[4])} = ${mult(E.per[4])}.`,
    },
    {
      question: 'Pourquoi le résultat net d’Ecobank CI recule-t-il en 2026 alors que le PNB progresse ?',
      options: [
        'Parce que le nombre d’actions a doublé après une augmentation de capital',
        'Parce que le coût du risque a fortement augmenté',
        'Parce que la banque a cessé de prêter',
        'Parce que le PNB n’est pas publié en 2026',
      ],
      correct: 1,
      explication: `Le coût du risque passe de ${md(tE.cout_du_risque_s1_2025)} à ${md(tE.cout_du_risque_s1_2026)} milliards d’un premier semestre à l’autre (Sika Finance) : un provisionnement prudent pèse sur le résultat.`,
    },
    {
      question: `Le dividende 2025 est de ${ent(E.d25.brut)} FCFA brut. Au cours de ${ent(E.cours)} FCFA, quel est le rendement brut ?`,
      options: [pc(E.rdtNetAuj, 2), pc(E.rdt[4], 2), pc(E.rdtBrutAuj, 2), pc(E.rdtBrutAuj * 1.5, 2)],
      correct: 2,
      explication: `${ent(E.d25.brut)} ÷ ${ent(E.cours)} = ${pc(E.rdtBrutAuj, 2)} ; net de la retenue à la source, ${pc(E.rdtNetAuj, 2)}.`,
    },
    {
      question: 'Deux séries de PNB d’Ecobank CI circulent pour 2022-2024. Que faire pour suivre la banque dans le temps ?',
      options: [
        'Prendre chaque année la série la plus favorable',
        'Additionner les deux séries',
        'Ignorer le PNB et ne regarder que le cours',
        'Garder une seule série, avec sa définition',
      ],
      correct: 3,
      explication: 'Comptes publiés et base standardisée n’ont pas la même définition : mélanger les deux fabriquerait une croissance fausse.',
    },
  ],
  liens: [
    { label: 'Les fiches sociétés', href: '/societes' },
    { label: 'Les dividendes', href: '/dividendes' },
    { label: 'Comparer des actions', href: '/actions/compare' },
  ],
});

// ════════════════════════════════════════════════════════════════════════════
// Leçon 0.5 — Société Générale Côte d'Ivoire
// ════════════════════════════════════════════════════════════════════════════
const l05 = lecon({
  titre: 'Leçon 0.5 — Cas réel : Société Générale Côte d’Ivoire (SGBC)',
  duree_min: 18,
  sous_titre: 'La plus grande banque du cas : croissance qui ralentit, capitaux propres renforcés, solvabilité confortable et un dividende 2025 en forte hausse.',
  resume: `Filiale du groupe Société Générale, présent en Côte d’Ivoire depuis 1941 selon la banque, Société Générale Côte d’Ivoire est la plus grande des deux banques étudiées : ${md(G.revenu[4])} milliards de PNB et ${md(G.actif[4])} milliards de bilan en 2025. Cette leçon reprend ses comptes 2021-2025, recalcule les ratios, explique pourquoi une autre série de PNB, plus élevée, circule, puis lit les comptes de 2026.`,
  sections: [
    {
      type: 'cas',
      titre: 'La fiche au 23 novembre 2026',
      reel: true,
      contenu: [
        `Au 23 novembre 2026, l’action Société Générale Côte d’Ivoire cotait ${ent(G.cours)} FCFA, en recul de ${fr(Math.abs(G.perf.jour), 2)} % sur la séance. Avec ${fr(G.s.titres / 1e6, 2)} millions d’actions, la capitalisation atteint ${fr(G.cap, 1)} milliards de FCFA.`,
        `Sur le BPA 2025 (${fcfa2(G.bpa[4])} FCFA), le PER ressort à ${mult(G.perAuj)} ; StockAnalysis affiche ${fr(sp.per_ttm.SGBC, 2)} sur douze mois glissants. Le dividende brut 2025, ${ent(G.d25.brut)} FCFA, représente ${pc(G.rdtBrutAuj, 2)} du cours, ${pc(G.rdtNetAuj, 2)} net.`,
        `Le titre gagne ${fr(G.perf.ytd, 2)} % depuis le 1er janvier 2026 et ${fr(G.perf.unAn, 1)} % sur un an (depuis le 24/11/2025) : le marché l’a nettement réévalué.`,
      ].join('\n'),
      stats: [
        { label: 'Cours au 23/11/2026', valeur: `${ent(G.cours)} FCFA`, detail: `${sg(G.perf.jour, 2)} sur la séance` },
        { label: 'Capitalisation', valeur: `${fr(G.cap, 1)} Md FCFA`, detail: `${fr(G.s.titres / 1e6, 2)} millions d’actions` },
        { label: 'PER sur le BPA 2025', valeur: mult(G.perAuj), detail: `${fr(sp.per_ttm.SGBC, 2)} sur 12 mois glissants (StockAnalysis)` },
        { label: 'Rendement du dividende 2025', valeur: pc(G.rdtBrutAuj, 2), detail: `brut ; ${pc(G.rdtNetAuj, 2)} net` },
        { label: 'Depuis le 1er janvier', valeur: sg(G.perf.ytd, 2), detail: `sur un an : ${sg(G.perf.unAn, 1)}` },
        { label: 'Bêta sur un an', valeur: fr(sp.beta_1an.SGBC, 2), detail: 'StockAnalysis / S&P Global' },
      ],
      donnees_reelles: { vue: 'ratios', codes: ['SGBC'] },
    },
    {
      type: 'cas',
      titre: 'Les comptes 2021-2025, recalculés',
      reel: true,
      contenu: [
        `Le PNB publié passe de ${md(G.revenu[0])} à ${md(G.revenu[4])} milliards de FCFA, soit ${pc(G.tcamRev)} par an ; le résultat net, de ${md(G.rn[0])} à ${md(G.rn[4])} milliards, soit ${pc(G.tcamRn)} par an. Mais la croissance ralentit nettement : ${sg(G.croisRn[4])} seulement pour le résultat 2025.`,
        `Une série plus élevée circule, de ${md(sp.revenus_standardises.SGBC[0])} à ${md(sp.revenus_standardises.SGBC[4])} milliards : c’est la série standardisée de S&P Global / StockAnalysis, qui ne retient pas le même périmètre. Les comptes intermédiaires tranchent : ${md(G.interim('2025-T3', 'revenu'))} milliards de PNB sur neuf mois 2025, soit un rythme annuel proche des ${md(G.revenu[4])} milliards publiés, pas des ${md(sp.revenus_standardises.SGBC[4])}.`,
        `Les capitaux propres augmentent fortement, de ${md(G.cp[3])} à ${md(G.cp[4])} milliards en 2025 : le ROE de clôture baisse à ${pc(G.roeClot[4])}, alors que le résultat est stable. C’est l’effet mécanique d’un dénominateur qui grossit.`,
      ].join('\n'),
      tableau: tableauBanque(G, sp.revenus_standardises.SGBC),
      graphiques: graphiquesBanque(G, 'Société Générale CI'),
      donnees_reelles: { vue: 'historique', codes: ['SGBC'] },
    },
    {
      type: 'cas',
      titre: '2026 : les comptes intermédiaires',
      reel: true,
      contenu: [
        `Le premier semestre 2026 est stable : PNB ${sg(G.vi('2026-S1', 'revenu', '2025-S1'))}, résultat net ${sg(G.vi('2026-S1', 'rn', '2025-S1'))}. Sur neuf mois, selon Sika Finance, le PNB recule à ${md(tG.pnb_9m_2026)} milliards (${sg(varPct(tG.pnb_9m_2026, G.interim('2025-T3', 'revenu')))} par rapport aux neuf mois 2025 en base) et le résultat net à ${md(tG.rn_9m_2026)} milliards (${sg(varPct(tG.rn_9m_2026, G.interim('2025-T3', 'rn')))}).`,
        `Le bilan franchit ${fr(4000, 0)} milliards au premier semestre (${fr(tG.bilan_s1_2026, 1)} milliards), les capitaux propres atteignent ${fr(tG.cp_s1_2026, 1)} milliards (${sg(tG.variation_cp_pct)} sur un an) et le ratio de solvabilité ${pc(tG.solvabilite_pct)}, bien au-dessus du minimum de ${pc(T.bceao.solvabilite_minimum_pct)}. Le coefficient d’exploitation reste bas, ${pc(tG.coefficient_exploitation_9m_2026_pct)} sur neuf mois ; la hausse du coût du risque (${sg(tG.hausse_cout_risque_s1_pct)} au premier semestre) pèse sur la rentabilité.`,
      ].join('\n'),
      tableau: tableauInterim(G, tG, { s1: `Base WESTBOURSE ; bilan ${fr(tG.bilan_s1_2026, 1)} Md (Sika Finance)`, approx: false }),
      donnees_reelles: { vue: 'cours', codes: ['SGBC'], actions: 5 },
    },
    {
      type: 'importance',
      titre: 'La lecture de Société Générale Côte d’Ivoire',
      contenu: [
        `Taille : la banque détient environ ${tG.part_marche_credits_pct} % des crédits en Côte d’Ivoire (APBEF-CI, avril 2026, via Sika Finance). Croissance : solide jusqu’en 2023, puis quasi nulle pour le résultat 2025.`,
        `Rentabilité : ROE de ${pc(G.roeClot[4])} sur les capitaux de clôture 2025 et ${pc(G.roeMoy[4])} sur les capitaux moyens, en baisse parce que les fonds propres ont été renforcés. La marge nette reste élevée, ${pc(G.marge[4])} du PNB publié.`,
        `Qualité des actifs (2025, Sika Finance) : créances en souffrance autour de ${tG.npl_2025_pct} % des crédits, couverture d’environ ${tG.couverture_2025_pct} %. Valorisation : le PER de fin d’année passe de ${mult(G.per[0])} en 2021 à ${mult(G.per[4])} en 2025, puis à ${mult(G.perAuj)} au cours du 23/11/2026.`,
        `Dividende : le montant publié pour 2025 (${ent(G.dpa[4])} FCFA brut) dépasse de ${pc(varPct(G.dpa[4], G.dpa[3]), 0)} celui publié pour 2024 (${ent(G.dpa[3])} FCFA, base fiscale non précisée) et représente ${pc((G.dpa[4] / G.bpa[4]) * 100, 0)} du BPA 2025. Sa soutenabilité se vérifie dans les flux de trésorerie, pas dans le seul résultat.`,
      ].join('\n'),
      simulation: {
        type: 'per',
        consigne: 'Le PER de SGBC au 23/11/2026, sur le BPA 2025. Passez aux données réelles pour le recalculer au dernier cours.',
        cours: G.cours, bpa: G.bpa[4], croissance_pct: 0, annees: 3, codes: ['SGBC'],
      },
    },
    {
      type: 'retenir',
      titre: 'L’essentiel',
      contenu: 'Société Générale Côte d’Ivoire est une grande banque solide dont la croissance ralentit. Son ROE baisse parce que ses capitaux propres augmentent ; sa valorisation monte parce que le marché l’a réévaluée en 2026.',
      points: [
        { titre: 'Une série de PNB vérifiable', detail: 'Les comptes intermédiaires départagent les séries annuelles.' },
        { titre: 'ROE en baisse, fonds propres en hausse', detail: 'Le dénominateur explique la baisse, pas le résultat.' },
        { titre: 'Solvabilité confortable', detail: `${pc(tG.solvabilite_pct)} pour un minimum de ${pc(T.bceao.solvabilite_minimum_pct)}.` },
      ],
    },
  ],
  quiz: [
    {
      question: `Résultat net 2025 : ${md(G.rn[4])} milliards ; capitaux propres de clôture : ${md(G.cp[4])} milliards. Quel est le ROE de clôture ?`,
      options: [pc(G.roeMoy[4]), pc(G.roeClot[4]), pc(G.roeClot[3]), pc(G.marge[4])],
      correct: 1,
      explication: `${md(G.rn[4])} ÷ ${md(G.cp[4])} = ${pc(G.roeClot[4])}. Sur les capitaux moyens, on trouve ${pc(G.roeMoy[4])}.`,
    },
    {
      question: 'Pourquoi le ROE de SGBC baisse-t-il en 2025 alors que son résultat est stable ?',
      options: [
        'Parce que le PNB a été divisé par deux',
        'Parce que ses capitaux propres ont fortement augmenté',
        'Parce que la banque a cessé de verser le moindre dividende',
        'Parce que le nombre d’actions a été réduit',
      ],
      correct: 1,
      explication: `Les capitaux propres passent de ${md(G.cp[3])} à ${md(G.cp[4])} milliards : à résultat égal, le ROE baisse mécaniquement.`,
    },
    {
      question: `Sur neuf mois 2025, le PNB de SGBC atteint ${md(G.interim('2025-T3', 'revenu'))} milliards. Quelle série annuelle 2025 cela rend-il plausible ?`,
      options: [`Environ ${md(G.revenu[4])} milliards`, `Environ ${md(sp.revenus_standardises.SGBC[4])} milliards`, 'Environ 600 milliards', 'Aucune des deux'],
      correct: 0,
      explication: `Trois trimestres à ${md(G.interim('2025-T3', 'revenu'))} milliards donnent un rythme annuel proche de ${md(G.revenu[4])} ; atteindre ${md(sp.revenus_standardises.SGBC[4])} supposerait un dernier trimestre exceptionnel.`,
    },
    {
      question: `Le ratio de solvabilité de SGBC est de ${pc(tG.solvabilite_pct)}. Que signifie-t-il ?`,
      options: [
        'Que la banque est insolvable',
        'Que ses fonds propres couvrent largement le minimum réglementaire',
        `Que ${pc(tG.solvabilite_pct)} de ses crédits à la clientèle sont aujourd’hui en souffrance`,
        `Que son coefficient d’exploitation est de ${pc(tG.solvabilite_pct)}`,
      ],
      correct: 1,
      explication: `Fonds propres ÷ actifs pondérés : ${pc(tG.solvabilite_pct)} contre un minimum de ${pc(T.bceao.solvabilite_minimum_pct)} dans l’UMOA.`,
    },
    {
      question: `Dividende brut 2025 : ${ent(G.d25.brut)} FCFA ; cours au 23/11/2026 : ${ent(G.cours)} FCFA. Quel est le rendement brut ?`,
      options: [pc(G.rdtNetAuj, 2), pc(G.rdt[4], 2), pc(G.rdtBrutAuj * 1.4, 2), pc(G.rdtBrutAuj, 2)],
      correct: 3,
      explication: `${ent(G.d25.brut)} ÷ ${ent(G.cours)} = ${pc(G.rdtBrutAuj, 2)} ; net, ${pc(G.rdtNetAuj, 2)}.`,
    },
  ],
  liens: [
    { label: 'Les fiches sociétés', href: '/societes' },
    { label: 'Les dividendes', href: '/dividendes' },
    { label: 'Le calendrier', href: '/calendrier' },
  ],
});

// ════════════════════════════════════════════════════════════════════════════
// Leçon 0.6 — Comparer ECOC et SGBC
// ════════════════════════════════════════════════════════════════════════════
const fois = (a, b) => `${fr(a / b, 1)}×`;
const ecartPts = (a, b) => `${a >= b ? 'ECOC' : 'SGBC'} +${fr(Math.abs(a - b), 1)} pts`;
const l06 = lecon({
  titre: 'Leçon 0.6 — Comparer deux banques : ECOC face à SGBC',
  duree_min: 16,
  sous_titre: 'Même pays, même métier, deux profils : la plus rentable face à la plus grande, et ce qu’une comparaison honnête exige d’aligner.',
  resume: 'Ecobank Côte d’Ivoire et Société Générale Côte d’Ivoire exercent le même métier sur le même marché. La première est plus rentable, la seconde plus grande et moins chère au regard du bénéfice. Cette leçon met les deux banques côte à côte, chiffre par chiffre et graphique par graphique, puis rappelle ce qu’il faut aligner avant de conclure.',
  sections: [
    {
      type: 'cas',
      titre: 'Face à face au 23 novembre 2026',
      reel: true,
      contenu: [
        `Au 23 novembre 2026, Ecobank Côte d’Ivoire cotait ${ent(E.cours)} FCFA pour ${md(E.cap)} milliards de capitalisation, Société Générale Côte d’Ivoire ${ent(G.cours)} FCFA pour ${fr(G.cap, 1)} milliards. Le bloc en direct compare leurs ratios sur les derniers chiffres disponibles.`,
        'Les deux banques partagent le même marché, la même monnaie et le même régulateur, la Commission bancaire de l’UMOA. Les écarts qui suivent tiennent donc à leur modèle : taille du bilan, part des dépôts prêtée, niveau de fonds propres, coût du risque. C’est ce qui rend la comparaison instructive, et c’est aussi ce qui en fixe les limites.',
      ].join('\n'),
      stats: [
        { label: 'Ecobank CI : cours', valeur: `${ent(E.cours)} FCFA`, detail: `capitalisation ${md(E.cap)} Md` },
        { label: 'Société Générale CI : cours', valeur: `${ent(G.cours)} FCFA`, detail: `capitalisation ${fr(G.cap, 1)} Md` },
        { label: 'Ecobank CI : ROE 2025', valeur: pc(E.roeClot[4]), detail: 'capitaux de clôture' },
        { label: 'Société Générale CI : ROE 2025', valeur: pc(G.roeClot[4]), detail: 'capitaux de clôture' },
      ],
      donnees_reelles: { vue: 'ratios', codes: ['ECOC', 'SGBC'] },
    },
    {
      type: 'cas',
      titre: 'Tableau de synthèse',
      reel: true,
      contenu: [
        'Chaque ligne compare la même grandeur, calculée de la même façon pour les deux banques. Les montants viennent des comptes 2025 publiés ; les cours, des clôtures du 23 novembre 2026. Le bloc en direct, sous le tableau, affiche le dernier dividende et le rendement au dernier cours.',
        `La colonne « Écart » se lit selon la grandeur : un rapport (« ${fois(G.revenu[4], E.revenu[4])} ») pour les tailles, une variation en pourcentage pour les montants, un écart en points pour les ratios déjà exprimés en pourcentage. Un écart de ${fr(E.roeClot[4] - G.roeClot[4], 1)} points de ROE n’est pas une différence de ${fr(E.roeClot[4] - G.roeClot[4], 1)} % : c’est la distance entre deux pourcentages.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Indicateur', 'ECOC', 'SGBC', 'Écart'],
        lignes: [
          ['PNB 2025 (Md FCFA)', md(E.revenu[4]), md(G.revenu[4]), `SGBC ${fois(G.revenu[4], E.revenu[4])}`],
          ['Résultat net 2025 (Md FCFA)', md(E.rn[4]), md(G.rn[4]), `SGBC ${sg(varPct(G.rn[4], E.rn[4]))}`],
          ['Total du bilan (Md FCFA)', md(E.actif[4]), md(G.actif[4]), `SGBC ${fois(G.actif[4], E.actif[4])}`],
          ['Capitaux propres (Md FCFA)', md(E.cp[4]), md(G.cp[4]), `SGBC ${fois(G.cp[4], E.cp[4])}`],
          ['Dépôts de la clientèle (Md FCFA)', md(E.s.annuel['2025'].depots), md(G.s.annuel['2025'].depots), `SGBC ${sg(varPct(G.s.annuel['2025'].depots, E.s.annuel['2025'].depots))}`],
          ['Crédits ÷ dépôts', pc(credDep(E)), pc(credDep(G)), 'SGBC prête une plus grande part de ses dépôts'],
          ['ROE (capitaux de clôture)', pc(E.roeClot[4]), pc(G.roeClot[4]), ecartPts(E.roeClot[4], G.roeClot[4])],
          ['ROE (capitaux moyens)', pc(E.roeMoy[4]), pc(G.roeMoy[4]), ecartPts(E.roeMoy[4], G.roeMoy[4])],
          ['Marge nette (résultat ÷ PNB)', pc(E.marge[4]), pc(G.marge[4]), ecartPts(E.marge[4], G.marge[4])],
          ['PER à la clôture 2025', mult(E.per[4]), mult(G.per[4]), 'SGBC moins chère'],
          ['PER au 23/11/2026 (BPA 2025)', mult(E.perAuj), mult(G.perAuj), 'SGBC moins chère'],
          ['PER sur 12 mois glissants (StockAnalysis)', fr(sp.per_ttm.ECOC, 2), fr(sp.per_ttm.SGBC, 2), 'SGBC moins chère'],
          ['Dividende 2025 (FCFA)', `${ent(E.d25.brut)} brut / ${fcfa2(E.d25.net)} net`, `${ent(G.d25.brut)} brut / ${fcfa2(G.d25.net)} net`, `SGBC ${fois(G.d25.net, E.d25.net)}`],
          ['Rendement brut au 23/11/2026', pc(E.rdtBrutAuj, 2), pc(G.rdtBrutAuj, 2), `SGBC +${fr(G.rdtBrutAuj - E.rdtBrutAuj, 2)} pt`],
          ['Performance depuis le 1er janvier 2026', sg(E.perf.ytd, 2), sg(G.perf.ytd, 2), 'SGBC nettement devant'],
          ['Bêta sur un an (StockAnalysis)', fr(sp.beta_1an.ECOC, 2), fr(sp.beta_1an.SGBC, 2), 'Sensibilité au marché comparable'],
        ],
        note: SRC_BASE,
      },
      donnees_reelles: { vue: 'rendement', codes: ['ECOC', 'SGBC'] },
    },
    {
      type: 'cas',
      titre: 'Les trajectoires côte à côte',
      reel: true,
      contenu: 'Les cinq graphiques suivants reprennent 2021-2025 pour les deux banques. Cliquez sur la légende pour masquer une série et isoler l’autre. Le dernier ramène les deux résultats à 100 en 2021 : il compare les trajectoires, pas les tailles.',
      graphiques: [
        graphique({ titre: 'PNB comparé (Md FCFA)', series: [{ nom: 'ECOC', valeurs: E.revenu }, { nom: 'SGBC', valeurs: G.revenu }], unite: 'Md FCFA', note: `PNB des comptes publiés. ${SRC_BASE}` }),
        graphique({ titre: 'Résultat net comparé (Md FCFA)', series: [{ nom: 'ECOC', valeurs: E.rn }, { nom: 'SGBC', valeurs: G.rn }], unite: 'Md FCFA', note: `Le résultat de SGBC plafonne depuis 2023 ; celui d’ECOC continue de croître jusqu’en 2025. ${SRC_BASE}` }),
        graphique({ type: 'line', titre: 'PER à la clôture de chaque année', series: [{ nom: 'ECOC', valeurs: E.per }, { nom: 'SGBC', valeurs: G.per }], unite: 'x', note: `Cours de clôture de l’année ÷ BPA de l’exercice. ${SRC_BASE}` }),
        graphique({ type: 'line', titre: 'Rendement du dividende à la clôture de chaque année (%)', series: [{ nom: 'ECOC', valeurs: E.rdt }, { nom: 'SGBC', valeurs: G.rdt }], unite: '%', note: `Dividende de l’exercice tel que publié ÷ dernier cours de l’année : le rendement baisse quand le cours monte plus vite que le dividende. ${SRC_BASE}` }),
        graphique({ type: 'line', titre: 'Résultat net, base 100 en 2021', series: [{ nom: 'ECOC', valeurs: E.base100 }, { nom: 'SGBC', valeurs: G.base100 }], unite: '', note: `ECOC atteint ${fr(E.base100[4], 0)} en 2025, SGBC ${fr(G.base100[4], 0)}. ${SRC_BASE}` }),
      ],
      donnees_reelles: { vue: 'historique', codes: ['ECOC', 'SGBC'] },
    },
    {
      type: 'importance',
      titre: 'Lecture comparée',
      contenu: [
        'Six angles, six constats. Aucun ne suffit à départager les deux banques : c’est leur combinaison, avec des définitions alignées, qui fait l’analyse.',
        `D’où vient l’écart de rentabilité ? Le ROE se décompose : ROE = ROA × levier, le levier rapportant le bilan moyen aux capitaux propres moyens. ECOC obtient un ROA de ${pc(roaMoy(E), 2)} avec un levier de ${fr(levier(E), 1)}, soit un ROE de ${pc(E.roeMoy[4])}. SGBC obtient ${pc(roaMoy(G), 2)} avec un levier de ${fr(levier(G), 1)}, soit ${pc(G.roeMoy[4])}.`,
        'L’écart vient donc des deux côtés : ECOC tire un peu plus de résultat de chaque franc de bilan, et elle le fait avec moins de fonds propres par franc engagé. Un levier plus élevé augmente le ROE quand tout va bien, et réduit le coussin quand les crédits se dégradent : c’est la contrepartie à garder en tête.',
      ].join('\n'),
      formules: [
        {
          nom: 'Décomposition du ROE',
          expression: 'ROE = (résultat net ÷ bilan moyen) × (bilan moyen ÷ capitaux propres moyens) = ROA × levier',
          exemple: `ECOC 2025 : ${pc(roaMoy(E), 2)} × ${fr(levier(E), 2)} = ${pc(E.roeMoy[4])} ; SGBC : ${pc(roaMoy(G), 2)} × ${fr(levier(G), 2)} = ${pc(G.roeMoy[4])}`,
        },
      ],
      points: [
        { titre: 'Taille', detail: `SGBC est nettement plus grande : PNB ${fois(G.revenu[4], E.revenu[4])} plus élevé, bilan ${fois(G.actif[4], E.actif[4])}, capitaux propres ${fois(G.cp[4], E.cp[4])}. Elle détient environ ${tG.part_marche_credits_pct} % des crédits en Côte d’Ivoire (APBEF-CI, avril 2026).` },
        { titre: 'Rentabilité', detail: `ECOC affiche un ROE plus élevé (${pc(E.roeClot[4])} contre ${pc(G.roeClot[4])} sur les capitaux de clôture, ${pc(E.roeMoy[4])} contre ${pc(G.roeMoy[4])} sur les capitaux moyens) et une marge nette supérieure (${pc(E.marge[4])} contre ${pc(G.marge[4])}).` },
        { titre: 'Valorisation', detail: `SGBC est moins chère au regard du bénéfice : PER ${mult(G.perAuj)} contre ${mult(E.perAuj)} au 23/11/2026. Cela peut refléter une croissance plus faible : son PNB recule de ${fr(Math.abs(varPct(tG.pnb_9m_2026, G.interim('2025-T3', 'revenu'))), 1)} % sur neuf mois 2026.` },
        { titre: 'Dividende', detail: `SGBC distribue davantage par action (${fcfa2(G.d25.net)} FCFA net contre ${fcfa2(E.d25.net)}) et offre un rendement brut plus élevé au cours du 23/11/2026 (${pc(G.rdtBrutAuj, 2)} contre ${pc(E.rdtBrutAuj, 2)}).` },
        { titre: 'Qualité des actifs', detail: `ECOC : coût du risque de ${fr(tE.cout_du_risque_2025_pct, 1)} % en 2025, couverture d’environ ${tE.couverture_s1_2026_pct} % à mi-2026. SGBC : créances en souffrance autour de ${tG.npl_2025_pct} %, couverture d’environ ${tG.couverture_2025_pct} % en 2025. Ces indicateurs ne sont pas les mêmes : il faut retrouver le même dans chaque rapport.`, verifier: 'Coût du risque et taux de créances en souffrance ne mesurent pas la même chose.' },
        { titre: 'Tendance boursière 2026', detail: `SGBC gagne ${pc(G.perf.ytd, 1)} depuis le 1er janvier, ECOC perd ${pc(Math.abs(E.perf.ytd), 1)}. Les comptes ne disent pas pourquoi ; on peut seulement constater que SGBC a renforcé ses fonds propres et relevé son dividende, et que le cours d’ECOC avait gagné ${pc(varPct(E.cloture[4], E.cloture[3]), 1)} en 2025.` },
      ],
      simulation: {
        type: 'pb_roe',
        consigne: 'P/B = PER × ROE : les deux banques au 23/11/2026, sur les comptes 2025. Passez aux données réelles pour les recalculer.',
        societes: [
          { nom: 'Ecobank CI (ECOC)', per: r(E.perAuj, 1), roe_pct: r(E.roeClot[4], 1) },
          { nom: 'Société Générale CI (SGBC)', per: r(G.perAuj, 1), roe_pct: r(G.roeClot[4], 1) },
        ],
        codes: ['ECOC', 'SGBC'],
      },
    },
    {
      type: 'piege',
      titre: 'Avertissement de comparabilité',
      contenu: 'Le ROE de clôture et le ROE moyen ne se comparent qu’entre eux. Les deux banques peuvent présenter leurs comptes selon des référentiels différents, SYSCOHADA pour les comptes sociaux, IFRS pour certains comptes consolidés. Et les indicateurs de risque publiés ne sont pas homogènes d’une banque à l’autre.',
      encadres: [
        { ton: 'alerte', titre: 'Ces chiffres illustrent la méthode', texte: 'Ils ne suffisent pas à établir un classement définitif. Pour une comparaison complète, il faut aligner les normes comptables, la définition du résultat, la méthode du ROE, l’indicateur de qualité des crédits, le coût du risque, le dividende et sa base fiscale, le BPA, la date du cours et la liquidité du titre.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'Synthèse : ECOC face à SGBC',
      contenu: [
        `SGBC est plus grande en PNB, en bilan et en capitaux propres. Elle présente un PER plus bas et un rendement du dividende plus élevé, et son cours a progressé en 2026 (${sg(G.perf.ytd, 1)} depuis le 1er janvier).`,
        `ECOC affiche un ROE plus élevé et une meilleure marge nette : elle transforme mieux son PNB en résultat. Son résultat recule en 2026 sous l’effet d’un provisionnement prudent, et son cours recule aussi (${sg(E.perf.ytd, 1)} depuis le 1er janvier).`,
        'Il serait incorrect de désigner une banque « meilleure » sur cette seule base. Cette comparaison est informative et ne constitue pas une recommandation d’achat ou de vente.',
      ].join('\n'),
    },
  ],
  quiz: [
    {
      question: 'Laquelle des deux banques transforme le mieux son PNB en résultat net en 2025 ?',
      options: ['Société Générale CI', 'Les deux à égalité', 'Ecobank CI', 'Impossible à dire sans le cours'],
      correct: 2,
      explication: `Marge nette 2025 : ${pc(E.marge[4])} pour ECOC contre ${pc(G.marge[4])} pour SGBC.`,
    },
    {
      question: `Le résultat net d’ECOC vaut ${fr(E.base100[4], 0)} en 2025, base 100 en 2021. Que mesure ce chiffre ?`,
      options: [
        'Le rendement du dividende versé chaque année depuis 2021',
        `Une progression de ${fr(E.base100[4] - 100, 0)} % du résultat depuis 2021`,
        'Le PER de 2025',
        'La part de marché de la banque',
      ],
      correct: 1,
      explication: `Base 100 : ${md(E.rn[4])} ÷ ${md(E.rn[0])} × 100 = ${fr(E.base100[4], 0)}, soit +${fr(E.base100[4] - 100, 0)} %.`,
    },
    {
      question: 'Pourquoi un PER plus bas ne prouve-t-il pas que SGBC est la meilleure affaire ?',
      options: [
        'Parce que le PER de SGBC est faux',
        'Parce qu’il peut refléter une croissance attendue plus faible',
        'Parce que le PER ne s’applique pas aux banques, seulement aux industriels',
        'Parce que SGBC ne verse pas de dividende',
      ],
      correct: 1,
      explication: 'Le marché paie moins une banque dont le PNB recule en 2026 : un PER bas peut traduire des perspectives plus faibles.',
    },
    {
      question: 'Que faut-il aligner avant de comparer la qualité des crédits de deux banques ?',
      options: [
        'Leur cours de bourse',
        'Leur nombre d’agences et de distributeurs automatiques',
        'Le même indicateur, défini de la même façon',
        'Leur date de création',
      ],
      correct: 2,
      explication: 'Un coût du risque et un taux de créances en souffrance ne mesurent pas la même chose : il faut le même indicateur dans chaque rapport.',
    },
    {
      question: 'P/B = PER × ROE. Avec un PER de 12,5 et un ROE de 29 %, quel est le P/B ?',
      options: ['3,6', '2,3', '4,3', '0,4'],
      correct: 0,
      explication: '12,5 × 0,29 = 3,6 : le cours vaut 3,6 fois les capitaux propres par action.',
    },
  ],
  liens: [
    { label: 'Comparer des actions', href: '/actions/compare' },
    { label: 'La valorisation de toutes les valeurs', href: '/premium/valorisation' },
    { label: 'Les secteurs', href: '/secteurs' },
  ],
});

// ════════════════════════════════════════════════════════════════════════════
// Leçon 0.7 — Télécoms : Sonatel face à Orange Côte d'Ivoire
// ════════════════════════════════════════════════════════════════════════════
function tableauTelecom(X, code) {
  const pdg = sp.rn_part_du_groupe[code];
  return {
    colonnes: ['Indicateur', ...ANS],
    lignes: [
      ligne('Chiffre d’affaires (Md FCFA)', X.revenu, md),
      ligne('Croissance du chiffre d’affaires', X.croisRev, (v) => sg(v)),
      ligne('Résultat net consolidé (Md FCFA)', X.rn, md),
      ligne('Croissance du résultat net consolidé', X.croisRn, (v) => sg(v)),
      ligne('Résultat net part du groupe, S&P (Md FCFA)', pdg, md),
      ligne('BPA consolidé (FCFA)', X.bpa, fcfa2),
      ligne(code === 'ORAC' ? 'EBITDAaL estimé, S&P (Md FCFA)' : 'EBITDA estimé, S&P (Md FCFA)', code === 'ORAC' ? sp.ebitda.ORAC_ebitdaal : sp.ebitda.SNTS, ent),
      ligne('Marge brute, S&P', sp.marge_brute_pct[code], (v) => pc(v)),
      ligne('Marge opérationnelle, S&P', sp.marge_operationnelle_pct[code], (v) => pc(v)),
      ligne('Marge nette consolidée', X.marge, (v) => pc(v)),
      ligne('Marge nette part du groupe', pdg.map((v, i) => (v / X.revenu[i]) * 100), (v) => pc(v)),
      ligne('Capitaux propres (Md FCFA)', X.cp, md),
      ligne('ROE consolidé (capitaux de clôture)', X.roeClot, (v) => pc(v)),
      ligne('Free cash flow, S&P (Md FCFA)', sp.fcf[code], ent),
      ligne('Dette nette, S&P (Md FCFA)', sp.dette_nette[code], ent),
      ligne('Investissements (capex), S&P (Md FCFA)', sp.capex[code], ent),
      ligne('Cours de clôture de l’année (FCFA)', X.cloture, (v) => fr(v, v != null && v % 1 ? 1 : 0)),
      ligne('PER à la clôture (BPA consolidé)', X.per, mult),
      ligne('PER à la clôture (part du groupe, S&P)', sp.per_part_du_groupe[code], mult),
      ligne('Dividende par action publié (FCFA)', X.dpa, fcfa2),
      ligne('Rendement à la clôture de l’année', X.rdt, (v) => pc(v)),
    ],
    note: `Lignes « S&P » : StockAnalysis / S&P Global Market Intelligence, consulté le 23/11/2026. Autres lignes : comptes publiés en base WESTBOURSE et clôtures de la BRVM${code === 'SNTS' ? ', cours et BPA ajustés du fractionnement par 10 du 26/10/2026' : ' ; pas de clôture pour 2021, le titre n’étant coté qu’à partir de fin 2022'}. « — » : donnée absente de la source.`,
  };
}
const rnCroiss9m = (X) => X.vi('2026-T3', 'rn', '2025-T3');
const caCroiss9m = (X) => X.vi('2026-T3', 'revenu', '2025-T3');
const capexPct = (code, X) => (sp.capex[code][4] / X.revenu[4]) * 100;
const l07 = lecon({
  titre: 'Leçon 0.7 — Télécoms : Sonatel face à Orange Côte d’Ivoire',
  duree_min: 22,
  sous_titre: 'La même grille appliquée à deux opérateurs : un groupe multi-pays de très grande taille face à un groupe régional en croissance rapide.',
  resume: 'Après les banques, la même grille d’analyse s’applique à deux opérateurs de télécommunications. Contrairement aux banques, les télécoms se lisent avec les ratios classiques d’endettement, d’EV/EBITDA et de free cash flow. Sonatel est plus grande, plus rentable et plus liquide ; Orange Côte d’Ivoire croît plus vite et se paie plus cher. Cette leçon le montre chiffres à l’appui, et explique pourquoi trois PER différents circulent pour chacune.',
  sections: [
    {
      type: 'definition',
      titre: 'Ce qui change pour un opérateur télécom',
      contenu: [
        'Un opérateur de télécommunications est une entreprise industrielle : il investit lourdement dans ses réseaux (les capex), puis vend des abonnements, des données mobiles et des services financiers comme le mobile money. Sa dette sert à financer ces investissements.',
        'Les ratios écartés pour les banques reprennent donc tout leur sens : dette nette, gearing, EV/EBITDA, free cash flow. Il faut aussi savoir lire un groupe : Sonatel et Orange Côte d’Ivoire consolident des filiales dans plusieurs pays, dont elles ne détiennent pas 100 %. Le résultat consolidé inclut la part des actionnaires minoritaires ; le résultat part du groupe ne la compte pas.',
      ].join('\n'),
    },
    {
      type: 'cas',
      titre: 'Les deux profils',
      reel: true,
      contenu: `Au 23 novembre 2026, Sonatel cotait ${ent(N.cours)} FCFA pour ${fr(N.cap, 0)} milliards de capitalisation (un milliard d’actions depuis le fractionnement), Orange Côte d’Ivoire ${ent(O.cours)} FCFA pour ${fr(O.cap, 1)} milliards : Sonatel pèse ${fr(varPct(N.cap, O.cap), 0)} % de plus en bourse.`,
      points: [
        { titre: 'Sonatel (SNTS)', detail: 'Premier opérateur du Sénégal, présent dans cinq pays (Sénégal, Mali, Guinée-Bissau, Guinée, Sierra Leone). Filiale du groupe Orange, sous la marque Orange. Fondée en 1985, cotée à la BRVM depuis 1998. Action fractionnée le 26/10/2026 : une action ancienne en a donné dix, ce qui a ramené le cours d’environ 40 000 à environ 4 000 FCFA.' },
        { titre: 'Orange Côte d’Ivoire (ORAC)', detail: `Opérateur leader en Côte d’Ivoire, présent aussi au Burkina Faso et au Liberia. Filiale du groupe Orange, cotée à la BRVM depuis fin 2022 (première séance en base le 30/12/2022). Mobile, fixe, internet, fibre et Orange Money ; ${fr(tO.lignes_9m_2026_millions, 2)} millions de lignes à fin septembre 2026 (Sika Finance).` },
      ],
      stats: [
        { label: 'Sonatel : cours au 23/11/2026', valeur: `${ent(N.cours)} FCFA`, detail: `capitalisation ${fr(N.cap, 0)} Md` },
        { label: 'Orange CI : cours au 23/11/2026', valeur: `${ent(O.cours)} FCFA`, detail: `capitalisation ${fr(O.cap, 1)} Md` },
      ],
      donnees_reelles: { vue: 'cours', codes: ['SNTS', 'ORAC'], actions: 10 },
    },
    {
      type: 'cas',
      titre: 'Sonatel : les comptes 2021-2025',
      reel: true,
      contenu: [
        `Le chiffre d’affaires passe de ${md(N.revenu[0])} à ${md(N.revenu[4])} milliards de FCFA (${pc(N.tcamRev)} par an), le résultat net consolidé de ${md(N.rn[0])} à ${md(N.rn[4])} milliards (${pc(N.tcamRn)} par an). La part du groupe, selon S&P Global, est plus faible : ${md(sp.rn_part_du_groupe.SNTS[4])} milliards en 2025, les ${md(N.rn[4] - sp.rn_part_du_groupe.SNTS[4])} milliards d’écart revenant aux actionnaires minoritaires des filiales.`,
        'D’où deux marges nettes et deux PER pour la même année. Aucun n’est faux ; ils ne répondent pas à la même question. Le PER sur le résultat part du groupe mesure ce que l’actionnaire de Sonatel paie pour la part qui lui revient.',
      ].join('\n'),
      tableau: tableauTelecom(N, 'SNTS'),
      donnees_reelles: { vue: 'historique', codes: ['SNTS'] },
    },
    {
      type: 'cas',
      titre: 'Orange Côte d’Ivoire : les comptes 2021-2025',
      reel: true,
      contenu: [
        `Le chiffre d’affaires stagne en 2022 puis accélère : ${sg(O.croisRev[4])} en 2025, à ${md(O.revenu[4])} milliards. Le résultat net consolidé progresse de ${pc(O.croisRn[4])} en 2025, à ${md(O.rn[4])} milliards ; la part du groupe, selon S&P Global, atteint ${md(sp.rn_part_du_groupe.ORAC[4])} milliards.`,
        `Les capitaux propres en base restent stables, entre ${fr(Math.min(...O.cp), 0)} et ${fr(Math.max(...O.cp), 0)} milliards sur la période : c’est sur eux que se calcule le ROE consolidé de ${pc(O.roeClot[4])} en 2025. La dette nette, selon S&P Global, s’établit à ${ent(sp.dette_nette.ORAC[4])} milliards en 2025, contre ${ent(sp.dette_nette.ORAC[1])} milliards en 2022.`,
      ].join('\n'),
      tableau: tableauTelecom(O, 'ORAC'),
      donnees_reelles: { vue: 'historique', codes: ['ORAC'] },
    },
    {
      type: 'cas',
      titre: 'Trajectoires comparées et comptes de 2026',
      reel: true,
      contenu: [
        `Sur neuf mois 2026, Sonatel affiche ${md(N.interim('2026-T3', 'revenu'))} milliards de chiffre d’affaires (${sg(caCroiss9m(N))}) et ${md(N.interim('2026-T3', 'rn'))} milliards de résultat net consolidé (${sg(rnCroiss9m(N))}). Orange Côte d’Ivoire, ${md(O.interim('2026-T3', 'revenu'))} milliards (${sg(caCroiss9m(O))}) et ${md(O.interim('2026-T3', 'rn'))} milliards (${sg(rnCroiss9m(O))}).`,
        `Selon Sika Finance, l’EBITDAaL d’Orange Côte d’Ivoire progresse d’environ ${tO.variation_ebitdaal_9m_2026_pct} % sur neuf mois 2026 et ses investissements hors licences (eCapex) d’environ ${tO.variation_ecapex_9m_2026_pct} %. Le bloc en direct, sous les graphiques, donne le dernier dividende et le rendement au dernier cours.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Période 2026', 'Société', 'Chiffre d’affaires (Md FCFA)', 'Variation', 'Résultat net (Md FCFA)', 'Variation'],
        lignes: [
          ['1er trimestre', 'Sonatel', md(N.interim('2026-T1', 'revenu')), sg(N.vi('2026-T1', 'revenu', '2025-T1')), md(N.interim('2026-T1', 'rn')), sg(N.vi('2026-T1', 'rn', '2025-T1'))],
          ['1er semestre', 'Sonatel', md(N.interim('2026-S1', 'revenu')), sg(N.vi('2026-S1', 'revenu', '2025-S1')), md(N.interim('2026-S1', 'rn')), sg(N.vi('2026-S1', 'rn', '2025-S1'))],
          ['9 premiers mois', 'Sonatel', md(N.interim('2026-T3', 'revenu')), sg(caCroiss9m(N)), md(N.interim('2026-T3', 'rn')), sg(rnCroiss9m(N))],
          ['1er trimestre', 'Orange CI', md(O.interim('2026-T1', 'revenu')), sg(O.vi('2026-T1', 'revenu', '2025-T1')), md(O.interim('2026-T1', 'rn')), sg(O.vi('2026-T1', 'rn', '2025-T1'))],
          ['9 premiers mois', 'Orange CI', md(O.interim('2026-T3', 'revenu')), sg(caCroiss9m(O)), md(O.interim('2026-T3', 'rn')), sg(rnCroiss9m(O))],
        ],
        note: 'Comptes consolidés, non audités, en base WESTBOURSE ; variations par rapport à la même période de 2025. Les comptes intermédiaires sont des cumuls depuis le 1er janvier ; le semestre d’Orange CI n’est pas en base.',
      },
      graphiques: [
        graphique({ titre: 'Chiffre d’affaires comparé (Md FCFA, 2021-2025)', series: [{ nom: 'Sonatel', valeurs: N.revenu }, { nom: 'Orange CI', valeurs: O.revenu }], unite: 'Md FCFA', note: `Sonatel réalise ${fr(N.revenu[4] / O.revenu[4], 1)} fois le chiffre d’affaires d’Orange CI en 2025. ${SRC_BASE}` }),
        graphique({ titre: 'Résultat net consolidé comparé (Md FCFA, 2021-2025)', series: [{ nom: 'Sonatel', valeurs: N.rn }, { nom: 'Orange CI', valeurs: O.rn }], unite: 'Md FCFA', note: `Résultat consolidé, minoritaires compris ; en part du groupe (S&P Global), Sonatel ${md(sp.rn_part_du_groupe.SNTS[4])} et Orange CI ${md(sp.rn_part_du_groupe.ORAC[4])} milliards en 2025. ${SRC_BASE}` }),
        graphique({ type: 'line', titre: 'PER à la clôture de chaque année (BPA consolidé)', series: [{ nom: 'Sonatel', valeurs: N.per }, { nom: 'Orange CI', valeurs: O.per }], unite: 'x', note: `Pas de point pour Orange CI en 2021 : le titre n’était pas encore coté. Sur la part du groupe, les PER sont plus élevés (S&P Global). ${SRC_BASE}` }),
        graphique({ type: 'line', titre: 'Rendement du dividende à la clôture de chaque année (%)', series: [{ nom: 'Sonatel', valeurs: N.rdt }, { nom: 'Orange CI', valeurs: O.rdt }], unite: '%', note: `Dividende de l’exercice tel que publié ÷ dernier cours de l’année. ${SRC_BASE}` }),
      ],
      donnees_reelles: { vue: 'rendement', codes: ['SNTS', 'ORAC'] },
    },
    {
      type: 'cas',
      titre: 'Marché et liquidité au 23 novembre 2026',
      reel: true,
      contenu: [
        `Trois PER circulent pour chaque opérateur, et ils sont tous justes. Sur le BPA consolidé 2025 et le cours du 23/11/2026 : ${mult(N.perAuj)} pour Sonatel, ${mult(O.perAuj)} pour Orange CI. Le Bulletin officiel de la cote du 20/11/2026 donnait ${mult(N.perBoc)} et ${mult(O.perBoc)} : c’est le même calcul au cours du 20 novembre (${ent(N.s.cours['2026-11-20'])} et ${ent(O.s.cours['2026-11-20'])} FCFA).`,
        `StockAnalysis affiche ${fr(sp.per_ttm.SNTS, 2)} et ${fr(sp.per_ttm.ORAC, 2)} : un bénéfice sur douze mois glissants, en part du groupe. Même chose pour le rendement : ${pc(N.rdtNetAuj, 2)} et ${pc(O.rdtNetAuj, 2)} sur le dividende net 2025 et le cours du jour, quand Sika Finance affiche ${fr(T.sika_finance.rendement_affiche.SNTS, 2)} % et ${fr(T.sika_finance.rendement_affiche.ORAC, 2)} %.`,
        `Pour Sonatel, le chiffre de Sika Finance se retrouve en rapportant le même dividende net à la clôture 2025 : ${ent(N.d25.net)} ÷ ${ent(N.cloture[4])} = ${pc(N.rdt[4], 2)}. Même dividende, autre cours. Une analyse sérieuse dit toujours lequel elle utilise.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Indicateur', 'Sonatel (SNTS)', 'Orange CI (ORAC)', 'Écart'],
        lignes: [
          ['Cours au 23/11/2026', `${ent(N.cours)} FCFA`, `${ent(O.cours)} FCFA`, '—'],
          ['Capitalisation', `${fr(N.cap, 0)} Md FCFA`, `${fr(O.cap, 1)} Md FCFA`, `SNTS ${sg(varPct(N.cap, O.cap), 0)}`],
          ['PER (BPA consolidé 2025, cours du 23/11)', mult(N.perAuj), mult(O.perAuj), 'SNTS moins chère'],
          ['PER du Bulletin officiel (20/11/2026)', mult(N.perBoc), mult(O.perBoc), 'Même calcul au cours du 20/11'],
          ['PER sur 12 mois glissants (StockAnalysis)', fr(sp.per_ttm.SNTS, 2), fr(sp.per_ttm.ORAC, 2), 'Part du groupe'],
          ['Dividende 2025 (FCFA)', `${ent(N.d25.net)} net`, `${ent(O.d25.brut)} brut / ${ent(O.d25.net)} net`, '—'],
          ['Rendement net au 23/11/2026', pc(N.rdtNetAuj, 2), pc(O.rdtNetAuj, 2), `SNTS +${fr(N.rdtNetAuj - O.rdtNetAuj, 2)} pt`],
          ['Rendement affiché par Sika Finance', `${fr(T.sika_finance.rendement_affiche.SNTS, 2)} %`, `${fr(T.sika_finance.rendement_affiche.ORAC, 2)} %`, 'Définition propre à Sika'],
          ['ROE consolidé 2025 (capitaux de clôture)', pc(N.roeClot[4]), pc(O.roeClot[4]), `SNTS +${fr(N.roeClot[4] - O.roeClot[4], 1)} pts`],
          ['Marge nette consolidée 2025', pc(N.marge[4]), pc(O.marge[4]), `SNTS +${fr(N.marge[4] - O.marge[4], 1)} pts`],
          ['Taux de distribution 2025 (dividende net ÷ BPA)', pc(N.payoutNet), pc(O.payoutNet), 'ORAC distribue une plus grande part'],
          ['Bêta sur un an (StockAnalysis)', fr(sp.beta_1an.SNTS, 2), fr(sp.beta_1an.ORAC, 2), 'Sensibilité au marché comparable'],
          ['Titres échangés le 23/11/2026', ent(N.s.volume_2026_11_23), ent(O.s.volume_2026_11_23), 'SNTS bien plus liquide'],
          ['Performance depuis le 1er janvier 2026', sg(N.perf.ytd, 2), sg(O.perf.ytd, 2), 'SNTS devant'],
          ['Performance sur un an (depuis le 24/11/2025)', sg(N.perf.unAn, 1), sg(O.perf.unAn, 1), 'SNTS devant'],
          ['Performance sur trois ans (depuis le 23/11/2023)', sg(N.perf.troisAns, 1), sg(O.perf.troisAns, 1), 'SNTS devant'],
        ],
        note: 'Cours, volumes, BPA et dividendes : base WESTBOURSE (clôtures de la BRVM, comptes publiés, calendrier des dividendes). Performances calculées sur nos clôtures aux dates indiquées ; d’autres sites retiennent d’autres dates de référence.',
      },
      encadres: [
        { ton: 'info', titre: 'Pourquoi les sources ne donnent pas le même PER', texte: 'Trois raisons, toujours les mêmes : la date du cours retenu, le bénéfice utilisé (exercice clos ou douze mois glissants, consolidé ou part du groupe) et, pour le rendement, la définition du dividende (brut ou net, de l’exercice ou versé dans l’année). C’est pourquoi ce cours présente les sources côte à côte, chacune avec sa définition.' },
      ],
      simulation: {
        type: 'distribution',
        consigne: `Sonatel 2025 : ${md(N.rn[4])} milliards de résultat consolidé pour 1 milliard d’actions. Avec un taux de distribution de ${fr(N.payoutNet, 0)} %, retrouvez le dividende net par action.`,
        resultat_net: N.rn[4] * 1e9, actions: N.s.titres, taux_distribution_pct: r(N.payoutNet, 1),
      },
      donnees_reelles: { vue: 'ratios', codes: ['SNTS', 'ORAC'] },
    },
    {
      type: 'importance',
      titre: 'Lecture comparée des deux opérateurs',
      contenu: 'Huit angles, huit constats. Comme pour les banques, ils ne désignent pas un gagnant : ils décrivent deux profils.',
      points: [
        { titre: 'Taille et présence', detail: `Sonatel réalise ${fr(N.revenu[4] / O.revenu[4], 1)} fois le chiffre d’affaires d’Orange CI (${md(N.revenu[4])} contre ${md(O.revenu[4])} milliards en 2025), dans cinq pays contre trois. Sa capitalisation dépasse celle d’Orange CI de ${fr(varPct(N.cap, O.cap), 0)} %.` },
        { titre: 'Rentabilité', detail: `Marge nette consolidée de ${pc(N.marge[4])} contre ${pc(O.marge[4])}, ROE de ${pc(N.roeClot[4])} contre ${pc(O.roeClot[4])}, marge opérationnelle de ${pc(sp.marge_operationnelle_pct.SNTS[4])} contre ${pc(sp.marge_operationnelle_pct.ORAC[4])} (S&P Global) : Sonatel garde plus de chaque franc de chiffre d’affaires.` },
        { titre: 'Croissance', detail: `Orange CI croît plus vite : ${sg(O.croisRev[4])} de chiffre d’affaires en 2025 contre ${sg(N.croisRev[4])}, et ${sg(rnCroiss9m(O))} de résultat sur neuf mois 2026 contre ${sg(rnCroiss9m(N))}.` },
        { titre: 'Valorisation', detail: `Sonatel se négocie à un PER de ${mult(N.perAuj)} à ${fr(sp.per_ttm.SNTS, 2)} selon la source, Orange CI de ${mult(O.perAuj)} à ${fr(sp.per_ttm.ORAC, 2)} : le marché paie plus cher chaque franc de bénéfice d’Orange CI.` },
        { titre: 'Trésorerie et investissements', detail: `Capex 2025 : ${ent(sp.capex.SNTS[4])} milliards pour Sonatel (${pc(capexPct('SNTS', N))} du chiffre d’affaires), ${ent(sp.capex.ORAC[4])} pour Orange CI (${pc(capexPct('ORAC', O))}). Free cash flow : ${ent(sp.fcf.SNTS[4])} et ${ent(sp.fcf.ORAC[4])} milliards (S&P Global).` },
        { titre: 'Liquidité boursière', detail: `${ent(N.s.volume_2026_11_23)} titres Sonatel échangés le 23/11/2026, contre ${ent(O.s.volume_2026_11_23)} pour Orange CI. Le fractionnement d’octobre 2026 a aussi ramené le prix d’une action Sonatel à la portée d’un petit budget.` },
        { titre: 'Dividende', detail: `Sonatel distribue ${pc(N.payoutNet, 0)} de son BPA consolidé 2025 en dividende net, avec un dividende net en hausse de ${pc(tcam(N.dpa[0], N.dpa[4], 4))} par an depuis 2021 ; Orange CI distribue ${pc(O.payoutNet, 0)}, mais son rendement au cours du jour est plus faible après la hausse du titre.` },
        { titre: 'Tendance boursière 2026', detail: `Les deux titres progressent : ${sg(N.perf.ytd, 1)} pour Sonatel et ${sg(O.perf.ytd, 1)} pour Orange CI depuis le 1er janvier, dans une année où les deux résultats augmentent.` },
      ],
    },
    {
      type: 'piege',
      titre: 'Avertissement de comparabilité',
      contenu: 'Les PER et les rendements diffèrent selon les sources parce que les définitions et les dates varient. Mélanger un PER consolidé et un PER part du groupe, ou un rendement brut et un rendement net, fausse toute comparaison.',
      encadres: [
        { ton: 'alerte', titre: 'Toujours indiquer la source et la méthode', texte: 'WESTBOURSE calcule ses ratios sur les comptes de l’exercice clos et le dernier cours ; StockAnalysis utilise douze mois glissants et la part du groupe ; Sika Finance affiche un rendement selon sa propre définition du dividende et du cours. Dans toute publication, écrivez lequel vous retenez.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'Synthèse : Sonatel face à Orange Côte d’Ivoire',
      contenu: [
        'Sonatel est plus grande, plus rentable, moins chère au regard du bénéfice et bien plus liquide ; son rendement du dividende est plus élevé. Elle présente un profil de rendement et de stabilité à grande échelle.',
        'Orange Côte d’Ivoire croît plus vite, sur trois marchés, et le marché lui accorde un PER plus élevé : elle présente un profil de croissance, payé plus cher.',
        'Le choix entre les deux profils dépend de l’objectif de chacun. Cette comparaison est informative et ne constitue pas une recommandation d’achat ou de vente.',
      ].join('\n'),
    },
  ],
  quiz: [
    {
      question: `Le résultat consolidé 2025 de Sonatel est de ${md(N.rn[4])} milliards, la part du groupe de ${md(sp.rn_part_du_groupe.SNTS[4])}. À qui revient la différence ?`,
      options: ['À l’État du Sénégal', 'Aux actionnaires minoritaires des filiales', 'Aux banques qui ont financé les investissements du groupe', 'Au fisc'],
      correct: 1,
      explication: 'Le résultat consolidé inclut la part des actionnaires minoritaires des filiales que Sonatel ne détient pas à 100 % ; la part du groupe l’exclut.',
    },
    {
      question: `Au cours du 20/11/2026 (${ent(N.s.cours['2026-11-20'])} FCFA) et avec un BPA consolidé de ${fcfa2(N.bpa[4])} FCFA, quel PER obtient-on pour Sonatel ?`,
      options: [mult(N.perAuj), fr(sp.per_ttm.SNTS, 2), mult(N.perBoc), mult(N.per[4])],
      correct: 2,
      explication: `${ent(N.s.cours['2026-11-20'])} ÷ ${fcfa2(N.bpa[4])} = ${mult(N.perBoc)}, le chiffre du Bulletin officiel de la cote du 20/11/2026.`,
    },
    {
      question: 'Pourquoi StockAnalysis affiche-t-il un PER plus élevé pour Sonatel que celui calculé sur les comptes 2025 ?',
      options: [
        'Parce qu’il utilise un cours plus ancien',
        'Parce qu’il retient un autre bénéfice, en part du groupe et sur douze mois',
        'Parce qu’il ignore le fractionnement d’octobre 2026 et garde l’ancien nombre d’actions',
        'Parce qu’il ajoute le dividende au cours',
      ],
      correct: 1,
      explication: 'Un bénéfice plus petit (part du groupe) au dénominateur donne un PER plus grand : la différence vient de la définition, pas d’une erreur.',
    },
    {
      question: 'Quelle société croît le plus vite en 2025 et sur les neuf premiers mois de 2026 ?',
      options: ['Sonatel', 'Les deux au même rythme', 'Aucune ne croît', 'Orange Côte d’Ivoire'],
      correct: 3,
      explication: `Orange CI : ${sg(O.croisRev[4])} de chiffre d’affaires en 2025 et ${sg(rnCroiss9m(O))} de résultat sur neuf mois 2026.`,
    },
    {
      question: `${ent(N.s.volume_2026_11_23)} titres Sonatel échangés contre ${ent(O.s.volume_2026_11_23)} titres Orange CI le même jour. Qu’en déduire ?`,
      options: [
        'Qu’Orange CI est plus chère',
        'Qu’un ordre important s’exécute plus facilement sur Sonatel',
        'Que Sonatel verse chaque année un dividende plus élevé que celui d’Orange Côte d’Ivoire',
        'Que les deux titres sont aussi liquides',
      ],
      correct: 1,
      explication: 'Un volume élevé signifie qu’un ordre trouve plus facilement une contrepartie sans déplacer le cours.',
    },
  ],
  liens: [
    { label: 'Comparer des actions', href: '/actions/compare' },
    { label: 'La liquidité de chaque valeur', href: '/liquidite' },
    { label: 'Les dividendes', href: '/dividendes' },
  ],
});

// ════════════════════════════════════════════════════════════════════════════
// Leçon 0.8 — Méthode, signaux d'alerte et conclusion
// ════════════════════════════════════════════════════════════════════════════
const tendance = (a, b) => (b > a * 1.02 ? 'En hausse' : b < a * 0.98 ? 'En baisse' : 'Stable');
const l08 = lecon({
  titre: 'Leçon 0.8 — Méthode, signaux d’alerte et conclusion',
  duree_min: 16,
  sous_titre: 'La méthode en huit étapes, les huit signaux d’alerte, un tableau de suivi rempli, les erreurs courantes et un modèle de conclusion.',
  resume: 'Cette dernière leçon du module rassemble l’outillage : la méthode pratique en huit étapes, les signaux d’alerte à reconnaître, un modèle de tableau de suivi rempli avec les comptes d’Ecobank Côte d’Ivoire, les erreurs les plus courantes et leur correction, les conclusions des deux comparaisons, un modèle de conclusion pour une fiche et la liste des sources consultées.',
  sections: [
    {
      type: 'definition',
      titre: 'La méthode pratique en huit étapes',
      contenu: [
        'Les huit étapes reprennent le parcours de la leçon 0.1 en le rendant opérationnel. Chacune produit quelque chose : un tableau, une note, une hypothèse écrite.',
        'L’ordre compte. Choisir les ratios avant d’avoir compris l’activité conduit à appliquer à une banque les indicateurs d’un industriel ; évaluer avant d’avoir vérifié la qualité des comptes revient à valoriser un bénéfice qui n’existe peut-être pas.',
      ].join('\n'),
      etapes: [
        { titre: 'Rassembler les données', detail: 'Les états financiers sur au moins trois exercices ; la date et la source de chaque donnée.' },
        { titre: 'Vérifier la qualité', detail: 'Le rapport d’audit, les annexes, les changements de méthode et les opérations exceptionnelles.' },
        { titre: 'Comprendre l’activité', detail: 'Le modèle économique, les clients, les coûts, les concurrents et les risques principaux.' },
        { titre: 'Observer les tendances', detail: 'PNB ou chiffre d’affaires, marges, résultat net, BPA, dette, flux de trésorerie et dividendes sur plusieurs années.' },
        { titre: 'Choisir les ratios adaptés', detail: 'Ceux du secteur : pas les indicateurs d’une entreprise industrielle pour une banque.', cle: true },
        { titre: 'Évaluer la valorisation', detail: 'Plusieurs méthodes (multiples, DCF, dividende) et plusieurs scénarios, pas un seul chiffre.' },
        { titre: 'Tenir compte du marché', detail: 'Liquidité, flottant, écart achat-vente et volumes : le prix affiché n’est pas forcément un prix d’exécution réaliste.' },
        { titre: 'Conclure avec équilibre', detail: 'Forces, faiblesses, risques, hypothèses de valorisation et ce qui pourrait changer l’analyse.', cle: true },
      ],
    },
    {
      type: 'piege',
      titre: 'Risques et signaux d’alerte',
      contenu: [
        'Huit situations doivent faire ralentir l’analyse. Aucune n’est une condamnation ; chacune appelle une vérification dans les comptes.',
        `Appliqués aux sociétés de ce module, ces signaux orientent les vérifications sans rien trancher. Le dividende publié pour 2025 par Société Générale Côte d’Ivoire représente ${pc((G.dpa[4] / G.bpa[4]) * 100, 0)} de son BPA : un taux élevé, qui reste sous le bénéfice mais appelle un regard sur les flux de trésorerie. Orange Côte d’Ivoire distribue ${pc(O.payoutNet, 0)} de son BPA en dividende net, Sonatel ${pc(N.payoutNet, 0)}.`,
        `La dette nette de Sonatel, selon S&P Global, passe de ${ent(sp.dette_nette.SNTS[3])} milliards en 2024 à ${ent(sp.dette_nette.SNTS[4])} milliards en 2025 ; elle reste modeste au regard de son free cash flow (${ent(sp.fcf.SNTS[4])} milliards en 2025). Chez Ecobank Côte d’Ivoire, c’est le coût du risque qui se tend en 2026, après une année 2025 très favorable : le signal à suivre est la qualité des crédits, pas l’endettement.`,
      ].join('\n'),
      points: [
        { titre: 'Bénéfices en hausse, trésorerie en baisse', detail: 'Si les bénéfices progressent mais que les flux de trésorerie opérationnels se dégradent durablement, il faut chercher une hausse des créances, des stocks ou d’autres éléments.' },
        { titre: 'Dette qui progresse plus vite que les résultats', detail: 'Un endettement croissant sans croissance proportionnelle des résultats est un signal de risque.' },
        { titre: 'Réserves du commissaire aux comptes', detail: 'Des réserves d’audit ou des retards importants de publication doivent alerter sur la qualité de l’information.' },
        { titre: 'Dividendes supérieurs aux bénéfices', detail: 'Si les dividendes dépassent durablement les bénéfices et les flux de trésorerie, la distribution n’est pas soutenable.' },
        { titre: 'Dépendance excessive', detail: 'Une forte dépendance à un produit, un client, un fournisseur ou une matière première augmente le risque.' },
        { titre: 'Résultat reposant sur l’exceptionnel', detail: 'Un résultat gonflé par des éléments non récurrents (cession d’actifs, reprise de provisions) ne préjuge pas de la rentabilité future.' },
        { titre: 'Faible flottant ou échanges rares', detail: 'Un titre peu liquide est difficile à acheter ou à vendre sans effet sur le cours : le prix affiché peut être trompeur.' },
        { titre: 'Dilution des actionnaires', detail: 'Des augmentations de capital répétées diluent la part des actionnaires existants sans contrepartie claire.' },
      ],
    },
    {
      type: 'cas',
      titre: 'Modèle de tableau de suivi, rempli avec Ecobank Côte d’Ivoire',
      reel: true,
      contenu: [
        'Le modèle tient sur une page : trois exercices, une tendance, une source datée par ligne. Reproduisez-le pour chaque société suivie ; le bloc en direct, en dessous, recalcule les ratios au dernier cours.',
        `La colonne « Tendance » compare 2025 à 2023 : « en hausse » au-delà de +2 %, « en baisse » en deçà de −2 %, « stable » entre les deux. Sur Ecobank Côte d’Ivoire, presque tout monte : PNB, résultat, fonds propres, dividende. Mais le PER passe aussi de ${mult(E.per[2])} à ${mult(E.per[4])}, et le rendement à la clôture recule de ${pc(E.rdt[2])} à ${pc(E.rdt[4])}. Le tableau dit à la fois que l’entreprise a progressé et que son cours a progressé plus vite qu’elle.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Indicateur', '2023', '2024', '2025', 'Tendance', 'Source et date'],
        lignes: [
          ['PNB (Md FCFA)', md(E.revenu[2]), md(E.revenu[3]), md(E.revenu[4]), tendance(E.revenu[2], E.revenu[4]), 'Comptes publiés, BRVM'],
          ['Résultat net (Md FCFA)', md(E.rn[2]), md(E.rn[3]), md(E.rn[4]), tendance(E.rn[2], E.rn[4]), 'Comptes publiés, BRVM'],
          ['ROE (capitaux de clôture)', pc(E.roeClot[2]), pc(E.roeClot[3]), pc(E.roeClot[4]), tendance(E.roeClot[2], E.roeClot[4]), 'Calcul WESTBOURSE'],
          ['Total du bilan (Md FCFA)', md(E.actif[2]), md(E.actif[3]), md(E.actif[4]), tendance(E.actif[2], E.actif[4]), 'Comptes publiés, BRVM'],
          ['Capitaux propres (Md FCFA)', md(E.cp[2]), md(E.cp[3]), md(E.cp[4]), tendance(E.cp[2], E.cp[4]), 'Comptes publiés, BRVM'],
          ['Dividende par action publié (FCFA)', fcfa2(E.dpa[2]), fcfa2(E.dpa[3]), `${ent(E.d25.brut)} brut`, tendance(E.dpa[2], E.dpa[4]), 'Calendrier des dividendes, BRVM'],
          ['PER à la clôture de l’année', mult(E.per[2]), mult(E.per[3]), mult(E.per[4]), tendance(E.per[2], E.per[4]), 'Calcul WESTBOURSE'],
          ['Rendement à la clôture de l’année', pc(E.rdt[2]), pc(E.rdt[3]), pc(E.rdt[4]), tendance(E.rdt[2], E.rdt[4]), 'Calcul WESTBOURSE'],
          ['Cours de clôture de l’année (FCFA)', ent(E.cloture[2]), ent(E.cloture[3]), ent(E.cloture[4]), tendance(E.cloture[2], E.cloture[4]), 'Clôtures de la BRVM'],
        ],
        note: 'Une tendance « en hausse » du PER ou « en baisse » du rendement n’est ni bonne ni mauvaise en soi : elle dit que le cours a monté plus vite que le bénéfice ou le dividende.',
      },
      donnees_reelles: { vue: 'ratios', codes: ['ECOC'] },
    },
    {
      type: 'piege',
      titre: 'Erreurs courantes à éviter',
      contenu: [
        'Neuf erreurs reviennent sans cesse, chez les débutants comme chez les lecteurs pressés. Chacune a sa correction.',
        `Ce module en a croisé plusieurs sur des cas réels. Trois PER différents pour Sonatel au même moment (${mult(N.perAuj)}, ${mult(N.perBoc)} et ${fr(sp.per_ttm.SNTS, 2)}) illustrent l’erreur des périodes et des définitions mélangées. Deux séries de PNB pour Ecobank Côte d’Ivoire illustrent celle des données retraitées. Le rendement de ${fr(T.sika_finance.rendement_affiche.SNTS, 2)} % affiché pour Sonatel, qui se retrouve exactement sur la clôture 2025 et non sur le cours du jour, illustre celle de la date du cours.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Erreur', 'Correction'],
        lignes: [
          ['Conclure qu’une action est bon marché parce que son cours est bas.', 'Un cours bas peut refléter des problèmes fondamentaux. Comparez avec une valeur estimée, pas avec un cours passé.'],
          ['Acheter sur la base d’un PER faible sans vérifier la qualité des bénéfices.', 'Vérifiez si le bénéfice est récurrent ou exceptionnel. Privilégiez un bénéfice normalisé.'],
          ['Confondre bénéfice comptable et trésorerie disponible.', 'Examinez le tableau des flux de trésorerie : le bénéfice peut être positif alors que la trésorerie se dégrade.'],
          ['Comparer directement des sociétés de secteurs différents.', 'Les ratios pertinents varient selon le secteur. Ne comparez pas une banque avec une entreprise industrielle.'],
          ['Utiliser un dividende passé comme s’il était garanti.', 'Le dividende futur n’est jamais garanti. Examinez les bénéfices et les flux de trésorerie pour juger sa soutenabilité.'],
          ['Calculer un ratio avec des données de périodes différentes.', 'Homogénéisez les périodes : le PER doit associer un cours et un bénéfice de la même période.'],
          ['Ignorer la liquidité du titre.', 'Vérifiez les volumes et l’écart achat-vente : un cours affiché peut ne pas être exécutable.'],
          ['Se fier à une seule année ou à un seul ratio.', 'Croisez plusieurs ratios sur plusieurs années et intégrez des éléments qualitatifs.'],
          ['Présenter une estimation comme une certitude.', 'Formulez des hypothèses explicites et présentez des scénarios. Toute valorisation est une approximation.'],
        ],
      },
    },
    {
      type: 'retenir',
      titre: 'Les deux conclusions du module',
      contenu: 'Les deux comparaisons se concluent de la même façon : elles décrivent des profils, elles ne désignent pas de gagnant.',
      encadres: [
        { ton: 'cle', titre: 'Banques : ECOC face à SGBC (exercice 2025, cours au 23/11/2026)', texte: [
          `SGBC est plus grande en PNB, en bilan et en capitaux propres ; elle présente un PER plus bas (${mult(G.perAuj)} contre ${mult(E.perAuj)}) et un rendement du dividende plus élevé, et son cours a progressé en 2026 (${sg(G.perf.ytd, 1)}).`,
          `ECOC affiche un ROE plus élevé (${pc(E.roeClot[4])} contre ${pc(G.roeClot[4])}) et une meilleure marge nette ; son résultat recule en 2026 sous l’effet d’un provisionnement prudent, et son cours recule aussi (${sg(E.perf.ytd, 1)}).`,
          'Pour conclure davantage, il faudrait aligner normes comptables, définition du résultat, ROE sur capitaux moyens, indicateur de qualité des crédits, coût du risque, dividende, BPA, date du cours et liquidité.',
        ].join('\n') },
        { ton: 'cle', titre: 'Télécoms : Sonatel face à Orange CI (exercice 2025, cours au 23/11/2026)', texte: [
          `Sonatel est plus grande (${md(N.revenu[4])} milliards de chiffre d’affaires contre ${md(O.revenu[4])}), plus rentable (marge nette consolidée ${pc(N.marge[4])} contre ${pc(O.marge[4])}), moins chère (PER ${mult(N.perAuj)} contre ${mult(O.perAuj)}) et bien plus liquide.`,
          `Orange CI croît plus vite (${sg(rnCroiss9m(O))} de résultat sur neuf mois 2026) et le marché lui accorde un PER plus élevé. Les deux opérateurs investissent environ ${fr((capexPct('SNTS', N) + capexPct('ORAC', O)) / 2, 0)} % de leur chiffre d’affaires dans leurs réseaux.`,
        ].join('\n') },
        { ton: 'alerte', titre: 'À lire avec ces conclusions', texte: 'Ces comparaisons sont informatives et ne constituent pas une recommandation d’achat ou de vente.' },
      ],
    },
    {
      type: 'definition',
      titre: 'Modèle de conclusion pour une fiche',
      contenu: 'Une conclusion honnête nomme les profils, dit ce que les ratios ne disent pas, cite ses sources et sa date. Le modèle ci-dessous se complète entre crochets.',
      encadres: [
        { ton: 'info', titre: 'Modèle à compléter', texte: '« Sur la base des informations disponibles pour l’exercice [année] et des cours de référence du [date], [Société A] et [Société B] présentent des profils différents. [A] affiche [atout principal : taille, rentabilité, rendement], tandis que [B] se distingue par [atout principal]. Les PER ne constituent qu’un élément de comparaison. L’analyse doit être complétée par des données homogènes sur [indicateurs sectoriels pertinents], les fonds propres, le dividende, la liquidité boursière et les perspectives. Les données proviennent de la BRVM et des comptes publiés par les sociétés, recalculées par WESTBOURSE, et de [autres sources], chacune avec sa date. Cette comparaison est informative et ne constitue pas une recommandation d’achat ou de vente. »' },
      ],
    },
    {
      type: 'lexique',
      titre: 'Sources consultées',
      contenu: 'Chaque chiffre de ce module renvoie à l’une de ces sources. Les données de la BRVM et des sociétés font foi ; les autres sont citées avec leur date de consultation.',
      tableau: {
        colonnes: ['Source', 'Type de données', 'Date d’accès'],
        lignes: [
          ['BRVM (brvm.org)', 'Rapports d’activité et états financiers d’ECOC, SGBC, SNTS et ORAC, avis, cours officiels, Bulletin officiel de la cote, calendrier de paiement des dividendes', '23/11/2026'],
          ['WESTBOURSE (westbourse.com)', 'Comptes publiés en base, ratios recalculés (BPA, PER, ROE, marge nette, rendement), clôtures, carnet d’ordres et notes de liquidité', 'Lus le 24/11/2026'],
          ['Sika Finance (sikafinance.com)', 'Comptes intermédiaires de 2026 non encore en base, coût du risque, solvabilité, rendements affichés, actualités', '23/11/2026'],
          ['StockAnalysis / S&P Global Market Intelligence', 'États financiers standardisés, PER sur douze mois glissants, résultat part du groupe, EBITDA, free cash flow, dette nette, capex, bêta', '23/11/2026'],
          ['Sonatel (sonatel.sn)', 'Présentation du groupe, présence dans cinq pays', '23/11/2026'],
          ['BCEAO (bceao.int)', 'Rapports annuels 2022 et 2023 : ratio de solvabilité minimum de l’UMOA', '24/11/2026'],
          ['allAfrica, Daba Finance', 'Résultats trimestriels d’ECOC, contexte sectoriel', '23/11/2026'],
          ['FGI Bourse (fgi-bourse.com)', 'Analyse des états financiers d’ECOC 2025', '23/11/2026'],
          ['APBEF-CI', 'Parts de marché bancaires en Côte d’Ivoire (avril 2026)', 'Via Sika Finance'],
        ],
      },
      encadres: [
        { ton: 'alerte', titre: 'Avertissement', texte: 'Ce module est un support pédagogique destiné aux investisseurs de la BRVM. Il ne constitue pas un conseil personnalisé d’achat ou de vente de titres. Les cours peuvent varier ; les ratios sont indicatifs et reposent sur les données disponibles à la date indiquée. Avant toute décision d’investissement, consultez un conseiller financier agréé et référez-vous aux documents officiels publiés par les sociétés et par la BRVM.' },
      ],
    },
  ],
  quiz: [
    {
      question: 'Les bénéfices d’une société progressent depuis trois ans, mais ses flux de trésorerie d’exploitation baissent. Que vérifier en premier ?',
      options: [
        'Le nombre de ses salariés et de ses implantations',
        'L’évolution de ses créances clients et de ses stocks',
        'Le cours de bourse de ses principaux concurrents cotés',
        'La date de sa prochaine assemblée générale',
      ],
      correct: 1,
      explication: 'Un bénéfice qui ne se transforme pas en trésorerie s’explique souvent par des créances ou des stocks qui gonflent.',
    },
    {
      question: 'Une société verse chaque année un dividende supérieur à son bénéfice. Que faut-il en conclure ?',
      options: [
        'Que la distribution n’est pas soutenable durablement',
        'Que son PER est forcément bas et son action sous-évaluée',
        'Que l’action est garantie',
        'Que son ROE est nul',
      ],
      correct: 0,
      explication: 'Distribuer plus que ce que l’on gagne puise dans les réserves ou la trésorerie : cela ne peut pas durer.',
    },
    {
      question: 'Pourquoi homogénéiser les périodes avant de calculer un PER ?',
      options: [
        'Parce que le PER ne se calcule qu’en décembre',
        'Pour associer un cours et un bénéfice de la même période',
        'Pour éviter de payer des frais de courtage',
        'Parce que la BRVM impose de publier tous les ratios à la même date chaque année',
      ],
      correct: 1,
      explication: 'Un cours d’aujourd’hui rapporté à un bénéfice d’il y a deux ans donne un PER qui ne mesure rien de précis.',
    },
    {
      question: 'Dans un tableau de suivi, que doit indiquer chaque ligne en plus des chiffres ?',
      options: ['Une recommandation', 'Le nom de l’analyste', 'Sa source et sa date', 'Un objectif de cours'],
      correct: 2,
      explication: 'Une source et une date par ligne permettent de vérifier et de mettre à jour le tableau.',
    },
    {
      question: 'Une conclusion d’analyse bien construite…',
      options: [
        'désigne toujours la meilleure action',
        'décrit des profils, écrit ses hypothèses et cite ses sources',
        'ne mentionne jamais de chiffres',
        'reprend la conclusion du dernier article publié sur la société par la presse',
      ],
      correct: 1,
      explication: 'Elle décrit, ne prescrit pas : forces, faiblesses, hypothèses et sources datées.',
    },
  ],
  liens: [
    { label: 'Le screener', href: '/screener' },
    { label: 'Comparer des actions', href: '/actions/compare' },
    { label: 'Les fiches sociétés', href: '/societes' },
  ],
});

// ── Contrôles avant écriture (mêmes règles que niveau2.test.ts / relecture.test.ts) ──
const LECONS = [
  ['l00a-principe-sources.json', l01],
  ['l00b-ratios.json', l02],
  ['l00c-banque.json', l03],
  ['l00d-ecobank-ci.json', l04],
  ['l00e-societe-generale-ci.json', l05],
  ['l00f-comparer-banques.json', l06],
  ['l00g-telecoms.json', l07],
  ['l00h-methode-conclusion.json', l08],
];
let questions = 0;
let plusLongues = 0;
const alertes = [];
for (const [fichier, l] of LECONS) {
  const total = l.sections.reduce((n, s) => n + s.contenu.length, 0);
  if (total < 2500) alertes.push(`${fichier} : ${total} caractères de texte courant (< 2 500)`);
  for (const s of l.sections) {
    for (const p of s.contenu.split(/\n+/)) if (p.length > 650) alertes.push(`${fichier} · ${s.titre} : paragraphe de ${p.length} caractères`);
    if (s.reel && !s.donnees_reelles) alertes.push(`${fichier} · ${s.titre} : section réelle sans donnees_reelles`);
  }
  if (/—\s*$|NaN|undefined|Infinity/.test(JSON.stringify(l))) alertes.push(`${fichier} : valeur non calculée (NaN, undefined, Infinity)`);
  for (const q of l.quiz) {
    questions += 1;
    const autres = q.options.filter((_, i) => i !== q.correct).map((o) => o.length);
    if (q.options[q.correct].length > Math.max(...autres)) plusLongues += 1;
    if (new Set(q.options).size !== q.options.length) alertes.push(`${fichier} : options en double dans « ${q.question.slice(0, 50)} »`);
  }
}
for (const [fichier, l] of LECONS) {
  fs.writeFileSync(path.join(DOSSIER, fichier), `${JSON.stringify(l, null, 2)}\n`, 'utf8');
  console.log(`écrit ${fichier} — ${l.sections.length} sections, ${l.quiz.length} questions, ${l.sections.reduce((n, s) => n + s.contenu.length, 0)} caractères`);
}
console.log(`bonne réponse strictement la plus longue : ${plusLongues}/${questions}`);
if (alertes.length) {
  console.error(alertes.join('\n'));
  process.exitCode = 1;
}
