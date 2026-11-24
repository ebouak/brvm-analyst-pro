#!/usr/bin/env node
// Génère la leçon 4 du niveau 3 (le RSI), enrichie le 2026-11-24 à partir de la
// relecture critique fournie par l'exploitant : calcul pas à pas, lissage de
// Wilder, zones et durées, divergences, lecture avec la tendance, et un
// « Focus BRVM : rendre le RSI intelligent pour les acteurs régionaux » tiré de
// mesures faites sur la base, pas de seuils proposés sans mesure.
//
//   node --no-warnings scripts/academy-lecon4-rsi.mjs
//
// Chiffres de marché : lib/academy/contenus/niveau3/sources/rsi-brvm-2026-11-24.json
// (scripts/academy-lecon4-stats.mjs). Exemples fictifs calculés ici avec
// rsiSeries (lib/indicators.ts) : le RSI de la leçon est celui du site.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const { rsiSeries } = await import(pathToFileURL(path.join(ICI, '..', 'lib', 'indicators.ts')).href);
const DOSSIER = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau3');
const FICHIER = path.join(DOSSIER, 'l04-rsi.json');
const S = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'sources', 'rsi-brvm-2026-11-24.json'), 'utf8'));
// Rien n'est repris du fichier existant : le générateur donne le même fichier à
// chaque exécution (la reprise par position cassait la leçon au deuxième passage).
const MODULE = 'Module 2 — Indicateurs';
const CODES_DIRECT = ['SNTS', 'BOAC', 'NTLC', 'SDCC', 'TTLC'];

const fr = (n, d = 1) => {
  const [e, dec] = Math.abs(n).toFixed(d).split('.');
  return (n < 0 ? '−' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? `,${dec}` : '');
};
const pc = (n, d = 1) => `${fr(n, d)} %`;
const ent = (n) => fr(n, 0);
const sg = (n) => `${n > 0 ? '+' : ''}${fr(n, 0)}`;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateFr = (iso) => `${Number(iso.slice(8, 10))}${iso.slice(8, 10) === '01' ? 'er' : ''} ${MOIS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const jjmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// ── Exemples FICTIFS, calculés avec le RSI du site ─────────────────────────
const PAS = [1000, 1020, 1015, 1030, 1025, 1040, 1050, 1045, 1060, 1070, 1065, 1080, 1075, 1090, 1100];
const SUITE = [1085, 1095];
const ATELIER = [...PAS, ...SUITE];
const variations = PAS.slice(1).map((c, i) => c - PAS[i]);
const sommeH = variations.filter((v) => v > 0).reduce((t, v) => t + v, 0);
const sommeB = -variations.filter((v) => v < 0).reduce((t, v) => t + v, 0);
const N = 14;
const rsiAtelier = rsiSeries(ATELIER, N);
const rsi15 = rsiAtelier[14];
if (Math.abs(rsi15 - (100 - 100 / (1 + sommeH / sommeB))) > 1e-9) throw new Error('le pas à pas ne correspond pas à rsiSeries');
// Séance 16 : lissage de Wilder, et ce que donnerait une simple fenêtre de 14 variations.
const mh16 = ((sommeH / N) * (N - 1) + 0) / N;
const mb16 = ((sommeB / N) * (N - 1) + (PAS[14] - SUITE[0])) / N;
const rsi16 = rsiAtelier[15];
if (Math.abs(rsi16 - (100 - 100 / (1 + mh16 / mb16))) > 1e-9) throw new Error('le lissage ne correspond pas à rsiSeries');
const fen16 = [...PAS, SUITE[0]].slice(-15);
const v16 = fen16.slice(1).map((c, i) => c - fen16[i]);
const h16 = v16.filter((v) => v > 0).reduce((t, v) => t + v, 0);
const b16 = -v16.filter((v) => v < 0).reduce((t, v) => t + v, 0);
const rsi16Simple = 100 - 100 / (1 + h16 / b16);

// Divergence baissière fictive : le cours fait un plus-haut plus haut, le RSI un plus-haut plus bas.
const DIV = [100, 101, 100, 102, 101, 100, 101, 102, 101, 100, 101, 102, 101, 102, 101, 104, 108, 112, 116, 120, 124, 128, 125, 121, 118, 119, 117, 120, 122, 124, 126, 127, 129, 130];
const rsiDiv = rsiSeries(DIV, N);
const pic = (a, b) => { let k = a; for (let i = a; i <= b; i++) if (DIV[i] > DIV[k]) k = i; return k; };
const P1 = pic(15, 22);
const P2 = pic(27, DIV.length - 1);
if (!(DIV[P2] > DIV[P1] && rsiDiv[P2] < rsiDiv[P1])) throw new Error('l’exemple ne montre plus de divergence');

// ── Faits de marché (source) ─────────────────────────────────────────────────
const Z = S.zones;
const EQ = S.seuils_equivalents;
const POS = S.seances_en_zone_selon_moyenne_50;
const B = S.base_20.tout;
const AP = S.apres_20;
const SV = AP.survente.tout;
const SA = AP.surachat.tout;
const nbClasse = Object.fromEntries(Object.entries(S.valeurs_par_classe).map(([k, v]) => [k, v.length]));
const FG = S.figes;
const D = S.detachements;
const top = D.plus_fortes[0];
const CAL = S.calendrier_2023_2025;
const calMin = CAL.reduce((m, x) => (x.indice_mediane < m.indice_mediane ? x : m), CAL[0]);
const calMax = CAL.reduce((m, x) => (x.indice_mediane > m.indice_mediane ? x : m), CAL[0]);
const ete = CAL.filter((x) => x.mois === 'juillet' || x.mois === 'août');
const C20 = S.cas_20_novembre;
const PA = S.performance_depuis_2021;
const etablis = Object.entries(AP).flatMap(([z, g]) => Object.entries(g).filter(([, x]) => x.ecart_etabli).map(([k, x]) => ({ z, k, x })));
const etabliPlus = etablis.filter((e) => e.x.ecart_sens === 'plus');
const SRC = `Sources : clôtures de toutes les actions de la BRVM du ${jjmm(S.periode.debut)}/${S.periode.debut.slice(0, 4)} au ${jjmm(S.periode.fin)}/${S.periode.fin.slice(0, 4)} (base WESTBOURSE, lue le 24/11/2026) ; RSI 14 (lissage de Wilder) et calculs WESTBOURSE.`;
const SRC_CLASSES = `Classes de liquidité WESTBOURSE au ${jjmm(S.classes_au)}/2026, appliquées à tout l’historique (elles ne sont calculées que depuis juillet 2026).`;
const verdict = (x) => (!x.assez_de_cas ? `Trop peu de cas (moins de ${S.parametres.min_cas})` : x.ecart_etabli ? (x.ecart_sens === 'plus' ? 'Plus souvent qu’une séance quelconque' : 'Moins souvent qu’une séance quelconque') : 'Écart non établi');
const moisDet = Object.entries(D.par_mois).map(([m, n]) => `${MOIS[Number(m.slice(5, 7)) - 1]} ${n}`).join(', ');

// ── Quiz ────────────────────────────────────────────────────────────────────
const quiz = [
  {
    question: 'La hausse moyenne vaut 3 et la baisse moyenne 1. Quel est le RSI ?',
    options: ['25', '50', '75', '300'],
    correct: 2,
    explication: 'Force relative : 3 ÷ 1 = 3. RSI = 100 − 100 ÷ (1 + 3) = 100 − 25 = 75. 50 correspondrait à des hausses et des baisses égales ; 25, à des baisses trois fois plus fortes.',
  },
  {
    question: 'Un RSI sur 14 séances demande combien de clôtures, au minimum ?',
    options: ['15, car il faut 14 variations', '14, une clôture par séance', '13, car la première séance ne compte pas', '28, deux clôtures par séance'],
    correct: 0,
    explication: 'Le RSI travaille sur des variations d’une clôture à la suivante : 14 variations demandent 15 clôtures. C’est pourquoi l’atelier n’affiche rien avant la séance 15.',
  },
  {
    question: 'Avec le lissage de Wilder, comment se calcule la hausse moyenne du jour, sur 14 séances ?',
    options: [
      'La plus forte hausse relevée sur les 14 dernières séances',
      'La somme des hausses du jour et de la veille, divisée par deux',
      'La hausse du jour divisée par 14, sans tenir compte du passé',
      '(hausse moyenne de la veille × 13 + hausse du jour) ÷ 14',
    ],
    correct: 3,
    explication: 'Chaque nouvelle séance ne pèse que 1/14 ; le reste vient de la moyenne précédente. Le RSI garde ainsi la mémoire des séances passées : c’est le calcul de WESTBOURSE.',
  },
  {
    question: 'Un RSI de 25 se situe dans quelle zone ?',
    options: ['Surachat', 'Zone neutre', 'Hors échelle', 'Survente'],
    correct: 3,
    explication: 'Sous 30 : survente. Le mot décrit des baisses récentes qui ont dominé, pas une action « bon marché » ni une raison d’acheter.',
  },
  {
    question: `Sur la BRVM, combien de temps dure, en médiane, un passage en surachat (RSI au-dessus de 70) ?`,
    options: [`${ent(S.duree_mediane_seances.surachat)} séances`, 'Une seule séance, toujours', 'Plusieurs mois, en général', 'Il ne s’arrête jamais'],
    correct: 0,
    explication: `${ent(S.duree_mediane_seances.surachat)} séances en médiane, sur ${ent(S.entrees.surachat)} entrées depuis 2021 ; mais ${pc(S.part_zone_plus_de_10_seances_pct.surachat)} d’entre elles ont duré plus de 10 séances : dans une hausse forte, le RSI peut rester au-dessus de 70 longtemps.`,
  },
  {
    question: 'Une valeur ne s’échange plus depuis 49 séances, à cours inchangé. Que vaut son RSI ?',
    options: [
      'Il retombe à zéro, faute de tout mouvement de cours',
      'Il garde la valeur de la dernière séance échangée',
      'Il revient à 50 au bout de 14 séances sans échange',
      'Il passe en survente, faute d’acheteurs sur la valeur',
    ],
    correct: 1,
    explication: `Avec le lissage de Wilder, hausse et baisse moyennes diminuent du même facteur : leur rapport, donc le RSI, ne bouge plus. ${FG.map((f) => `${f.code} affichait ${fr(f.rsi_aujourdhui)}`).join(', ')} au ${dateFr(S.periode.fin)}, sans un seul échange depuis le ${dateFr(FG[0].dernier_echange)}.`,
  },
  {
    question: 'Pourquoi le RSI d’une valeur peu liquide est-il à lire avec prudence ?',
    options: [
      'Il ne se calcule pas sans un volume publié chaque jour de séance',
      'Il n’est publié qu’une fois par mois pour ces valeurs peu échangées',
      'Il est interdit par le règlement de la BRVM sur les petites valeurs',
      'Quelques ordres suffisent à faire bouger le cours, donc le RSI',
    ],
    correct: 3,
    explication: 'Le RSI se calcule sur les clôtures, à chaque séance. Mais si quelques titres suffisent à déplacer le cours, le RSI mesure l’effet de ces ordres plus qu’un mouvement de marché : vérifier d’abord les séances échangées et les volumes.',
  },
  {
    question: 'Les manuels proposent parfois 80 et 20 pour les valeurs peu liquides. Que montre la mesure sur la BRVM (2021-2026) ?',
    options: [
      'Que 80 et 20 rendent leur RSI nettement plus fiable que 70 et 30',
      'Qu’elles ne sont pas plus souvent en surachat que les plus liquides',
      'Que leur RSI ne sort presque jamais de la zone neutre, entre 30 et 70',
      'Que leur RSI reste figé au-dessus de 70 pendant des mois entiers',
    ],
    correct: 1,
    explication: `Surachat : ${pc(Z.A.surachat_70_pct)} des séances en classe A, ${pc(Z.C.surachat_70_pct)} en classe C. Pour y être aussi rares qu’en classe A, les seuils seraient plutôt ${EQ.C.haut} et ${EQ.C.bas} en classe C : le contraire de 80 et 20. La survente, elle, est plus fréquente en classe D (${pc(Z.D.survente_30_pct)}).`,
  },
  {
    question: 'Le jour du détachement d’un dividende, que fait en général le RSI ?',
    options: [
      'Il monte, porté par le dividende que reçoivent les actionnaires',
      'Il ne bouge pas : le détachement n’entre pas dans son calcul',
      `Il baisse nettement (médiane ${fr(D.ecart_rsi_median)} points en 2026)`,
      'Il passe toujours sous 30',
    ],
    correct: 2,
    explication: `Le cours baisse d’environ le montant du dividende, et le RSI compte cette baisse comme une autre : ${fr(D.ecart_rsi_median)} points en médiane sur ${ent(D.cas)} détachements datés de 2026, contre ${fr(D.ecart_rsi_median_autres_jours_2026)} les autres jours. Aucun n’est passé sous 30 ce jour-là : ce n’est pas une pression vendeuse.`,
  },
  {
    question: 'À la BRVM, de 2021 à 2026, sous quelle condition un RSI est-il passé sous 30 ?',
    options: [
      'Toujours avec un cours sous sa moyenne 50 séances',
      'Toujours avec un cours au-dessus de sa moyenne 50',
      'Uniquement pendant la période des dividendes, de mai à septembre',
      'Uniquement sur les valeurs de classe D, les moins liquides',
    ],
    correct: 0,
    explication: `${ent(POS.survente.sous)} séances en survente, toutes avec un cours sous sa moyenne 50 séances ; ${ent(POS.surachat['au-dessus'])} en surachat, toutes au-dessus. La survente confirme la baisse plus qu’elle ne la contredit.`,
  },
  {
    question: 'Après l’entrée en survente, 20 séances plus tard, le cours était plus haut :',
    options: [
      'Dans neuf cas sur dix environ',
      'À peine plus souvent qu’après une séance quelconque',
      'Jamais : la baisse continuait toujours après une survente',
      'Deux fois plus souvent qu’après une autre séance',
    ],
    correct: 1,
    explication: `${pc(SV.part_pct)} des cas contre ${pc(SV.part_base_pct)} pour une séance quelconque, sur ${ent(SV.cas)} cas : un écart que l’intervalle à 95 % ne permet pas d’établir. Un RSI bas n’a pas annoncé le rebond.`,
  },
  {
    question: 'Le cours fait un nouveau plus-haut, mais le RSI un plus-haut plus bas que le précédent. Comment l’appelle-t-on ?',
    options: ['Une divergence haussière', 'Une survente cachée', 'Une divergence baissière', 'Un croisement de moyennes'],
    correct: 2,
    explication: 'La hausse continue, mais avec moins de force : c’est une divergence baissière. Elle décrit un essoufflement ; elle ne dit ni si ni quand le cours se retournera.',
  },
  {
    question: 'Sur la BRVM, le RSI d’une valeur de classe C passe à 18. Que vérifier en premier ?',
    options: [
      'Le calendrier économique international et les annonces des banques centrales',
      'Les séances réellement échangées sur les 14 dernières, et leurs volumes',
      'Rien : une survente se lit telle quelle, quelle que soit la valeur',
      'Le RSI de toutes les autres valeurs de la cote, pour comparer',
    ],
    correct: 1,
    explication: 'D’abord que le RSI repose sur de vrais échanges : séances échangées, volumes, détachement de dividende récent. Ensuite seulement la tendance et les comptes de la société.',
  },
  {
    question: 'Que dit le RSI sur les comptes d’une société ?',
    options: ['Son bénéfice, calculé sur les quatre derniers trimestres', 'Son dividende', 'Rien : il ne mesure que les mouvements de cours', 'Sa dette'],
    correct: 2,
    explication: 'Le RSI compare des hausses et des baisses de cours. Un RSI bas sur une société dont les résultats se dégradent ne signale pas une occasion.',
  },
];

// ── Leçon ───────────────────────────────────────────────────────────────────
const lecon = {
  titre: 'Leçon 4 — Le RSI : mesurer les excès de marché, et le lire à la BRVM',
  module: MODULE,
  categorie: 'technical',
  duree_min: 20,
  sous_titre: 'Un indicateur borné de 0 à 100 qui compare les hausses et les baisses récentes : son calcul exact, ses zones, ses divergences, et la façon de le lire sur un marché où certaines valeurs ne s’échangent pas.',
  resume: `Le RSI (indice de force relative) compare l’ampleur des hausses et des baisses sur les dernières séances, en général 14. Cette leçon le calcule pas à pas, explique le lissage de Wilder qu’utilise WESTBOURSE, ses zones et ses divergences, puis le confronte à la BRVM : ${ent(Z.tout.seances)} séances mesurées depuis 2021, par classe de liquidité, détachements de dividende et séances sans échange compris.`,
  nouveaute: { type: 'mis_a_jour', depuis: '2026-11-24' },
  sections: [
    {
      type: 'definition',
      titre: 'Le calcul : du cours au RSI',
      contenu: [
        'Le RSI (relative strength index, ou indice de force relative) a été présenté par J. Welles Wilder en 1978. Il compare l’ampleur des hausses et des baisses du cours sur les dernières séances, en général 14.',
        'Le calcul se fait en trois temps. On note la variation de chaque séance par rapport à la précédente, et on sépare les hausses des baisses. On calcule la hausse moyenne et la baisse moyenne, puis leur rapport : la force relative. On ramène enfin ce rapport sur une échelle de 0 à 100.',
        `Un RSI sur 14 séances demande 14 variations, donc 15 clôtures. Sur l’exemple ci-dessous, les hausses totalisent ${ent(sommeH)} FCFA et les baisses ${ent(sommeB)} : hausse moyenne ${fr(sommeH / N, 2)}, baisse moyenne ${fr(sommeB / N, 2)}, force relative ${fr(sommeH / sommeB, 1)}, RSI ${fr(rsi15)}. Le cours a monté de ${ent(PAS[0])} à ${ent(PAS[14])} FCFA en dominant presque chaque séance : le RSI est en surachat.`,
        'Si les baisses disparaissent, le RSI tend vers 100 ; si les hausses disparaissent, il tend vers 0. Cette échelle fixe est son grand avantage : un RSI se compare d’une action à l’autre, contrairement au MACD de la leçon suivante.',
      ].join('\n'),
      formules: [
        { nom: 'Force relative (RS)', expression: 'hausse moyenne ÷ baisse moyenne, sur 14 séances', exemple: `${fr(sommeH / N, 2)} ÷ ${fr(sommeB / N, 2)} = ${fr(sommeH / sommeB, 1)}` },
        { nom: 'RSI', expression: '100 − 100 ÷ (1 + RS)', exemple: `100 − 100 ÷ ${fr(1 + sommeH / sommeB, 0)} ≈ ${fr(rsi15)}` },
      ],
      tableau: {
        colonnes: ['Séance', 'Clôture (FCFA)', 'Variation', 'Hausse', 'Baisse'],
        lignes: PAS.map((c, i) => {
          if (i === 0) return ['S1', ent(c), '—', '—', '—'];
          const v = variations[i - 1];
          return [`S${i + 1}`, ent(c), sg(v), v > 0 ? ent(v) : '0', v < 0 ? ent(-v) : '0'];
        }),
        note: `Valeurs d’exemple. 15 clôtures, 14 variations : hausses ${ent(sommeH)}, baisses ${ent(sommeB)}.`,
      },
      simulation: {
        type: 'rsi_pas_a_pas',
        consigne: 'Modifiez une clôture, raccourcissez la période, ou figez le cours sur les dernières séances : le tableau montre à chaque séance la variation, les moyennes lissées et le RSI.',
        clotures: ATELIER,
        periode: N,
      },
    },
    {
      type: 'definition',
      titre: 'Le lissage de Wilder : pourquoi le RSI se souvient',
      contenu: [
        'Le premier RSI part d’une moyenne simple des 14 premières variations. Ensuite, Wilder ne refait pas la moyenne sur une fenêtre qui glisse : il lisse. La hausse moyenne du jour vaut la hausse moyenne de la veille multipliée par 13, plus la hausse du jour, le tout divisé par 14. Même calcul pour la baisse.',
        `Chaque séance ne pèse donc que 1/14, et les plus anciennes ne disparaissent jamais tout à fait : le RSI se souvient, et il est plus stable. Dans l’exemple, la séance 16 baisse de ${ent(PAS[14] - SUITE[0])} FCFA : le RSI lissé passe à ${fr(rsi16)}, quand une simple moyenne sur les 14 dernières variations donnerait ${fr(rsi16Simple)}.`,
        'C’est le calcul de WESTBOURSE, sur les fiches valeur comme dans les simulateurs de cette leçon. Il a une conséquence que peu d’outils signalent : quand le cours cesse de bouger, hausse et baisse moyennes diminuent du même facteur, et le RSI reste figé à sa dernière valeur. Le Focus BRVM y revient.',
      ].join('\n'),
      formules: [
        { nom: 'Lissage de Wilder, à partir de la séance 16', expression: 'moyenne du jour = (moyenne de la veille × 13 + variation du jour) ÷ 14', exemple: `Baisse moyenne à la séance 16 : (${fr(sommeB / N, 2)} × 13 + ${ent(PAS[14] - SUITE[0])}) ÷ 14 ≈ ${fr(mb16, 2)}` },
      ],
      stats: [
        { label: 'RSI à la séance 15', valeur: fr(rsi15), detail: 'première valeur, moyenne simple' },
        { label: 'Séance 16, lissage de Wilder', valeur: fr(rsi16), detail: 'le calcul de WESTBOURSE' },
        { label: 'Séance 16, fenêtre simple', valeur: fr(rsi16Simple), detail: 'pour comparaison' },
      ],
    },
    {
      type: 'importance',
      titre: 'Les trois zones, et combien de temps on y reste',
      contenu: [
        'Les seuils de 70 et 30 sont des conventions, proposées par Wilder et reprises par l’usage. Ce ne sont pas des lois du marché. Au-dessus de 70, les hausses récentes ont nettement dominé : on parle de surachat. Sous 30, ce sont les baisses : on parle de survente.',
        '« Surachat » ne signifie pas que l’action est trop chère, mais que son cours a monté vite ; une action peut être en surachat et rester bon marché au regard de ses comptes. « Survente » ne signifie pas bon marché.',
        `Sur la BRVM, de 2021 à 2026, ${pc(Z.tout.surachat_70_pct)} des séances ont un RSI au-dessus de 70 et ${pc(Z.tout.survente_30_pct)} sous 30. Un passage en zone extrême dure peu : ${ent(S.duree_mediane_seances.surachat)} séances en médiane pour le surachat, ${ent(S.duree_mediane_seances.survente)} pour la survente. Mais ${pc(S.part_zone_plus_de_10_seances_pct.surachat)} des surachats ont duré plus de 10 séances : vendre dès 70, c’est parfois sortir d’une hausse qui continue.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Zone', 'RSI', 'Ce que cela décrit', 'Ce que cela ne veut pas dire'],
        lignes: [
          ['Survente', 'Sous 30', 'Les baisses récentes ont nettement dominé', '« Bon marché », ni « à acheter »'],
          ['Neutre', '30 à 70', 'Pas d’excès marqué', '« Indécision » : une tendance peut être franche sans être extrême'],
          ['Surachat', 'Au-dessus de 70', 'Les hausses récentes ont nettement dominé', '« Trop cher », ni « à vendre »'],
        ],
        note: 'Des descriptions d’un mouvement passé.',
      },
      stats: [
        { label: 'Séances en surachat', valeur: pc(Z.tout.surachat_70_pct), detail: 'RSI au-dessus de 70, toutes actions, 2021-2026' },
        { label: 'Séances en survente', valeur: pc(Z.tout.survente_30_pct), detail: 'RSI sous 30' },
        { label: 'Durée médiane d’un surachat', valeur: `${ent(S.duree_mediane_seances.surachat)} séances`, detail: `${pc(S.part_zone_plus_de_10_seances_pct.surachat)} durent plus de 10 séances` },
      ],
      simulation: {
        type: 'technique',
        indicateur: 'rsi',
        consigne: 'Changez la période et les seuils : la zone extrême décrit l’intensité d’un mouvement récent, pas sa fin. La lecture signale aussi les séances sans échange et un RSI figé.',
        codes: CODES_DIRECT,
        periode: 14,
        seuil_haut: 70,
        seuil_bas: 30,
      },
    },
    {
      type: 'definition',
      titre: 'Les divergences',
      contenu: [
        'Une divergence apparaît quand le cours et le RSI ne vont plus dans le même sens. Divergence baissière : le cours fait un nouveau plus-haut, le RSI un plus-haut plus bas que le précédent ; la hausse continue, mais avec moins de force. Divergence haussière : le cours fait un nouveau plus-bas, le RSI un plus-bas plus haut ; la baisse s’essouffle.',
        `Le graphique d’exemple, calculé avec le RSI du site, en montre une : le cours culmine à ${ent(DIV[P1])} à la séance ${P1 + 1}, avec un RSI de ${fr(rsiDiv[P1])} ; il monte plus haut, à ${ent(DIV[P2])}, à la séance ${P2 + 1}, mais le RSI n’atteint plus que ${fr(rsiDiv[P2])}.`,
        'C’est l’usage du RSI le plus cité. Il n’est pas mesuré ici : le repérage d’un « plus-haut » dépend de règles qui varient d’un auteur à l’autre. Une divergence décrit un essoufflement ; elle ne dit ni si ni quand le cours se retournera, et il peut s’écouler des semaines avant. Sur une valeur peu échangée, quelques ordres suffisent à la fabriquer.',
      ].join('\n'),
      graphiques: [
        {
          type: 'line',
          titre: 'Une divergence baissière : le cours monte plus haut, le RSI moins haut (exemple)',
          labels: DIV.map((_, i) => `S${i + 1}`),
          series: [
            { nom: 'Cours (FCFA)', valeurs: DIV },
            { nom: 'RSI 14', valeurs: rsiDiv.map((v) => (v == null ? null : Number(v.toFixed(1)))), axe: 'droite' },
          ],
          unite: 'FCFA',
          unite_droite: 'RSI',
          note: `Valeurs d’exemple, RSI calculé comme sur WESTBOURSE. Plus-hauts du cours : ${ent(DIV[P1])} (séance ${P1 + 1}) puis ${ent(DIV[P2])} (séance ${P2 + 1}) ; RSI : ${fr(rsiDiv[P1])} puis ${fr(rsiDiv[P2])}.`,
          reel: false,
        },
      ],
    },
    {
      type: 'cas',
      titre: 'Sur la BRVM : le RSI du jour, lu avec la tendance',
      reel: true,
      contenu: [
        'Le RSI sur 14 séances de cinq valeurs, recalculé à l’ouverture de la leçon sur les clôtures réelles, avec le cours face à ses moyennes.',
        'Lisez chaque ligne en deux temps : la zone du RSI, puis la position du cours face à sa moyenne 50 séances. Les manuels croisent les deux dans une grille à quatre cases. À la BRVM, deux de ces cases ne se sont jamais présentées depuis 2021 : une survente avec un cours au-dessus de sa moyenne 50 séances, et un surachat avec un cours en dessous.',
        `Sur ${ent(POS.survente.sous)} séances en survente, toutes avaient un cours sous sa moyenne 50 séances ; sur ${ent(POS.surachat['au-dessus'])} séances en surachat, toutes au-dessus. Une survente ne contredit donc pas la baisse : elle en mesure la vitesse.`,
      ].join('\n'),
      tableau: {
        colonnes: ['RSI', 'Cours au-dessus de sa moyenne 50', 'Cours sous sa moyenne 50'],
        lignes: [
          ['Au-dessus de 70', `Hausse rapide dans une hausse de fond (${ent(POS.surachat['au-dessus'])} séances)`, `Rebond rapide dans une baisse de fond : jamais observé (${ent(POS.surachat.sous)})`],
          ['30 à 70', 'Hausse de fond sans excès', 'Baisse de fond sans accélération'],
          ['Sous 30', `Repli rapide dans une hausse de fond : jamais observé (${ent(POS.survente['au-dessus'])})`, `Baisse rapide dans une baisse de fond (${ent(POS.survente.sous)} séances)`],
        ],
        note: `Séances en zone, toutes actions, 2021-2026. ${SRC}`,
      },
      donnees_reelles: { vue: 'technique', codes: CODES_DIRECT },
    },
    {
      type: 'importance',
      titre: 'Focus BRVM : rendre le RSI intelligent pour les acteurs régionaux',
      contenu: [
        `À la BRVM, la première question n’est pas « quelle zone ? » mais « le RSI repose-t-il sur de vrais échanges ? ». WESTBOURSE classe chaque valeur selon sa liquidité, de A (négociable sans friction) à D (très illiquide) : au ${dateFr(S.classes_au)}, ${nbClasse.A} valeurs en A, ${nbClasse.B} en B, ${nbClasse.C} en C, ${nbClasse.D} en D.`,
        `Premier piège, propre à ce marché : le RSI figé. ${FG.map((f) => `${f.code} (${ent(f.cours)} FCFA)`).join(' et ')} n’ont connu aucun échange depuis le ${dateFr(FG[0].dernier_echange)}. Leur RSI affiche ${FG.map((f) => fr(f.rsi_aujourdhui)).join(' et ')}, comme une valeur calme en zone neutre ; en réalité, il n’a plus rien mesuré depuis ${ent(FG[0].seances_sans_variation)} séances. Le simulateur de la leçon le signale désormais.`,
        `Deuxième question : les seuils. Les manuels conseillent de les écarter, à 80 et 20, pour les valeurs peu liquides. La mesure ne le confirme pas. De 2021 à 2026, les valeurs de classe C n’ont pas été plus souvent en surachat que celles de classe A (${pc(Z.C.surachat_70_pct)} des séances contre ${pc(Z.A.surachat_70_pct)}) ; la survente est plus fréquente en classe D (${pc(Z.D.survente_30_pct)} contre ${pc(Z.A.survente_30_pct)}).`,
        `Pour qu’un RSI extrême soit aussi rare dans chaque classe qu’à 70 et 30 en classe A, les seuils seraient ${EQ.B.haut} et ${EQ.B.bas} en classe B, ${EQ.C.haut} et ${EQ.C.bas} en C, ${EQ.D.haut} et ${EQ.D.bas} en D. Ce ne sont pas des seuils à appliquer : la fréquence des zones dépend aussi de la tendance de chaque valeur. Depuis janvier 2021, ${PA.classe_A.map((p, i) => `${p.code}${i === 0 ? ' a pris' : ''} ${pc(p.variation_pct, 0)}`).join(', ')}, quand l’action médiane cotée depuis cette date prenait ${pc(PA.mediane_pct, 0)}. Retenez que la liquidité se vérifie avant le RSI, pas qu’elle se corrige par un seuil.`,
      ].join('\n'),
      etapes: [
        { titre: 'Vérifier que le RSI repose sur de vrais échanges', detail: 'Séances échangées sur les 14 dernières, volumes, classe de liquidité. Un cours figé fige le RSI.', cle: true },
        { titre: 'Écarter un détachement de dividende récent', detail: 'Le jour du détachement, le RSI perd souvent 10 points ou plus sans pression vendeuse.' },
        { titre: 'Situer la tendance', detail: 'Cours face à sa moyenne 50 séances : une survente y est toujours une baisse rapide dans une baisse de fond.' },
        { titre: 'Chercher une divergence, sans en attendre un signal', detail: 'Un essoufflement se décrit ; il ne se date pas.' },
        { titre: 'Lire les comptes de la société', detail: 'Le RSI ne dit rien du bénéfice, du dividende ou de la dette.', cle: true },
      ],
      tableau: {
        colonnes: ['Classe', 'Valeurs', 'Séances en surachat', 'Séances en survente', 'Sous 20', 'Seuils de même rareté qu’en A'],
        lignes: ['A', 'B', 'C', 'D'].map((k) => [k, ent(nbClasse[k]), pc(Z[k].surachat_70_pct), pc(Z[k].survente_30_pct), pc(Z[k].survente_20_pct), `${EQ[k].haut} et ${EQ[k].bas}`]),
        note: `Part des séances, 2021-2026, RSI 14. ${SRC_CLASSES} ${SRC}`,
      },
      graphiques: [
        {
          type: 'bar',
          titre: 'Part des séances en zone extrême, par classe de liquidité (%, 2021-2026)',
          labels: ['Classe A', 'Classe B', 'Classe C', 'Classe D'],
          series: [
            { nom: 'Surachat (au-dessus de 70)', valeurs: ['A', 'B', 'C', 'D'].map((k) => Z[k].surachat_70_pct) },
            { nom: 'Survente (sous 30)', valeurs: ['A', 'B', 'C', 'D'].map((k) => Z[k].survente_30_pct) },
          ],
          unite: '%',
          note: `Les valeurs peu liquides ne sont pas plus souvent en surachat ; elles sont un peu plus souvent en survente. ${SRC_CLASSES} ${SRC}`,
          reel: true,
        },
      ],
      encadres: [
        { ton: 'cle', titre: 'La liquidité filtre le RSI', texte: 'Un RSI extrême sur une valeur qui s’échange chaque séance décrit un vrai mouvement de marché. Le même RSI sur une valeur sans échange, ou faite de quelques titres, ne décrit presque rien. Commencez toujours par là.' },
      ],
    },
    {
      type: 'cas',
      titre: 'Cinq valeurs au RSI bas, le 20 novembre 2026',
      reel: true,
      contenu: [
        `Prenons cinq valeurs dont le RSI était, le 20 novembre 2026, sous 30 ou tout près. Le tableau les situe avec la grille du Focus BRVM : classe de liquidité, séances échangées sur les 14 dernières, position du cours face à sa moyenne 50 séances. Toutes s’étaient échangées à chacune des 14 séances : leur RSI reposait sur de vrais échanges.`,
        `Quatre étaient sous leur moyenne 50 séances, comme toute survente depuis 2021. Bridge Bank Group Côte d’Ivoire (BBGC), admise à la cote le 24 septembre 2026, n’avait encore que ${ent(C20.find((x) => x.code === 'BBGC').seances_cotees)} séances : pas de moyenne 50 séances, et un RSI à prendre avec d’autant plus de recul.`,
        'Ces lignes décrivent une séance. Elles ne disent rien de la suite, et aucune n’est une raison d’acheter : la section suivante montre ce que les surventes ont valu à la BRVM. Le bloc en direct, dessous, donne la situation d’aujourd’hui.',
      ].join('\n'),
      tableau: {
        colonnes: ['Valeur', 'Classe', 'Cours (FCFA)', 'RSI 14', 'Moyenne 50', 'Cours face à la moyenne 50', 'Séances échangées sur 14'],
        lignes: C20.map((x) => [x.code, x.classe, ent(x.cours), fr(x.rsi), x.moyenne_50 == null ? '—' : ent(x.moyenne_50), x.position_50 == null ? `Moins de 50 séances (${x.seances_cotees})` : x.position_50 === 'sous' ? 'Sous' : 'Au-dessus', `${x.seances_echangees_14} sur 14`]),
        note: `Séance du 20/11/2026 : clôtures et titres échangés publiés par la BRVM ; RSI 14 et moyenne 50 séances calculés par WESTBOURSE ; ${SRC_CLASSES}`,
      },
      donnees_reelles: { vue: 'technique', codes: C20.map((x) => x.code) },
    },
    {
      type: 'importance',
      titre: 'Focus BRVM : dividendes et calendrier',
      contenu: [
        `Le détachement d’un dividende fait baisser le cours d’environ son montant, et le RSI compte cette baisse comme une autre. Sur les ${ent(D.cas)} détachements datés de 2026, le RSI a perdu ${fr(Math.abs(D.ecart_rsi_median))} points en médiane le jour même, contre ${fr(D.ecart_rsi_median_autres_jours_2026)} les autres jours, et 10 points ou plus dans ${ent(D.baisse_de_10_points_ou_plus)} cas. Aucun n’est passé sous 30 ce jour-là : le RSI venait souvent d’une zone haute.`,
        `L’exemple le plus net : ${top.code}, le ${dateFr(top.date)}, passe d’un RSI de ${fr(top.rsi_veille)} à ${fr(top.rsi_jour)}, pour un dividende de ${fr(top.montant, 2)} FCFA, soit ${pc(top.rendement_pct)} du cours de la veille. Ces détachements se concentrent de mai à septembre (${moisDet}) : en été, un RSI qui chute se lit d’abord avec le calendrier des dividendes.`,
        `Le calendrier des échanges compte aussi. De 2023 à 2025, la valeur échangée médiane par séance a été la plus faible en ${calMin.mois} (${calMin.indice_mediane} % de la médiane annuelle) et la plus forte en ${calMax.mois} (${calMax.indice_mediane} %). L’été n’est pas creux à la BRVM : ${ete.map((x) => `${x.mois} ${x.indice_mediane} %`).join(', ')}. En ${calMin.mois}, les mouvements reposent sur moins d’échanges.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Valeur', 'Détachement', 'Dividende (FCFA)', 'Rendement', 'Cours le jour même', 'RSI la veille', 'RSI le jour même'],
        lignes: D.plus_fortes.map((x) => [x.code, jjmm(x.date) + '/2026', fr(x.montant, 2), pc(x.rendement_pct), `${x.variation_cours_pct > 0 ? '+' : ''}${pc(x.variation_cours_pct)}`, fr(x.rsi_veille), fr(x.rsi_jour)]),
        note: `Les cinq plus fortes baisses du RSI un jour de détachement en 2026. Dividendes nets datés du calendrier officiel de la BRVM ; clôtures BRVM ; RSI WESTBOURSE. ${SRC}`,
      },
      graphiques: [
        {
          type: 'bar',
          titre: 'Valeur échangée médiane par séance, selon le mois (100 = médiane de l’année, 2023-2025)',
          labels: CAL.map((x) => x.mois.slice(0, 1).toUpperCase() + x.mois.slice(1, 4)),
          valeurs: CAL.map((x) => x.indice_mediane),
          unite: '',
          note: `${calMin.mois[0].toUpperCase() + calMin.mois.slice(1)} est le mois le plus calme, ${calMax.mois} le plus actif ; juillet et août ne sont pas en retrait. Sources : valeur échangée de toutes les actions, séances 2023 à 2025 (base WESTBOURSE, lue le 24/11/2026 ; seules années où elle est renseignée sur toutes les lignes) ; calculs WESTBOURSE.`,
          reel: true,
        },
      ],
    },
    {
      type: 'importance',
      titre: 'Ce que le RSI a valu à la BRVM',
      contenu: [
        `La leçon 1 présente le rejeu d’un score qui combine plusieurs éléments, dont le RSI. Ici, le RSI seul : nous avons repéré chaque entrée en survente (passage sous 30) et en surachat (passage au-dessus de 70), sur toutes les actions de la BRVM du ${dateFr(S.periode.debut)} au ${dateFr(S.periode.fin)}, et regardé le cours 20 séances plus tard.`,
        `Point de comparaison : une séance quelconque, après laquelle le cours était plus haut dans ${pc(B.part_hausse_pct)} des cas et plus bas dans ${pc(B.part_baisse_pct)}. Après une entrée en survente, il était plus haut dans ${pc(SV.part_pct)} des cas : à peine plus, sans écart établi. Après une entrée en surachat, plus bas dans ${pc(SA.part_pct)} : à peine moins, sans écart établi non plus.`,
        `${etabliPlus.length === 0 ? 'Aucune classe de liquidité ne montre de rebond ni de repli établi dans le sens que prête la tradition.' : `${etabliPlus.length} découpage(s) montrent un écart dans le sens de la tradition.`} Le seul écart établi va à l’inverse : en classe C, après un surachat, le cours a baissé moins souvent que d’habitude (${pc(AP.surachat.C.part_pct)} contre ${pc(AP.surachat.C.part_base_pct)}). Les intervalles supposent des cas indépendants, ce qu’ils ne sont pas tout à fait : retenez l’ordre de grandeur. À la BRVM, un RSI extrême décrit un mouvement ; il n’en a pas annoncé la fin.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Entrée en zone', 'Valeurs', 'Cas', 'Sens attendu', 'Part, 20 séances après', 'Séance quelconque', 'Intervalle à 95 %', 'Verdict'],
        lignes: ['survente', 'surachat'].flatMap((z) => ['tout', 'A', 'B', 'C', 'D'].map((g) => {
          const x = AP[z][g];
          return [z === 'survente' ? 'Survente' : 'Surachat', g === 'tout' ? 'Toutes' : `Classe ${g}`, ent(x.cas), z === 'survente' ? 'Hausse' : 'Baisse', pc(x.part_pct), pc(x.part_base_pct), `${fr(x.ic95_pct[0])} à ${fr(x.ic95_pct[1])} %`, verdict(x)];
        })),
        note: `Part des cas où le cours, 20 séances après l’entrée en zone, était dans le sens que lui prête la lecture courante (rebond après une survente, repli après un surachat). Chaque classe est comparée à ses propres séances. Intervalle de Wilson à 95 %, au moins ${S.parametres.min_cas} cas. ${SRC_CLASSES} ${SRC}`,
      },
      graphiques: [
        {
          type: 'bar',
          titre: 'Après l’entrée en zone, le cours est-il allé dans le sens attendu plus souvent ? (%, 20 séances après)',
          labels: ['Survente : hausse', 'Surachat : baisse'],
          series: [
            { nom: 'Après l’entrée en zone', valeurs: [SV.part_pct, SA.part_pct] },
            { nom: 'Séance quelconque', valeurs: [SV.part_base_pct, SA.part_base_pct] },
          ],
          unite: '%',
          note: `Les barres restent proches : ni la survente ni le surachat n’ont annoncé la suite. ${SRC}`,
          reel: true,
        },
      ],
      stats: [
        { label: 'Entrées en survente', valeur: ent(S.entrees.survente), detail: 'passages sous 30, toutes actions, 2021-2026' },
        { label: 'Plus haut 20 séances après', valeur: pc(SV.part_pct), detail: `contre ${pc(SV.part_base_pct)} après une séance quelconque` },
        { label: 'Entrées en surachat', valeur: ent(S.entrees.surachat), detail: 'passages au-dessus de 70' },
        { label: 'Plus bas 20 séances après', valeur: pc(SA.part_pct), detail: `contre ${pc(SA.part_base_pct)}` },
      ],
      encadres: [
        { ton: 'cle', titre: 'Ce que cela veut dire pour vous', texte: 'Le RSI reste utile pour décrire la vitesse d’un mouvement et repérer un excès récent. Il ne justifie pas, à lui seul, un achat ou une vente : la grille de décision de la leçon 0 demande toujours le contexte, les niveaux, le volume et un niveau d’invalidation.' },
      ],
    },
    {
      type: 'piege',
      titre: 'Les mauvaises lectures du RSI',
      contenu: 'Le RSI est l’un des indicateurs les plus populaires, et l’un des plus mal utilisés. À la BRVM, deux pièges s’ajoutent à ceux des manuels : le RSI figé des valeurs sans échange, et la chute du RSI au détachement d’un dividende.',
      points: [
        { titre: '« Surachat » ne veut pas dire « vendre »', detail: `${pc(S.part_zone_plus_de_10_seances_pct.surachat)} des surachats ont duré plus de 10 séances, et après un surachat le cours n’a pas baissé plus souvent qu’après une autre séance.`, verifier: 'La tendance de fond, sur la moyenne 50 séances.' },
        { titre: '« Survente » ne veut pas dire « acheter »', detail: `Toute survente depuis 2021 s’est produite sous la moyenne 50 séances, et le rebond n’a pas suivi plus souvent qu’après une séance quelconque (${pc(SV.part_pct)} contre ${pc(SV.part_base_pct)}).`, verifier: 'Les comptes de la société : une baisse a parfois de bonnes raisons.' },
        { titre: 'Un RSI sans échanges', detail: 'Un cours figé fige le RSI à sa dernière valeur ; quelques titres suffisent à le pousser vers un extrême.', verifier: 'Les séances échangées sur les 14 dernières et leurs volumes.' },
        { titre: 'Le détachement d’un dividende', detail: `Le RSI perd ${fr(Math.abs(D.ecart_rsi_median))} points en médiane ce jour-là, sans pression vendeuse.`, verifier: 'Le calendrier des dividendes.' },
        { titre: 'Une divergence n’est pas un signal d’exécution', detail: 'Elle décrit un essoufflement, sans date ; elle n’est pas mesurée ici.', verifier: 'Une confirmation par le cours lui-même.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'L’essentiel',
      contenu: 'Le RSI mesure un excès récent, pas une valeur. Il répond à une seule question : le cours a-t-il bougé de façon inhabituellement rapide dans un sens ces dernières séances ? À la BRVM, une question vient avant : ce mouvement a-t-il été fait de vrais échanges ?',
      points: [
        { titre: 'RSI = 100 − 100 ÷ (1 + RS)', detail: '14 variations, donc 15 clôtures ; puis le lissage de Wilder, celui de WESTBOURSE.' },
        { titre: '70 et 30 : des conventions', detail: 'Une zone décrit un excès récent ; elle dure 2 à 3 séances en médiane, parfois bien plus.' },
        { titre: 'La liquidité d’abord', detail: 'Séances échangées, volumes, classe : un cours figé fige le RSI.' },
        { titre: 'Le calendrier ensuite', detail: 'Un détachement de dividende fait chuter le RSI sans pression vendeuse.' },
        { titre: 'Mesuré sur la BRVM', detail: 'Ni la survente ni le surachat n’ont annoncé la suite, dans aucune classe de liquidité.' },
      ],
    },
  ],
  charts: [],
  quiz,
  qcm: quiz[0],
  // Liste FIXE : rien n'est repris de la version précédente (le générateur doit
  // donner le même fichier à chaque exécution).
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
console.log(`écrit l04-rsi.json — ${lecon.sections.length} sections, ${quiz.length} questions, ${total} caractères ; bonne réponse la plus longue ${plusLongues}/${quiz.length} ; positions A-D ${positions.join('/')}`);
if (longs.length) { console.error('paragraphes trop longs :', longs); process.exitCode = 1; }
if (/NaN|undefined|Infinity/.test(JSON.stringify(lecon))) { console.error('valeur non calculée'); process.exitCode = 1; }
