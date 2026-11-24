#!/usr/bin/env node
// Génère la LEÇON 0 du niveau 3 (analyse technique) : « Balayer l’ensemble des
// questions utiles pour décider », à partir du document fourni par
// l’exploitant le 2026-11-24, enrichi de la liquidité réelle de la BRVM.
//
//   node scripts/academy-lecon0-technique.mjs
//
// Les seuls chiffres de la leçon (concentration des échanges) sont recalculés
// ici depuis lib/academy/contenus/niveau3/sources/liquidite-2026-11-23.json
// (base WESTBOURSE). Les blocs en direct et les simulateurs techniques lisent
// les clôtures réelles au chargement : aucun cours n’est figé dans le texte.
// niveaux3-4.test.ts recalcule les mêmes parts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DOSSIER = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau3');
const L = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'sources', 'liquidite-2026-11-23.json'), 'utf8'));

const fr = (n, d = 1) => {
  const [e, dec] = Math.abs(n).toFixed(d).split('.');
  return (n < 0 ? '−' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? `,${dec}` : '');
};
const pc = (n, d = 1) => `${fr(n, d)} %`;

// ── Concentration des échanges ──
const V = [...L.valeurs].sort((a, b) => b.capitaux_md - a.capitaux_md);
const total = V.reduce((t, v) => t + v.capitaux_md, 0);
const part = (n) => (V.slice(0, n).reduce((t, v) => t + v.capitaux_md, 0) / total) * 100;
const NOMS = { SNTS: 'Sonatel', SGBC: 'Société Générale CI', BBGC: 'Bridge Bank Group CI', SIBC: 'SIB Côte d’Ivoire', BOAC: 'BOA Côte d’Ivoire' };
for (const v of V.slice(0, 5)) if (!NOMS[v.code]) throw new Error(`nom court manquant pour ${v.code} : les données ont changé, relire la leçon`);
const maxSans = Math.max(...V.map((v) => v.seances_sans_echange));
const moinsEchangees = V.filter((v) => v.seances_sans_echange === maxSans);
const moinsEchangee = moinsEchangees[0];
const NOMS_RARES = { SICC: 'SICOR Côte d’Ivoire', SEMC: 'Eviosys Packaging Côte d’Ivoire' };
for (const v of moinsEchangees) if (!NOMS_RARES[v.code]) throw new Error(`nom manquant pour ${v.code}`);
const nomsRares = moinsEchangees.map((v) => NOMS_RARES[v.code]);
const nomMoins = nomsRares.length === 1 ? nomsRares[0] : `${nomsRares.slice(0, -1).join(', ')} et ${nomsRares.at(-1)}`;
const verbeMoins = nomsRares.length === 1 ? 'n’a changé de mains' : 'n’ont changé de mains';
const seances = L.periode.seances;
const SRC = `Sources : séances de la BRVM du 24/08/2026 au 23/11/2026, capitaux échangés par valeur (base WESTBOURSE) ; calculs WESTBOURSE.`;

const AVERT = 'Ceci n’est pas un conseil en investissement. L’analyse technique décrit le comportement passé des cours et ne garantit aucune performance future. Investir en actions comporte un risque de perte en capital.';
const CODES = ['SNTS', 'SGBC', 'ORAC', 'ECOC'];

const quiz = [
  {
    question: 'Parmi ces affirmations sur l’analyse technique, laquelle est correcte ?',
    options: [
      'Elle permet de prédire les cours de bourse avec certitude',
      'C’est une méthode de lecture du comportement du marché',
      'Elle remplace l’analyse fondamentale des comptes',
      'Elle ne s’applique pas aux actions de la BRVM',
    ],
    correct: 1,
    explication: 'Elle lit les prix et les volumes pour comprendre l’offre et la demande. Elle ne prédit rien avec certitude et complète l’analyse fondamentale sans la remplacer.',
  },
  {
    question: `Du 24 août au 23 novembre 2026, quelle part des capitaux échangés sur les actions de la BRVM revient aux cinq valeurs les plus échangées ?`,
    options: ['18 %', '35 %', pc(part(5), 0), '90 %'],
    correct: 2,
    explication: `${pc(part(5))} des ${fr(total, 1)} milliards de FCFA échangés en ${seances} séances. Sur ces valeurs, un signal technique repose sur de nombreux ordres ; sur une valeur peu échangée, un seul ordre peut le fabriquer.`,
  },
  {
    question: 'Quelle famille de questions couvre le niveau d’invalidation, l’objectif, la taille de position et le rapport gain sur risque ?',
    options: ['Famille A — Le contexte', 'Famille B — La tendance', 'Famille E — Le risque', 'Famille F — La discipline et la psychologie'],
    correct: 2,
    explication: 'La famille E, la gestion du risque : elle se règle avant l’entrée, jamais après.',
  },
  {
    question: 'Pourquoi cherche-t-on une convergence de plusieurs signaux techniques ?',
    options: [
      'Parce qu’un seul indicateur se trompe toujours, quelle que soit la valeur',
      'Pour ne pas agir sur un signal isolé, souvent du bruit',
      'Parce que le règlement de la BRVM l’exige',
      'Parce que cela permet d’acheter plus vite que les autres investisseurs',
    ],
    correct: 1,
    explication: 'Un signal isolé peut naître d’un seul ordre ou d’un hasard de séance. La convergence de signaux indépendants réduit ce risque ; elle ne garantit pas le résultat.',
  },
  {
    question: 'Une des six cases de la grille de décision reste vide ou hésitante. Que faire ?',
    options: [
      'Acheter quand même, mais avec une taille de position réduite de moitié',
      'Vendre immédiatement toutes ses positions en portefeuille',
      'Attendre : l’absence de signal clair est une information',
      'Suivre l’avis d’un tiers sans refaire l’analyse',
    ],
    correct: 2,
    explication: 'Une case vide signale une décision prise sans toutes ses raisons. En analyse technique, savoir ne rien faire est une compétence.',
  },
];

const lecon = {
  titre: 'Leçon 0 — Balayer l’ensemble des questions utiles pour décider',
  module: 'Module 0 — Avant les graphiques : la grille de décision',
  categorie: 'technical',
  duree_min: 16,
  sous_titre: 'Avant de lire un graphique, savoir pourquoi et quand s’en servir : six familles de questions, une grille en une page, et la liquidité réelle de la BRVM.',
  resume: 'Avant d’apprendre à lire un graphique, à tracer une moyenne mobile ou à fixer un niveau d’invalidation, il faut savoir pourquoi et quand on utilise l’analyse technique, et surtout quelles questions se poser avant d’acheter ou de vendre une action cotée à la BRVM. Cette leçon zéro les passe en revue, famille par famille, et sert de boussole à tout le niveau : chaque leçon qui suit apporte les outils pour répondre à l’une d’elles.',
  nouveaute: { type: 'nouveau', depuis: '2026-11-24' },
  sections: [
    {
      type: 'definition',
      titre: 'Pourquoi analyser techniquement une action de la BRVM ?',
      contenu: [
        'L’analyse technique n’est pas une boule de cristal. C’est une méthode structurée de lecture du comportement du marché à partir des prix et des volumes : elle cherche où se situent l’offre et la demande, et comment elles évoluent d’une séance à l’autre.',
        'Elle complète l’analyse fondamentale sans la remplacer. Les comptes disent ce que vaut une entreprise ; le graphique dit à quel prix, et avec quelle insistance, les investisseurs l’échangent. Sur un marché où la liquidité est limitée, l’écart entre les deux peut durer : c’est là que la lecture des cours et des volumes devient utile.',
        'Avant tout, une question fondatrice : quel est votre objectif ? Un horizon de quelques jours, de quelques semaines ou de plusieurs mois ne se lit pas avec les mêmes outils, ni avec la même patience. Le tableau reprend les trois questions qui précèdent toutes les autres.',
      ].join('\n'),
      tableau: {
        colonnes: ['Question', 'Sous-question', 'Réponse attendue'],
        lignes: [
          ['Quel est mon objectif ?', 'Spéculation de court terme, swing trading ou investissement de moyen terme ?', 'Un horizon clair : jours, semaines ou mois.'],
          ['Pourquoi l’analyse technique, et pas seulement l’analyse fondamentale ?', 'Les bénéfices et les dividendes expliquent-ils seuls les mouvements de court terme à la BRVM ?', 'Non : la liquidité limitée amplifie souvent les effets de l’offre et de la demande.'],
          ['L’analyse technique remplace-t-elle le jugement ?', 'Peut-on acheter uniquement parce qu’un signal apparaît ?', 'Non : c’est une aide à la décision, pas une recette automatique.'],
        ],
      },
      encadres: [
        { ton: 'cle', titre: 'Une aide à la décision, pas une prévision', texte: 'Aucun indicateur ne prédit le cours de demain. L’analyse technique organise l’observation, signale les excès et aide à définir un risque avant d’agir. La décision, et sa responsabilité, restent à l’investisseur.' },
      ],
    },
    {
      type: 'importance',
      titre: 'Le contexte propre à la BRVM',
      reel: true,
      contenu: [
        'La BRVM sert huit pays de l’UEMOA : Côte d’Ivoire, Sénégal, Burkina Faso, Mali, Bénin, Togo, Niger et Guinée-Bissau. Avant d’analyser un graphique, quatre particularités sont à garder en tête, car elles conditionnent la fiabilité de tout signal.',
        `La première est la concentration des échanges. Du 24 août au 23 novembre 2026, soit ${seances} séances, ${fr(total, 1)} milliards de FCFA ont été échangés sur les ${V.length} actions cotées. Sonatel en représente à elle seule ${pc(part(1))}, les cinq valeurs les plus échangées ${pc(part(5))}, les dix premières ${pc(part(10))}. À l’autre bout, ${nomMoins} ${verbeMoins} que lors de ${seances - moinsEchangee.seances_sans_echange} séances sur ${seances}.`,
        'Sur une valeur très échangée, une figure ou une cassure résulte de nombreux ordres ; sur une valeur peu échangée, un seul ordre peut dessiner une « cassure » qui n’en est pas une. Le bloc en direct, sous les graphiques, donne les dernières clôtures des cinq valeurs les plus échangées.',
      ].join('\n'),
      stats: [
        { label: `Capitaux échangés en ${seances} séances`, valeur: `${fr(total, 1)} Md FCFA`, detail: 'du 24/08 au 23/11/2026, toutes actions' },
        { label: 'Part de Sonatel', valeur: pc(part(1)), detail: 'première valeur échangée' },
        { label: 'Part des 5 premières valeurs', valeur: pc(part(5)), detail: `sur ${V.length} actions cotées` },
        { label: 'Part des 10 premières', valeur: pc(part(10)), detail: `les ${V.length - 10} autres se partagent le reste` },
      ],
      points: [
        { titre: 'Une liquidité concentrée', detail: 'Quelques valeurs concentrent l’essentiel des échanges : les signaux y reposent sur davantage d’ordres. La page Liquidité de WESTBOURSE classe chaque valeur selon sa présence, ses volumes et sa fourchette.', verifier: 'Le volume moyen et le nombre de séances avec échange.' },
        { titre: 'Une séance de quelques heures', detail: 'La cotation se déroule sur une plage horaire réduite : des écarts d’ouverture (gaps) et des figures incomplètes sont fréquents d’une séance à l’autre.' },
        { titre: 'La faible profondeur des titres peu échangés', detail: 'Un mouvement de prix sur un faible volume n’a pas la portée d’un mouvement confirmé par des volumes élevés. Le carnet d’ordres, affiché sur chaque fiche société, montre ce qui attend de chaque côté.' },
        { titre: 'La sensibilité aux annonces', detail: 'Résultats semestriels, dividendes, décisions de la BCEAO, opérations sur le capital : la lecture technique se croise avec le calendrier des annonces.', verifier: 'Le calendrier WESTBOURSE des dividendes et des assemblées générales.' },
      ],
      graphiques: [
        {
          type: 'pie',
          titre: 'Répartition des capitaux échangés sur les actions de la BRVM, du 24/08 au 23/11/2026 (%)',
          labels: [...V.slice(0, 5).map((v) => NOMS[v.code]), `Les ${V.length - 5} autres valeurs`],
          valeurs: [...V.slice(0, 5).map((v) => Number(((v.capitaux_md / total) * 100).toFixed(2))), Number((100 - part(5)).toFixed(2))],
          unite: '%',
          note: `Les cinq valeurs les plus échangées concentrent ${pc(part(5))} des capitaux, Sonatel ${pc(part(1))} à elle seule. ${SRC}`,
          reel: true,
        },
        {
          type: 'bar',
          titre: 'Part cumulée des capitaux échangés, par rang de valeur (%)',
          labels: ['1re valeur', '5 premières', '10 premières', '20 premières', `${V.length} valeurs`],
          valeurs: [1, 5, 10, 20, V.length].map((n) => Number(part(n).toFixed(1))),
          unite: '%',
          note: `Les vingt premières valeurs font ${pc(part(20))} des échanges ; les ${V.length - 20} suivantes, ${pc(100 - part(20))}. ${SRC}`,
          reel: true,
        },
      ],
      donnees_reelles: { vue: 'cours', codes: V.slice(0, 5).map((v) => v.code), actions: 10 },
    },
    {
      type: 'definition',
      titre: 'Les six familles de questions à se poser avant de décider',
      contenu: [
        'Voici le balayage complet. Chaque famille regroupe des questions précises ; à mesure que vous avancerez dans le niveau, vous saurez quel outil technique répond à chacune.',
        'Quatre familles relèvent directement des graphiques et des indicateurs : la tendance, les niveaux clés, les signaux d’entrée et la gestion du risque. Deux autres, le contexte et la discipline, ne relèvent d’aucun indicateur : elles accompagnent toutes les leçons, car aucune technique ne remplace un bon cadre de décision.',
      ].join('\n'),
      etapes: [
        { titre: 'A — Le contexte de marché', detail: 'Le marché, le secteur, l’actualité de la valeur.' },
        { titre: 'B — La tendance de la valeur', detail: 'Sa direction, sa durée, sa dynamique.' },
        { titre: 'C — Les niveaux clés', detail: 'Supports, résistances, cassures et volumes.' },
        { titre: 'D — Les signaux d’entrée', detail: 'Moyennes mobiles, RSI, MACD, figures : et leur convergence.', cle: true },
        { titre: 'E — La gestion du risque', detail: 'Niveau d’invalidation, objectif, taille de position.', cle: true },
        { titre: 'F — La discipline et la psychologie', detail: 'Émotions, journal, respect du plan, liquidité réelle.' },
      ],
    },
    {
      type: 'importance',
      titre: 'Famille A — Le contexte de marché',
      reel: true,
      contenu: [
        'On commence par ce qui entoure la valeur. Le marché dans son ensemble monte-t-il ou baisse-t-il ? Le secteur de la société est-il porté ou délaissé ? Une annonce importante est-elle imminente ? Une décision de la BCEAO ou d’un régulateur a-t-elle modifié les conditions de marché ?',
        'Le bloc en direct, sous le tableau, donne le dernier niveau du BRVM Composite et du BRVM 30 et leur variation : c’est la première case de la grille. Le Composite suit l’ensemble des actions cotées ; le BRVM 30 suit les trente valeurs les plus échangées.',
      ].join('\n'),
      tableau: {
        colonnes: ['#', 'Question', 'Ce qui y répond'],
        lignes: [
          ['A1', 'Le marché global (BRVM Composite, BRVM 30) est-il en tendance haussière ou baissière ?', 'Graphiques et tendances (module 1), appliqués aux indices'],
          ['A2', 'Le secteur de la valeur (banque, télécoms, agro-industrie, distribution) est-il porteur ?', 'La page Secteurs de WESTBOURSE et l’indice BRVM 30'],
          ['A3', 'Une actualité majeure est-elle imminente (résultats, dividende, opération sur le capital) ?', 'Le calendrier WESTBOURSE des dividendes et des assemblées'],
          ['A4', 'La BCEAO ou un régulateur a-t-il récemment modifié les conditions de marché ?', 'Veille des décisions de la BCEAO et de l’AMF-UMOA'],
        ],
      },
      encadres: [
        { ton: 'cle', titre: 'Principe clé', texte: 'On n’achète pas une valeur isolément, on l’achète dans un contexte. Une action dont le graphique est flatteur, dans un marché qui baisse, reste un pari risqué.' },
      ],
      donnees_reelles: { vue: 'indices', codes: ['BRVMC', 'BRVM30'] },
    },
    {
      type: 'importance',
      titre: 'Famille B — La tendance de la valeur',
      contenu: [
        'La tendance est la question centrale de l’analyse technique. Une tendance a une direction (hausse, baisse ou range), une durée et une dynamique : elle peut accélérer, ralentir ou s’essouffler. Les chandeliers de chaque séance disent si elle se poursuit ou si un retournement s’annonce.',
        'Le simulateur ci-dessous trace les clôtures réelles de quatre grandes valeurs avec leurs moyennes de 20 et 50 séances. Ce n’est qu’un premier regard : les leçons 1, 2, 3 et 5 apprennent à lire chacun de ces éléments.',
      ].join('\n'),
      tableau: {
        colonnes: ['#', 'Question', 'Ce qui y répond'],
        lignes: [
          ['B1', 'Quelle est la tendance de fond : hausse, baisse ou range ?', 'Leçon 1 — Lire un graphique de cours'],
          ['B2', 'Depuis combien de temps cette tendance dure-t-elle ?', 'Leçon 1'],
          ['B3', 'La tendance accélère-t-elle ou ralentit-elle ?', 'Leçon 5 — Le MACD'],
          ['B4', 'Les chandeliers confirment-ils la continuation, ou annoncent-ils un retournement ?', 'Leçon 2 — Les chandeliers japonais'],
        ],
      },
      simulation: {
        type: 'technique',
        consigne: 'Choisissez une valeur : sa tendance se lit sur ses clôtures réelles, avec les moyennes de 20 et 50 séances. La leçon 3 détaille la méthode.',
        indicateur: 'moyennes',
        codes: CODES,
        courte: 20,
        longue: 50,
      },
    },
    {
      type: 'importance',
      titre: 'Famille C — Les niveaux clés',
      reel: true,
      contenu: [
        'Un support est une zone où le prix a plusieurs fois cessé de baisser ; une résistance, une zone où il a plusieurs fois cessé de monter. Ces niveaux comptent parce que beaucoup d’investisseurs les regardent : ils concentrent les ordres.',
        'La question décisive est celle de la cassure : un niveau franchi de façon convaincante change la lecture, un niveau à peine dépassé sur un faible volume ne la change pas. Sur la BRVM, cette vérification du volume est d’autant plus importante que la liquidité est inégale. Le bloc en direct donne, pour quatre valeurs, le dernier cours et ses moyennes, à comparer aux niveaux que vous repérez.',
      ].join('\n'),
      tableau: {
        colonnes: ['#', 'Question', 'Ce qui y répond'],
        lignes: [
          ['C1', 'Où se situent les supports, les zones où le prix rebondit ?', 'Leçon 1 et leçon 6'],
          ['C2', 'Où se situent les résistances, les zones où le prix bute ?', 'Leçon 1 et leçon 6'],
          ['C3', 'Un support ou une résistance vient-il d’être cassé de façon convaincante ?', 'Leçon 6 — Les figures chartistes'],
          ['C4', 'Le volume confirme-t-il la cassure ?', 'Leçon 1 et leçon 6'],
        ],
      },
      donnees_reelles: { vue: 'technique', codes: CODES },
    },
    {
      type: 'importance',
      titre: 'Famille D — Les signaux d’entrée',
      contenu: [
        'Les signaux d’entrée viennent des indicateurs et des figures : des moyennes mobiles alignées dans le sens de la tendance, un RSI qui signale un excès, un croisement du MACD, une figure chartiste en cours de validation. Chacun répond à une question différente ; aucun ne suffit seul.',
        'Le simulateur ci-dessous calcule le RSI sur 14 séances à partir des clôtures réelles. Observez combien de fois il franchit ses seuils sans que le cours se retourne : c’est la meilleure démonstration qu’un signal isolé ne décide de rien.',
      ].join('\n'),
      tableau: {
        colonnes: ['#', 'Question', 'Ce qui y répond'],
        lignes: [
          ['D1', 'Les moyennes mobiles sont-elles alignées dans le sens de la tendance ?', 'Leçon 3 — Les moyennes mobiles'],
          ['D2', 'Le RSI indique-t-il un excès, à la hausse ou à la baisse ?', 'Leçon 4 — Le RSI'],
          ['D3', 'Le MACD donne-t-il un croisement exploitable ?', 'Leçon 5 — Le MACD'],
          ['D4', 'Une figure chartiste est-elle en cours de validation (triangle, double creux, tête-épaules) ?', 'Leçon 6 — Les figures chartistes'],
          ['D5', 'Plusieurs signaux indépendants convergent-ils ?', 'Le croisement de toutes les leçons'],
        ],
      },
      encadres: [
        { ton: 'cle', titre: 'Règle d’or : la convergence', texte: 'Un signal isolé est souvent du bruit : sur une valeur peu échangée, un seul ordre suffit à le fabriquer. La convergence de signaux indépendants (tendance, niveau, indicateur, figure) réduit le risque d’agir sur un faux signal. Elle ne garantit aucun résultat : la leçon 1 présente ce que nous avons mesuré sur la BRVM, avec ses limites.' },
      ],
      simulation: {
        type: 'technique',
        consigne: 'Le RSI sur 14 séances, calculé sur les clôtures réelles. Comptez les franchissements de seuil qui n’ont été suivis d’aucun retournement.',
        indicateur: 'rsi',
        codes: CODES,
        periode: 14,
        seuil_haut: 70,
        seuil_bas: 30,
      },
    },
    {
      type: 'importance',
      titre: 'Famille E — La gestion du risque',
      contenu: [
        'C’est souvent la famille la plus négligée, et pourtant la plus déterminante pour préserver son capital. Elle tient en cinq questions, toutes réglées avant l’entrée : à quel prix le raisonnement devient faux, quel objectif est réaliste, quel rapport entre gain espéré et perte acceptée, quelle somme engager, et que devient le plan si la position est perdue.',
        'Le niveau d’invalidation, souvent appelé stop, se place à un niveau qui a un sens sur le graphique : sous un support, sous une ligne de cou. La taille de la position en découle, et non l’inverse. L’exemple ci-dessous est fictif ; la leçon 7 détaille la méthode.',
      ].join('\n'),
      tableau: {
        colonnes: ['#', 'Question', 'Ce qui y répond'],
        lignes: [
          ['E1', 'À quel niveau placer le niveau d’invalidation, le prix auquel le raisonnement est faux ?', 'Leçon 7 — Stop-loss, objectif et taille de position'],
          ['E2', 'Quel est l’objectif de cours, réaliste au regard du graphique ?', 'Leçon 7'],
          ['E3', 'Quel rapport entre gain espéré et perte acceptée ? Un repère courant : au moins 2 pour 1.', 'Leçon 7'],
          ['E4', 'Quelle taille de position, au regard du niveau d’invalidation et du capital total ?', 'Leçon 7'],
          ['E5', 'Si cette position est perdue, le plan d’ensemble tient-il ?', 'Leçon 7'],
        ],
      },
      formules: [
        { nom: 'Rapport gain sur risque', expression: 'Rapport = (objectif − prix d’achat) ÷ (prix d’achat − niveau d’invalidation)', exemple: '(4 400 − 4 000) ÷ (4 000 − 3 800) = 400 ÷ 200 = 2 (exemple fictif)' },
        { nom: 'Taille de position', expression: 'Nombre d’actions = perte acceptée ÷ (prix d’achat − niveau d’invalidation)', exemple: '1 % de 1 000 000 FCFA = 10 000 FCFA ; 10 000 ÷ 200 = 50 actions (exemple fictif)' },
      ],
      simulation: {
        type: 'position',
        consigne: 'Exemple fictif : déplacez le niveau d’invalidation ou le risque accepté, la taille de la position en découle, et l’objectif donne le rapport gain sur risque.',
        portefeuille: 1000000,
        risque_pct: 1,
        prix_achat: 4000,
        stop: 3800,
        objectif: 4400,
      },
    },
    {
      type: 'piege',
      titre: 'Famille F — La discipline et la psychologie',
      contenu: [
        'Les pertes les plus coûteuses viennent rarement d’un indicateur mal lu ; elles viennent d’une décision prise sous le coup d’une émotion. La peur de rater une hausse, la panique dans une baisse, l’envie de « se refaire » après une perte : chacune pousse à agir hors du plan.',
        'Deux habitudes protègent. Tenir un journal : pour chaque décision, la date, le motif, le niveau d’invalidation et l’objectif, puis le résultat. Et vérifier la liquidité réelle de la valeur avant d’envisager une sortie rapide : sur la BRVM, vendre vite n’est pas toujours possible au prix affiché.',
      ].join('\n'),
      tableau: {
        colonnes: ['#', 'Question', 'Ce qui y répond'],
        lignes: [
          ['F1', 'Suis-je en train de réagir à une émotion (peur de rater, panique, revanche après une perte) ?', 'Réflexion personnelle, avant chaque ordre'],
          ['F2', 'Ai-je un journal où je note chaque décision et son motif ?', 'Bonne pratique transversale'],
          ['F3', 'Est-ce que je respecte mon plan, ou est-ce que je dérive en cours de position ?', 'Bonne pratique transversale'],
          ['F4', 'Ai-je vérifié la liquidité réelle de la valeur avant de prévoir une sortie rapide ?', 'La page Liquidité et le carnet d’ordres de la fiche société'],
        ],
      },
      encadres: [
        { ton: 'attention', titre: 'Le piège le plus fréquent', texte: 'Déplacer son niveau d’invalidation plus bas parce que le cours s’en approche. Le raisonnement était faux à ce prix-là : le déplacer, c’est remplacer un plan par un espoir.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'La grille de décision en une page',
      contenu: [
        'Avant chaque opération, passez mentalement cette grille, case par case. Chaque leçon du niveau vous donnera les outils pour remplir concrètement une ou plusieurs cases.',
        'Si une seule des six cases reste vide ou hésitante, c’est un signal pour attendre plutôt que pour agir. En analyse technique, l’absence de position est une position, et savoir ne rien faire est une compétence.',
      ].join('\n'),
      etapes: [
        { titre: '1. Contexte', detail: 'Marché, secteur, actualité : favorables ? (famille A)' },
        { titre: '2. Tendance', detail: 'Direction, durée, dynamique : claires ? (famille B)' },
        { titre: '3. Niveaux', detail: 'Supports et résistances : cassés ou testés, avec quel volume ? (famille C)' },
        { titre: '4. Signaux', detail: 'Moyennes, RSI, MACD, figures : convergent-ils ? (famille D)', cle: true },
        { titre: '5. Risque', detail: 'Niveau d’invalidation, objectif, taille, rapport : définis ? (famille E)', cle: true },
        { titre: '6. Discipline', detail: 'Émotion maîtrisée, journal tenu ? (famille F)' },
      ],
      etapes_style: 'frise',
      tableau: {
        colonnes: ['Module', 'Leçons', 'Cases de la grille alimentées'],
        lignes: [
          ['Module 1 — Graphiques et tendances', 'Leçon 1, leçon 2', 'B, C'],
          ['Module 2 — Indicateurs', 'Leçon 3, leçon 4, leçon 5', 'B, D'],
          ['Module 3 — Figures et gestion du risque', 'Leçon 6, leçon 7', 'C, D, E'],
        ],
        note: 'Les familles A (contexte) et F (discipline) sont transversales : elles accompagnent chaque leçon.',
      },
      encadres: [
        { ton: 'attention', titre: 'Une case vide', texte: 'Si une case reste vide ou hésitante : attendre. Une décision prise sans toutes ses raisons n’est pas une décision, c’est un pari.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'À retenir',
      contenu: 'L’analyse technique aide à décider ; elle ne décide pas à votre place. Sur la BRVM, la liquidité et le contexte régional conditionnent la fiabilité de chaque signal.',
      points: [
        { titre: 'Une aide à la décision', detail: 'Pas une prévision certaine.' },
        { titre: 'La liquidité d’abord', detail: `Les cinq valeurs les plus échangées font ${pc(part(5))} des échanges : un signal ne vaut que par les ordres qui le portent.` },
        { titre: 'Six familles de questions', detail: 'Contexte, tendance, niveaux, signaux, risque, discipline.' },
        { titre: 'La convergence', detail: 'Plusieurs signaux indépendants valent mieux qu’un indicateur isolé, sans rien garantir.' },
        { titre: 'Le risque avant l’entrée', detail: 'Niveau d’invalidation, objectif et taille se décident avant d’acheter, jamais après.' },
        { titre: 'Savoir attendre', detail: 'L’absence de signal clair est, en soi, une information.' },
      ],
    },
  ],
  quiz,
  qcm: quiz[0],
  liens: [
    { label: 'La liquidité de chaque valeur', href: '/liquidite' },
    { label: 'Le screener', href: '/screener' },
    { label: 'Le calendrier des annonces', href: '/calendrier' },
  ],
  avertissement: AVERT,
};

// ── Contrôles ──
const alertes = [];
const totalTexte = lecon.sections.reduce((n, s) => n + s.contenu.length, 0);
if (totalTexte < 2500) alertes.push(`${totalTexte} caractères de texte courant (< 2 500)`);
for (const s of lecon.sections) for (const p of s.contenu.split(/\n+/)) if (p.length > 650) alertes.push(`${s.titre} : paragraphe de ${p.length} caractères`);
for (const s of lecon.sections) if (s.reel && !s.donnees_reelles) alertes.push(`${s.titre} : section réelle sans donnees_reelles`);
const brut = JSON.stringify(lecon);
if (/NaN|undefined|Infinity/.test(brut)) alertes.push('valeur non calculée');
if (/sika|rich ?bourse|stockanalysis|S&P|MTN/i.test(brut)) alertes.push('source tiers ou valeur non cotée citée');
let plusLongues = 0;
for (const q of quiz) {
  const autres = q.options.filter((_, i) => i !== q.correct).map((o) => o.length);
  if (q.options[q.correct].length > Math.max(...autres)) plusLongues += 1;
}
fs.writeFileSync(path.join(DOSSIER, 'l00-grille-decision.json'), `${JSON.stringify(lecon, null, 2)}\n`, 'utf8');
console.log(`écrit l00-grille-decision.json — ${lecon.sections.length} sections, ${totalTexte} caractères ; bonne réponse la plus longue ${plusLongues}/5`);
console.log(`concentration : 1re ${pc(part(1))}, 5 premières ${pc(part(5))}, 10 premières ${pc(part(10))}, 20 premières ${pc(part(20))} ; total ${fr(total, 1)} Md`);
if (alertes.length) { console.error(alertes.join('\n')); process.exitCode = 1; }
