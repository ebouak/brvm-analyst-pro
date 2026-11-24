#!/usr/bin/env node
// Génère la leçon 2 du niveau 3, recentrée le 2026-11-24 (demande de
// l’exploitant) : figures à trois bougies, lecture des bougies sur les séances
// réelles de la BRVM, et ce que l’historique en dit.
//
//   node scripts/academy-lecon2-bougies.mjs
//
// Tous les chiffres viennent de
// lib/academy/contenus/niveau3/sources/bougies-brvm-2026-11-24.json, produit
// par scripts/academy-lecon2-stats.mjs avec les règles de
// lib/academy/figuresBougies.ts (les mêmes que le simulateur de la leçon).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DOSSIER = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau3');
const FICHIER = path.join(DOSSIER, 'l02-chandeliers.json');
const S = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'sources', 'bougies-brvm-2026-11-24.json'), 'utf8'));
const ancienne = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));

const fr = (n, d = 1) => {
  const [e, dec] = Math.abs(n).toFixed(d).split('.');
  return (n < 0 ? '−' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? `,${dec}` : '');
};
const pc = (n, d = 1) => `${fr(n, d)} %`;
const ent = (n) => fr(n, 0);

const B = S.base;
const M = S.marche;
const fig = (nom) => S.figures.find((f) => f.figure === nom);
const partLisibles = (S.seances_lisibles / S.seances) * 100;
const partOuvVeille = (M.ouverture_egale_cloture_veille / M.seances_avec_ouverture_et_echange) * 100;
const partSansPrix = (M.seances_sans_prix_complets / M.seances) * 100;
const etablies = S.figures.filter((f) => f.ecart_etabli);
const assez = S.figures.filter((f) => f.assez_de_cas);
const AB = fig('avalement_baissier');
const HA = fig('harami');
const SRC = `Sources : séances de la BRVM de 2021 au 23/11/2026, ouverture, plus haut, plus bas et clôture des dix actions les plus échangées (base WESTBOURSE, lue le 24/11/2026) ; figures repérées et calculs WESTBOURSE.`;
const CODES_REELS = ['SNTS', 'SGBC', 'ORAC', 'SIBC', 'BOAC', 'ETIT'];

const verdict = (f) => (!f.assez_de_cas ? `Trop peu de cas (moins de ${S.min_cas})` : f.ecart_etabli ? (f.ecart_sens === 'plus_frequent' ? 'Plus fréquent que pour une séance quelconque' : 'Moins fréquent que pour une séance quelconque') : 'Écart non établi');
const sensLu = (f) => (f.lecture_courante === 'baissiere' ? 'Baisse' : f.lecture_courante === 'haussiere' ? 'Hausse' : 'Aucun (part de hausses)');

const quiz = [
  {
    question: 'De quoi se compose une étoile du matin ?',
    options: [
      'Trois hausses franches de suite, chacune clôturant plus haut que la précédente et ouvrant dans le corps de la veille',
      'Une petite bougie contenue dans le corps d’une grande',
      'Une grande baisse, une séance hésitante, puis une hausse qui reprend plus de la moitié de la baisse',
      'Une seule bougie à longue mèche basse',
    ],
    correct: 2,
    explication: 'Trois bougies : une grande baissière, une petite bougie d’hésitation, puis une haussière qui clôture au-dessus du milieu du corps de la première.',
  },
  {
    question: 'Trois baisses franches de suite, chacune clôturant plus bas que la précédente et ouvrant dans le corps de la veille : quelle figure ?',
    options: ['Trois corbeaux noirs', 'Une étoile du soir', 'Un harami suivi d’un doji', 'Trois soldats blancs'],
    correct: 0,
    explication: 'Trois corbeaux noirs : le miroir des trois soldats blancs. Aucune des deux figures ne dit ce que fera la séance suivante.',
  },
  {
    question: 'Pourquoi les règles de la leçon n’exigent-elles pas d’écart d’ouverture (gap) entre les bougies ?',
    options: [
      'Parce que les écarts d’ouverture sont interdits par le règlement général de la BRVM depuis sa création',
      'Parce qu’un gap rendrait la figure plus fiable',
      'Parce que les bougies de la BRVM n’ont jamais de mèche',
      `Parce qu’à la BRVM l’ouverture égale souvent la clôture de la veille (${pc(partOuvVeille)} des séances)`,
    ],
    correct: 3,
    explication: `Sur ${ent(M.seances_avec_ouverture_et_echange)} séances dont l’ouverture est connue, ${ent(M.ouverture_egale_cloture_veille)} ont ouvert exactement à la clôture de la veille. Exiger un gap, comme la définition classique, éliminerait presque toutes les figures.`,
  },
  {
    question: 'Sur les dix actions les plus échangées, de 2021 à 2026, après un avalement baissier, la clôture était plus basse 5 séances plus tard dans quelle part des cas ?',
    options: [pc(AB.part_pct, 1), pc(AB.part_base_pct + 10, 1), '75,0 %', '90,0 %'],
    correct: 0,
    explication: `${pc(AB.part_pct)} sur ${ent(AB.mesurables)} cas, contre ${pc(AB.part_base_pct)} pour une séance quelconque : la baisse a suivi MOINS souvent que d’habitude, et l’écart n’est pas établi.`,
  },
  {
    question: 'Que conclure de la mesure des figures sur les séances réelles de la BRVM ?',
    options: [
      'Que les figures haussières garantissent une hausse dans les cinq séances qui suivent leur apparition',
      etablies.length === 0 ? 'Qu’aucune figure n’a montré d’avantage établi dans le sens de sa lecture' : 'Que certaines figures ont montré un écart, à vérifier dans le temps',
      'Que les figures baissières annoncent toujours une baisse',
      'Que les bougies ne s’appliquent pas aux actions',
    ],
    correct: 1,
    explication: 'Les parts mesurées après chaque figure restent dans l’intervalle de hasard autour de celle d’une séance quelconque : une figure décrit une séance, elle ne la prolonge pas.',
  },
  {
    question: 'Une séance n’a pas d’ouverture, de plus haut ni de plus bas publiés. Comment la lire ?',
    options: [
      'Comme un doji, puisque les quatre prix sont égaux',
      'Comme un marteau si la clôture monte',
      'Seule la clôture est connue : aucune bougie ne peut être lue',
      'En recopiant la clôture de la veille comme ouverture, et celle du jour comme plus haut',
    ],
    correct: 2,
    explication: 'Sans prix publiés, toute bougie serait inventée. WESTBOURSE affiche alors la clôture seule et ne repère aucune figure.',
  },
  {
    question: 'Comment confirmer une configuration de chandeliers ?',
    options: ['Par la couleur de la dernière bougie du graphique affiché', 'Par la séance suivante et par le volume', 'Par le PER de la société', 'Elle n’a pas besoin de confirmation'],
    correct: 1,
    explication: 'Une figure ne devient intéressante qu’une fois confirmée par les séances suivantes, sur un volume réel.',
  },
];

const lecon = {
  titre: 'Leçon 2 — Les chandeliers japonais : figures à trois bougies et séances réelles',
  module: ancienne.module,
  categorie: 'technical',
  duree_min: 16,
  sous_titre: 'Après les bougies isolées de la leçon 1 : les figures à trois bougies, leur lecture sur les vraies séances de la BRVM, et ce que l’historique en dit.',
  resume: `La leçon 1 a posé l’anatomie d’une bougie et six figures à une ou deux bougies. Celle-ci approfondit : les quatre figures à trois bougies (étoile du matin, étoile du soir, trois soldats blancs, trois corbeaux noirs), les règles exactes que WESTBOURSE applique pour les repérer, leur lecture sur les dernières séances réelles des valeurs les plus échangées, et ce que montrent ${ent(S.seances_lisibles)} bougies réelles de la BRVM depuis 2021.`,
  nouveaute: { type: 'mis_a_jour', depuis: '2026-11-24' },
  sections: [
    {
      type: 'definition',
      titre: 'Ce que la leçon 1 a posé, ce que celle-ci ajoute',
      contenu: [
        'Une bougie résume une séance en quatre prix : ouverture, plus haut, plus bas, clôture. Le corps va de l’ouverture à la clôture ; sur WESTBOURSE, il est clair et vert quand la séance monte, plein et rouge quand elle baisse. Les mèches montrent jusqu’où le cours est allé avant de revenir.',
        'La leçon 1 a présenté six figures à une ou deux bougies : le doji, le marteau, l’étoile filante, les deux avalements et le harami. Cette leçon passe aux figures à trois bougies, puis quitte les exemples pour les vraies séances : comment lire les bougies des valeurs de la BRVM, et ce que leur historique permet, ou ne permet pas, de conclure.',
      ].join('\n'),
      points: [
        { titre: 'Le corps : ouverture et clôture', detail: 'Un grand corps, une séance dominée par un camp ; un petit corps, de l’hésitation.' },
        { titre: 'Les mèches : les extrêmes', detail: 'Une longue mèche montre un prix atteint puis repoussé.' },
        { titre: 'Une figure décrit, elle ne prédit pas', detail: 'Elle raconte une ou plusieurs séances passées.' },
        { titre: 'Le volume d’abord', detail: 'Une bougie sans échange, ou faite de quelques titres, ne contient presque rien.' },
      ],
    },
    {
      type: 'definition',
      titre: 'L’étoile du matin et l’étoile du soir',
      contenu: [
        'Les figures à trois bougies racontent une petite histoire en trois actes. L’étoile du matin commence par une grande séance de baisse ; la deuxième séance hésite, avec un petit corps, dans le bas de la première ; la troisième monte et clôture au-dessus du milieu du corps de la première. Les vendeurs dominaient, ils ont marqué le pas, les acheteurs ont repris plus de la moitié du terrain.',
        'L’étoile du soir est son miroir : une grande hausse, une séance d’hésitation dans le haut de la première, puis une baisse qui efface plus de la moitié de la hausse. Les deux ateliers ci-dessous dessinent ces figures ; modifiez un prix et regardez à quel moment la figure disparaît.',
      ].join('\n'),
      tableau: {
        colonnes: ['Figure', 'Séance 1', 'Séance 2', 'Séance 3', 'Lecture courante'],
        lignes: [
          ['Étoile du matin', 'Grande baissière', 'Petit corps, dans le bas du corps de la séance 1', 'Haussière qui clôture au-dessus du milieu du corps de la séance 1', 'Retournement à la hausse'],
          ['Étoile du soir', 'Grande haussière', 'Petit corps, dans le haut du corps de la séance 1', 'Baissière qui clôture sous le milieu du corps de la séance 1', 'Retournement à la baisse'],
          ['Trois soldats blancs', 'Haussière franche', 'Haussière franche, ouverte dans le corps de la veille', 'Haussière franche, clôture la plus haute', 'Poursuite de la hausse'],
          ['Trois corbeaux noirs', 'Baissière franche', 'Baissière franche, ouverte dans le corps de la veille', 'Baissière franche, clôture la plus basse', 'Poursuite de la baisse'],
        ],
        note: 'La « lecture courante » est celle de la tradition de l’analyse technique. La section « Ce que les bougies de la BRVM nous apprennent » montre ce qu’elle vaut sur nos séances.',
      },
      simulations: [
        { type: 'figure_bougies', consigne: 'L’étoile du matin : baissez la clôture de la troisième séance sous 985 FCFA, la figure disparaît.', bougies: [{ ouverture: 1000, haut: 1002, bas: 968, cloture: 970 }, { ouverture: 970, haut: 974, bas: 962, cloture: 968 }, { ouverture: 968, haut: 992, bas: 966, cloture: 990 }] },
        { type: 'figure_bougies', consigne: 'L’étoile du soir : le miroir de la précédente. Agrandissez le corps de la deuxième séance : ce n’est plus une hésitation.', bougies: [{ ouverture: 1000, haut: 1032, bas: 998, cloture: 1030 }, { ouverture: 1030, haut: 1038, bas: 1026, cloture: 1032 }, { ouverture: 1032, haut: 1034, bas: 1006, cloture: 1008 }] },
      ],
    },
    {
      type: 'definition',
      titre: 'Trois soldats blancs et trois corbeaux noirs',
      contenu: [
        'Les trois soldats blancs sont trois séances de hausse franche à la suite : chaque corps occupe l’essentiel de la séance, chaque clôture dépasse la précédente, chaque ouverture se fait dans le corps de la veille ou à sa clôture. Les trois corbeaux noirs sont la même figure à la baisse.',
        'Ces deux figures décrivent une poursuite plutôt qu’un retournement : un camp a dominé trois séances de suite. Elles demandent des corps nets ; trois petites hausses de quelques francs ne font pas trois soldats. Les ateliers ci-dessous le montrent : réduisez un seul corps et la figure tombe.',
      ].join('\n'),
      simulations: [
        { type: 'figure_bougies', consigne: 'Trois soldats blancs : réduisez le corps de la deuxième séance à quelques francs, la figure disparaît.', bougies: [{ ouverture: 1000, haut: 1011, bas: 999, cloture: 1010 }, { ouverture: 1010, haut: 1021, bas: 1009, cloture: 1020 }, { ouverture: 1020, haut: 1031, bas: 1019, cloture: 1030 }] },
        { type: 'figure_bougies', consigne: 'Trois corbeaux noirs : la même figure, à la baisse.', bougies: [{ ouverture: 1030, haut: 1031, bas: 1019, cloture: 1020 }, { ouverture: 1020, haut: 1021, bas: 1009, cloture: 1010 }, { ouverture: 1010, haut: 1011, bas: 999, cloture: 1000 }] },
      ],
    },
    {
      type: 'importance',
      titre: 'Les règles de repérage, écrites noir sur blanc',
      contenu: [
        'Les noms des figures sont anciens ; leurs définitions varient d’un livre à l’autre. Pour lire de vraies séances, il faut des règles précises, sinon chacun voit la figure qu’il souhaite voir. Voici celles qu’appliquent les ateliers et le simulateur de cette leçon, et la mesure qui suit.',
        `Une différence avec les manuels : aucun écart d’ouverture (gap) n’est exigé entre les bougies. Sur les grands marchés, l’étoile du matin suppose souvent que la deuxième séance ouvre en dessous de la clôture de la première. À la BRVM, l’ouverture est égale à la clôture de la veille dans ${pc(partOuvVeille)} des séances depuis 2021 : la définition classique ne s’y rencontrerait presque jamais.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Notion', 'Règle appliquée'],
        lignes: [
          ['Bougie lisible', 'Ouverture, plus haut, plus bas et clôture publiés et cohérents, et des titres échangés. Sinon, la séance n’est jamais lue comme une figure.'],
          ['Grande bougie', 'Corps d’au moins 1 % du cours d’ouverture et d’au moins la moitié de l’amplitude de la séance.'],
          ['Petite bougie', 'Corps d’au plus 30 % de celui de la grande bougie de référence.'],
          ['Doji, marteau, étoile filante', 'Mêmes seuils que le simulateur de la leçon 1 : corps d’au plus 10 % de l’amplitude ; mèche « longue » d’au moins deux fois le corps.'],
          ['Trois soldats, trois corbeaux', 'Trois corps d’au moins la moitié de l’amplitude et de 0,5 % du cours, clôtures successives plus hautes (ou plus basses).'],
          ['Chevauchement', 'Une même figure ne réutilise jamais une séance déjà comptée : cinq baisses de suite font un « trois corbeaux », pas trois.'],
        ],
      },
      stats: [
        { label: 'Ouvertures égales à la clôture de la veille', valeur: pc(partOuvVeille), detail: `${ent(M.ouverture_egale_cloture_veille)} séances sur ${ent(M.seances_avec_ouverture_et_echange)}, toutes actions, 2021-2026` },
        { label: 'Séances sans prix complets publiés', valeur: pc(partSansPrix), detail: `${ent(M.seances_sans_prix_complets)} sur ${ent(M.seances)} : aucune bougie n’y est lisible` },
      ],
    },
    {
      type: 'cas',
      titre: 'Lire les bougies sur des séances réelles',
      reel: true,
      contenu: [
        'Le simulateur ci-dessous affiche les vraies bougies des dernières séances d’une valeur, telles qu’elles sont publiées, et numérote les figures que les règles repèrent. Lisez-les dans cet ordre, sur chaque valeur.',
        'Une séance sans bougie lisible apparaît en pointillés : prix non publiés ou aucun échange. N’y cherchez rien. Le bloc en direct, en dessous, donne pour les mêmes valeurs le dernier cours, ses moyennes et le RSI : la figure se lit toujours dans ce contexte.',
      ].join('\n'),
      etapes: [
        { titre: 'Vérifier que la bougie est lisible', detail: 'Prix publiés, titres échangés : une séance en pointillés ne contient aucune information.' },
        { titre: 'Situer la tendance des séances précédentes', detail: 'Une étoile du matin n’a de sens qu’après une baisse ; trois soldats, qu’en partant d’un niveau.' },
        { titre: 'Nommer la figure, avec les règles de la leçon', detail: 'Pas d’à-peu-près : si une condition manque, ce n’est pas la figure.', cle: true },
        { titre: 'Regarder le volume', detail: 'Une figure faite de quelques titres ne pèse rien.' },
        { titre: 'Attendre la séance suivante', detail: 'La figure décrit le passé ; la séance suivante dit si le mouvement continue.', cle: true },
      ],
      simulation: { type: 'bougies', consigne: 'Choisissez une valeur et le nombre de séances : les figures repérées sont numérotées au-dessus des bougies et listées en dessous, avec leur date.', codes: CODES_REELS, seances: 30 },
      donnees_reelles: { vue: 'technique', codes: CODES_REELS.slice(0, 4) },
    },
    {
      type: 'importance',
      titre: 'Ce que les bougies de la BRVM nous apprennent',
      contenu: [
        `Nous avons appliqué ces règles aux séances des dix actions les plus échangées, de 2021 au 23 novembre 2026 : ${ent(S.seances)} séances, dont ${ent(S.seances_lisibles)} seulement ont une bougie lisible (${pc(partLisibles)}), faute de prix publiés pour les autres. Pour chaque figure, une question simple : cinq séances plus tard, le cours avait-il bougé dans le sens que lui prête la tradition ?`,
        `Le point de comparaison est une séance quelconque : sur toutes les bougies lisibles, la clôture était plus haute cinq séances plus tard dans ${pc(B.part_hausse_pct)} des cas, plus basse dans ${pc(B.part_baisse_pct)}, inchangée dans ${pc(B.part_inchange_pct)}. Une figure n’apporte quelque chose que si elle fait nettement mieux que ces parts.`,
        `${etablies.length === 0 ? `Aucune n’y parvient : les ${assez.length} figures assez fréquentes pour être mesurées restent toutes dans l’intervalle de hasard.` : `${etablies.length} figure(s) sur ${assez.length} s’en écartent ; les autres restent dans l’intervalle de hasard.`} L’avalement baissier a même été suivi d’une baisse moins souvent qu’une séance quelconque (${pc(AB.part_pct)} contre ${pc(AB.part_base_pct)}, sur ${ent(AB.mesurables)} cas). Le harami, la figure la plus fréquente (${ent(HA.occurrences)} cas), ne se distingue pas non plus.`,
        `Cette mesure a ses limites : ${assez.length} comparaisons au seuil de 95 % laissent environ ${pc((1 - 0.95 ** assez.length) * 100, 0)} de chances qu’un écart apparaisse par pur hasard, les cas proches dans le temps ne sont pas dédoublonnés, et une moyenne recouvre des situations très différentes. Elle suffit pourtant à une conclusion : à la BRVM, une figure de chandeliers ne prédit pas, à elle seule, la suite du cours.`,
      ].join('\n'),
      stats: [
        { label: 'Bougies lisibles', valeur: ent(S.seances_lisibles), detail: `sur ${ent(S.seances)} séances, dix valeurs, 2021-2026` },
        { label: 'Hausse 5 séances après une séance quelconque', valeur: pc(B.part_hausse_pct), detail: `baisse ${pc(B.part_baisse_pct)}, inchangé ${pc(B.part_inchange_pct)}` },
        { label: 'Figures assez fréquentes pour être mesurées', valeur: String(assez.length), detail: `au moins ${S.min_cas} cas suivis de 5 séances` },
        { label: 'Écarts établis dans le sens de la figure', valeur: String(etablies.length), detail: 'intervalle à 95 % hors de la part d’une séance quelconque' },
      ],
      tableau: {
        colonnes: ['Figure', 'Cas mesurés', 'Sens attendu', 'Part, 5 séances après', 'Séance quelconque', 'Intervalle à 95 %', 'Verdict'],
        lignes: S.figures.map((f) => [
          f.libelle,
          ent(f.mesurables),
          sensLu(f),
          f.part_pct == null ? '—' : pc(f.part_pct),
          pc(f.part_base_pct),
          f.ic95_pct ? `${fr(f.ic95_pct[0])} à ${fr(f.ic95_pct[1])} %` : '—',
          verdict(f),
        ]),
        note: `Part des cas où la clôture, 5 séances après la dernière bougie de la figure, était dans le sens attendu (hausse pour les figures haussières et d’indécision, baisse pour les baissières). Intervalle de Wilson à 95 %. ${SRC}`,
      },
      graphiques: [
        {
          type: 'bar',
          titre: 'Après la figure, le mouvement attendu s’est-il produit plus souvent ? (%, figures d’au moins 30 cas)',
          labels: assez.map((f) => f.libelle),
          series: [
            { nom: 'Après la figure', valeurs: assez.map((f) => Number(f.part_pct.toFixed(1))) },
            { nom: 'Séance quelconque', valeurs: assez.map((f) => Number(f.part_base_pct.toFixed(1))) },
          ],
          unite: '%',
          note: `Les barres restent proches : aucune figure ne fait nettement mieux qu’une séance quelconque dans le sens de sa lecture. ${SRC}`,
          reel: true,
        },
      ],
      encadres: [
        { ton: 'cle', titre: 'Ce que cela veut dire pour vous', texte: 'Une figure de chandeliers reste utile pour décrire une séance et repérer un rejet ou une hésitation. Elle ne justifie pas, à elle seule, un achat ou une vente : la grille de décision de la leçon 0 demande toujours le contexte, les niveaux, le volume et un niveau d’invalidation.' },
      ],
    },
    {
      type: 'piege',
      titre: 'Les chandeliers à la BRVM',
      contenu: [
        'Une bougie suppose une séance active, avec de nombreux échanges répartis dans la journée. Sur un grand marché, les mèches reflètent des milliers d’ordres. À la BRVM, une séance peut ne compter que quelques transactions sur une valeur.',
        'Conséquence directe : la forme d’une bougie peut venir d’un seul ordre. Une longue mèche basse, qui ressemblerait à un marteau sur un marché liquide, peut n’être qu’un vendeur pressé qui a accepté un prix bas pour quelques titres. La forme est là ; l’information derrière est très mince.',
        `Les données posent une autre difficulté : depuis 2021, ${pc(partSansPrix)} des séances en base n’ont pas d’ouverture, de plus haut et de plus bas publiés. Plutôt que de dessiner des mèches inventées, WESTBOURSE affiche alors la clôture seule, et le signale. Une bougie sans vraies données derrière elle n’apprend rien et peut tromper.`,
      ].join('\n'),
      points: [
        { titre: 'Une bougie sans échange', detail: 'Sans transaction, la bougie est plate et ne dit rien.', verifier: 'Le volume de la séance.' },
        { titre: 'Peu d’ordres, beaucoup de forme', detail: 'Avec quelques échanges, une longue mèche peut venir d’un seul ordre isolé.', verifier: 'Le nombre de titres échangés.' },
        { titre: 'Des données incomplètes', detail: `${pc(partSansPrix)} des séances depuis 2021 n’ont pas de prix complets : WESTBOURSE n’y dessine aucune bougie.`, verifier: 'La mention de la source sous le graphique.' },
        { titre: 'Des ouvertures sans écart', detail: `L’ouverture égale la clôture de la veille dans ${pc(partOuvVeille)} des séances : les figures qui exigent un gap n’existent presque pas ici.` },
      ],
    },
    {
      type: 'retenir',
      titre: 'L’essentiel',
      contenu: 'Une bougie raconte une séance ; une figure en raconte trois au plus. Ni l’une ni l’autre ne prédit la suivante : sur les séances réelles de la BRVM, aucune figure n’a fait nettement mieux qu’une séance quelconque.',
      points: [
        { titre: 'Quatre figures à trois bougies', detail: 'Étoile du matin, étoile du soir, trois soldats blancs, trois corbeaux noirs.' },
        { titre: 'Des règles écrites', detail: 'Sans règles précises, chacun voit la figure qu’il souhaite voir.' },
        { titre: 'Une bougie lisible d’abord', detail: 'Prix publiés et titres échangés, sinon on ne lit rien.' },
        { titre: 'Mesurer avant de croire', detail: 'Sur la BRVM, aucune figure n’a montré d’avantage établi à cinq séances.' },
      ],
    },
  ],
  quiz,
  qcm: quiz[0],
  liens: ancienne.liens,
  avertissement: 'Ceci n’est pas un conseil en investissement. Un indicateur technique décrit le passé des cours ; il ne prédit pas l’avenir. Les figures de bougies décrivent un comportement de marché, elles ne garantissent aucun mouvement futur. Investir en actions comporte un risque de perte en capital.',
};

const total = lecon.sections.reduce((n, s) => n + s.contenu.length, 0);
const longs = lecon.sections.flatMap((s) => s.contenu.split(/\n+/).filter((p) => p.length > 650).map((p) => `${s.titre} : ${p.length}`));
let plusLongues = 0;
for (const q of quiz) {
  const autres = q.options.filter((_, k) => k !== q.correct).map((o) => o.length);
  if (q.options[q.correct].length > Math.max(...autres)) plusLongues += 1;
}
fs.writeFileSync(FICHIER, `${JSON.stringify(lecon, null, 2)}\n`, 'utf8');
console.log(`écrit l02-chandeliers.json — ${lecon.sections.length} sections, ${quiz.length} questions, ${total} caractères ; bonne réponse la plus longue ${plusLongues}/${quiz.length}`);
if (longs.length) { console.error('paragraphes trop longs :', longs); process.exitCode = 1; }
if (/NaN|undefined|Infinity/.test(JSON.stringify(lecon))) { console.error('valeur non calculée'); process.exitCode = 1; }
