#!/usr/bin/env node
// Génère la leçon 3 du niveau 3 (moyennes mobiles), enrichie le 2026-11-24 à
// partir de la relecture critique fournie par l'exploitant : calcul pas à pas,
// moyennes simple / pondérée / exponentielle, choix 20 et 50 justifié par le
// calendrier réel de la BRVM, croisements définis, écart du cours à ses
// moyennes, un cas réel daté (CBIBF), et ce que valent les croisements sur six
// ans de BRVM.
//
//   node --no-warnings scripts/academy-lecon3-moyennes.mjs
//
// Les chiffres de marché viennent de
// lib/academy/contenus/niveau3/sources/moyennes-brvm-2026-11-24.json, produit
// par scripts/academy-lecon3-stats.mjs. Les exemples fictifs sont calculés ici
// avec lib/indicators.ts : la leçon, l'atelier et la mesure appliquent les mêmes
// formules.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const { emaSeries } = await import(pathToFileURL(path.join(ICI, '..', 'lib', 'indicators.ts')).href);
const DOSSIER = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau3');
const FICHIER = path.join(DOSSIER, 'l03-moyennes-mobiles.json');
const S = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'sources', 'moyennes-brvm-2026-11-24.json'), 'utf8'));
const ancienne = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));

const fr = (n, d = 1) => {
  const [e, dec] = Math.abs(n).toFixed(d).split('.');
  return (n < 0 ? '−' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? `,${dec}` : '');
};
const pc = (n, d = 1) => `${fr(n, d)} %`;
const pcs = (n, d = 1) => `${n > 0 ? '+' : ''}${pc(n, d)}`;
const ent = (n) => fr(n, 0);
const dateFr = (iso) => {
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${Number(iso.slice(8, 10))}${iso.slice(8, 10) === '01' ? 'er' : ''} ${MOIS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
};
const jjmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// ── Exemples FICTIFS, calculés ───────────────────────────────────────────────
const PAS = [100, 102, 101, 105, 107, 108, 106, 104];
const N_PAS = 5;
const lignesPas = PAS.map((c, i) => {
  if (i < N_PAS - 1) return { s: i + 1, c, fen: null, sma: null, ecart: null };
  const fen = PAS.slice(i - N_PAS + 1, i + 1);
  const sma = fen.reduce((t, x) => t + x, 0) / N_PAS;
  return { s: i + 1, c, fen, sma, ecart: (c / sma - 1) * 100 };
});
const emaPas = emaSeries(PAS, N_PAS);

// Retournement fictif, pour comparer simple et exponentielle.
const RET = [100, 101, 100, 99, 100, 101, 100, 104, 108, 112, 115, 117, 116, 112, 108, 105];
const smaRet = RET.map((_, i) => (i < 4 ? null : RET.slice(i - 4, i + 1).reduce((t, x) => t + x, 0) / 5));
const emaRet = emaSeries(RET, 5);
const iSommet = RET.indexOf(Math.max(...RET));
const premiereBaisse = (m) => m.findIndex((v, i) => i > iSommet && v != null && m[i - 1] != null && v < m[i - 1]);
const baisseEma = premiereBaisse(emaRet);
const baisseSma = premiereBaisse(smaRet);

// Poids de la dernière clôture, N = 20.
const N20 = 20;
const poidsSimple = 100 / N20;
const poidsPondere = (N20 / ((N20 * (N20 + 1)) / 2)) * 100;
const poidsExpo = (2 / (N20 + 1)) * 100;

// ── Faits de marché (source) ─────────────────────────────────────────────────
const SIM = S.simple;
const EXP = S.exponentielle;
const B = S.base_20;
const annees = Object.entries(S.seances_par_an).filter(([a]) => a < '2026');
const seancesMin = Math.min(...annees.map(([, n]) => n));
const seancesMax = Math.max(...annees.map(([, n]) => n));
const seancesMoy = annees.reduce((t, [, n]) => t + n, 0) / annees.length;
const parMois = seancesMoy / 12;
const L = S.liquidite;
const figees = L.plus_touchees.filter((x) => x.sans_echange === L.fenetre);
const SRC = `Sources : clôtures de toutes les actions de la BRVM du ${jjmm(S.periode.debut)}/${S.periode.debut.slice(0, 4)} au ${jjmm(S.periode.fin)}/${S.periode.fin.slice(0, 4)} (base WESTBOURSE, lue le 24/11/2026) ; moyennes et croisements calculés par WESTBOURSE.`;

const CB = S.exemples.cbibf;
const cbSeance = (d) => CB.seances.find((x) => x.date === d);
const cbHaussier = CB.croisements.find((x) => x.sens === 'haussier');
const cbBaissier = CB.croisements.find((x) => x.sens === 'baissier' && x.date > cbHaussier.date);
const iH = CB.seances.findIndex((x) => x.date === cbHaussier.date);
const cbVeilleH = CB.seances[iH - 1];
const cbH = CB.seances[iH];
let baissesAvantH = 0;
for (let i = iH; i > 0 && CB.seances[i].cloture < CB.seances[i - 1].cloture; i--) baissesAvantH++;
const cbDebut = CB.seances.reduce((m, x) => (x.cloture > m.cloture ? x : m), CB.seances[0]);
const cbB = cbSeance(cbBaissier.date);
const cbFin = CB.seances.at(-1);
const cbBaisseAuCroisement = (cbB.cloture / cbDebut.cloture - 1) * 100;
const cbBaisseTotale = (cbFin.cloture / cbDebut.cloture - 1) * 100;
const cbVolDebut = cbSeance(cbDebut.date).volume;
const cbVolMax = CB.seances.reduce((m, x) => (x.volume > m.volume ? x : m), CB.seances[0]);

const FT = S.exemples.ftsc;

const verdict = (x) => (!x.assez_de_cas ? `Trop peu de cas (moins de ${S.parametres.min_cas})` : x.ecart_etabli ? (x.ecart_sens === 'plus' ? 'Plus souvent qu’une séance quelconque' : 'Moins souvent qu’une séance quelconque') : 'Écart non établi');
const verdictCourt = (x) => (!x.assez_de_cas ? 'trop peu de cas' : x.ecart_etabli ? (x.ecart_sens === 'plus' ? 'plus souvent' : 'moins souvent') : 'écart non établi');
const cellule = (x) => `${pc(x.part_pct)} contre ${pc(x.part_base_pct)} (${ent(x.cas)} cas) : ${verdictCourt(x)}`;
const toutesLesCellules = [SIM, EXP].flatMap((m) => [m.apres_20, ...Object.values(m.robustesse)].flatMap((g) => [g.haussier, g.baissier]));
const nettementMieux = toutesLesCellules.filter((x) => x.ecart_etabli && x.ecart_sens === 'plus').length;
const R1 = SIM.robustesse['2021-2023'];
const R2 = SIM.robustesse['2024-2026'];
const p1Moins = [R1.haussier, R1.baissier].every((x) => x.ecart_etabli && x.ecart_sens === 'moins');
const p2Neutre = [R2.haussier, R2.baissier].every((x) => !x.ecart_etabli);

// ── Quiz ────────────────────────────────────────────────────────────────────
const quiz = [
  {
    question: 'Quelle est la moyenne mobile sur 4 séances des clôtures 200, 210, 190 et 220 ?',
    options: ['200', '205', '210', '820'],
    correct: 1,
    explication: '(200 + 210 + 190 + 220) ÷ 4 = 820 ÷ 4 = 205. 820 est la somme, pas la moyenne.',
  },
  {
    question: 'Une moyenne mobile simple sur 5 séances : à partir de quelle séance existe-t-elle ?',
    options: ['Dès la première séance', 'À partir de la deuxième', 'À partir de la sixième', 'À partir de la cinquième'],
    correct: 3,
    explication: 'Il faut 5 clôtures pour la calculer : les 4 premières séances n’en ont pas. Le tableau pas à pas et l’atelier de la leçon le montrent.',
  },
  {
    question: 'Dans une moyenne exponentielle sur 5 séances, quel poids a la dernière clôture ?',
    options: ['Un tiers, soit 2 ÷ (5 + 1)', 'Un cinquième, comme dans la simple', 'La moitié de la moyenne', 'Tout le poids du calcul'],
    correct: 0,
    explication: 'k = 2 ÷ (N + 1) = 2 ÷ 6 = 1/3. Dans la moyenne simple, chaque clôture pèse 1/5 : l’exponentielle suit donc le dernier cours de plus près.',
  },
  {
    question: 'Le cours est au-dessus de sa moyenne sur 20 séances et de sa moyenne sur 50 séances. Comment le décrire ?',
    options: ['Tendance baissière', 'Achat garanti', 'Tendance haussière', 'Valeur suspendue'],
    correct: 2,
    explication: 'Un cours au-dessus de ses deux moyennes décrit un mouvement orienté à la hausse. Une description du passé, qui ne garantit rien.',
  },
  {
    question: 'Qu’appelle-t-on un croisement haussier des moyennes 20 et 50 séances ?',
    options: [
      'La moyenne 20 séances passe au-dessus de la 50',
      'Le cours passe au-dessus de sa moyenne 50 séances',
      'La moyenne 50 séances passe au-dessus de la 20',
      'Le cours dépasse son plus-haut des 50 séances',
    ],
    correct: 0,
    explication: 'Un croisement se lit entre les deux MOYENNES : la courte passe au-dessus de la longue. Le cours qui passe sa moyenne longue est une autre information, plus précoce et plus fréquente.',
  },
  {
    question: 'Pourquoi un croisement de moyennes arrive-t-il en retard ?',
    options: ['Parce que la BRVM publie ses cours tard', 'Parce que le volume est faible', 'Il n’arrive jamais en retard', 'Parce que les moyennes sont faites de cours passés'],
    correct: 3,
    explication: 'Une moyenne se calcule sur des clôtures passées : elle réagit après le mouvement, jamais avant.',
  },
  {
    question: `Sur la BRVM de 2021 à 2026, au moment d’un croisement haussier 20/50, de combien le cours avait-il déjà monté depuis son plus-bas des 50 séances précédentes (médiane) ?`,
    options: ['Il n’avait pas encore monté', 'D’environ 1 %', `D’environ ${pc(SIM.avant.haussier_mediane_pct, 0)}`, 'D’environ 50 %'],
    correct: 2,
    explication: `${pcs(SIM.avant.haussier_mediane_pct)} en médiane, sur ${ent(SIM.avant.cas_haussiers)} croisements haussiers : une bonne partie du mouvement avait déjà eu lieu.`,
  },
  {
    question: 'Combien de croisements 20/50 se sont défaits, par un croisement inverse, dans les 20 séances suivantes ?',
    options: ['Environ 1 sur 100', 'Environ 6 sur 10', 'Environ 9 sur 10', 'Environ 3 sur 10'],
    correct: 3,
    explication: `${pc(SIM.allers_retours_20.part_pct)} des croisements de moyennes simples (${ent(SIM.allers_retours_20.allers_retours)} sur ${ent(SIM.allers_retours_20.cas)}), et ${pc(SIM.allers_retours_10.part_pct)} dès les 10 séances suivantes.`,
  },
  {
    question: 'Sur la BRVM de 2021 à 2026, 20 séances après un croisement haussier 20/50, le cours était plus haut :',
    options: [
      'Bien plus souvent qu’après une séance quelconque',
      'Dans neuf cas sur dix, à peu de choses près',
      'Moins souvent qu’après une séance quelconque',
      'Dans tous les cas où la moyenne longue montait',
    ],
    correct: 2,
    explication: `${pc(SIM.apres_20.haussier.part_pct)} des cas, contre ${pc(SIM.apres_20.haussier.part_base_pct)} pour une séance quelconque. Le croisement n’a pas annoncé la suite.`,
  },
  {
    question: 'Par rapport à la moyenne simple, la moyenne exponentielle :',
    options: [
      'Croise plus tard, et se trompe moins souvent',
      'Croise plus tôt, mais se défait plus souvent',
      'Donne les mêmes croisements, aux mêmes dates',
      'Ne peut pas croiser une moyenne simple',
    ],
    correct: 1,
    explication: `Quand les deux croisent dans le même sens, l’exponentielle le fait ${ent(S.decalage_exponentielle.haussier_mediane_seances)} séances plus tôt en médiane ; mais ${pc(EXP.allers_retours_10.part_pct)} de ses croisements se défont en 10 séances, contre ${pc(SIM.allers_retours_10.part_pct)} pour la simple.`,
  },
  {
    question: 'Une valeur n’a connu aucun échange depuis 50 séances, à cours inchangé. Que vaut sa moyenne sur 20 séances ?',
    options: ['Exactement ce cours figé', 'Zéro, faute d’échange', 'La moyenne de son secteur', 'Elle ne peut plus se calculer'],
    correct: 0,
    explication: 'Vingt clôtures identiques donnent une moyenne égale à ce cours. Aucune tendance n’y est lisible : il n’y a pas eu de marché.',
  },
  {
    question: 'Le jour du détachement d’un gros dividende, le cours chute fortement. Que décrit surtout l’écart du cours à sa moyenne 20 séances ?',
    options: [
      'Un retournement de la tendance de fond',
      'Le dividende versé, plus qu’une tendance',
      'Une dégradation des comptes de la société',
      'Rien, l’écart reste inchangé ce jour-là',
    ],
    correct: 1,
    explication: `La moyenne contient encore 19 cours d’avant le détachement. Filtisac CI (FTSC), le ${dateFr(FT.seance.date)} : ${pc(Math.abs(FT.moyennes_seance.ecart_20_pct))} sous sa moyenne 20 séances, une baisse de ${ent(FT.baisse_fcfa)} FCFA du même ordre que le dividende de ${fr(FT.dividende.montant_net, 2)} FCFA net.`,
  },
  {
    question: 'Un cours vaut 110 et sa moyenne 100. Quel est son écart à la moyenne ?',
    options: ['+1 %', '+110 %', '−10 %', '+10 %'],
    correct: 3,
    explication: '(110 − 100) ÷ 100 = +10 %.',
  },
];

// ── Leçon ───────────────────────────────────────────────────────────────────
const lecon = {
  titre: 'Leçon 3 — Les moyennes mobiles : calcul, lecture et ce que valent les croisements',
  module: ancienne.module,
  categorie: 'technical',
  duree_min: 18,
  sous_titre: 'Lisser le bruit des séances pour voir la tendance : moyenne simple et exponentielle, courte et longue, leurs croisements, et ce qu’ils ont valu sur six ans de BRVM.',
  resume: `Une moyenne mobile calcule la moyenne des dernières clôtures, recalculée à chaque séance. Cette leçon la calcule pas à pas, compare la moyenne simple et l’exponentielle, justifie les durées de 20 et 50 séances par le calendrier de la BRVM, définit les croisements, puis les met à l’épreuve : un cas réel daté, et ${ent(SIM.croisements)} croisements mesurés sur toutes les actions de la BRVM depuis 2021.`,
  nouveaute: { type: 'mis_a_jour', depuis: '2026-11-24' },
  sections: [
    {
      type: 'definition',
      titre: 'Le calcul : une moyenne qui glisse',
      contenu: [
        'Une moyenne mobile calcule la moyenne des dernières clôtures, sur un nombre de séances fixé. À chaque nouvelle séance, la clôture la plus ancienne sort du calcul et la plus récente y entre : la moyenne « glisse » avec le temps, d’où son nom. La plus courante, la moyenne mobile simple, donne le même poids à chaque séance.',
        `Elle a besoin de toutes ses clôtures : sur ${N_PAS} séances, les ${N_PAS - 1} premières n’ont pas de moyenne. Le tableau ci-dessous suit le calcul séance par séance sur un exemple fictif. Observez les dernières lignes : le cours redescend de ${PAS[5]} à ${PAS[7]}, la moyenne continue de monter, de ${fr(lignesPas[4].sma)} à ${fr(lignesPas[7].sma)}. Elle reflète le retournement avec plusieurs séances de retard.`,
        'L’écart du cours à sa moyenne mesure, en pourcentage, de combien il s’en éloigne. Un écart élevé décrit un mouvement récent rapide ; il ne dit pas si ce mouvement se prolongera, ni s’il se corrigera.',
      ].join('\n'),
      formules: [
        { nom: 'Moyenne mobile simple sur N séances', expression: '(somme des N dernières clôtures) ÷ N', exemple: `(${PAS.slice(0, 5).join(' + ')}) ÷ 5 = ${fr(lignesPas[4].sma)}` },
        { nom: 'Écart du cours à sa moyenne', expression: '(cours − moyenne) ÷ moyenne', exemple: `(${PAS[4]} − ${fr(lignesPas[4].sma)}) ÷ ${fr(lignesPas[4].sma)} ≈ ${pcs(lignesPas[4].ecart)}` },
      ],
      tableau: {
        colonnes: ['Séance', 'Clôture', 'Clôtures retenues', 'Moyenne simple 5 séances', 'Écart du cours'],
        lignes: lignesPas.map((l) => [`S${l.s}`, String(l.c), l.fen ? l.fen.join(' · ') : '—', l.sma == null ? '—' : fr(l.sma), l.ecart == null ? '—' : pcs(l.ecart)]),
        note: `Valeurs d’exemple. Les ${N_PAS - 1} premières séances n’ont pas encore ${N_PAS} clôtures : aucune moyenne n’est calculée, plutôt qu’une moyenne sur moins de séances.`,
      },
      simulation: {
        type: 'moyenne_glissante',
        consigne: 'Modifiez une clôture ou la durée de la moyenne : la colonne « clôtures retenues » montre la fenêtre qui glisse, et la moyenne exponentielle suit le dernier cours de plus près que la simple.',
        clotures: PAS,
        periode: N_PAS,
      },
    },
    {
      type: 'definition',
      titre: 'Simple, pondérée, exponentielle',
      contenu: [
        'La moyenne simple donne le même poids à chaque séance : la clôture d’il y a vingt séances compte autant que celle d’hier. Deux variantes donnent plus de poids aux séances récentes.',
        'La moyenne pondérée attribue des poids décroissants en ligne droite : sur N séances, la plus récente pèse N, la précédente N − 1, et ainsi de suite jusqu’à 1. La moyenne exponentielle, elle, part d’une première moyenne simple, puis donne à chaque nouvelle clôture le poids k = 2 ÷ (N + 1) et au reste de son passé le poids restant. Les anciennes clôtures pèsent de moins en moins, sans jamais tout à fait disparaître.',
        `Un fait se vérifie au calcul : la dernière clôture pèse autant dans la pondérée que dans l’exponentielle, 2 ÷ (N + 1), soit ${pc(poidsExpo)} sur ${N20} séances contre ${pc(poidsSimple)} dans la simple. La différence est dans les anciennes : la pondérée les oublie au bout de N séances, l’exponentielle jamais tout à fait.`,
        `L’exponentielle réagit plus vite à un retournement, au prix de plus de bruit. Sur le graphique d’exemple, le cours culmine à la séance ${iSommet + 1} : l’exponentielle commence à baisser dès la séance ${baisseEma + 1}, la simple à la séance ${baisseSma + 1}. Le MACD, objet de la leçon 5, est construit sur des moyennes exponentielles de 12 et 26 séances.`,
      ].join('\n'),
      formules: [
        { nom: 'Moyenne exponentielle', expression: 'k × clôture du jour + (1 − k) × moyenne de la veille, avec k = 2 ÷ (N + 1)', exemple: `Sur 5 séances, k = 1/3 : à la séance 6 de l’exemple, ${PAS[5]} ÷ 3 + ${fr(emaPas[4])} × 2/3 ≈ ${fr(emaPas[5], 2)}` },
      ],
      tableau: {
        colonnes: ['Moyenne', 'Poids des séances', `Poids de la dernière clôture (${N20} séances)`, 'Réactivité'],
        lignes: [
          ['Simple', 'Égal pour toutes', pc(poidsSimple), 'La plus lente'],
          ['Pondérée', 'Décroissant en ligne droite, nul au-delà de N séances', pc(poidsPondere), 'Plus rapide'],
          ['Exponentielle', 'Décroissant sans jamais s’annuler', pc(poidsExpo), 'Plus rapide, la plus bruitée'],
        ],
        note: 'Le simulateur de la section suivante calcule la simple et l’exponentielle ; la pondérée est donnée pour mémoire.',
      },
      graphiques: [
        {
          type: 'line',
          titre: 'Un retournement, vu par une moyenne simple et une moyenne exponentielle sur 5 séances (exemple)',
          labels: RET.map((_, i) => `S${i + 1}`),
          series: [
            { nom: 'Clôture', valeurs: RET },
            { nom: 'Moyenne simple 5', valeurs: smaRet.map((v) => (v == null ? null : Number(v.toFixed(1)))) },
            { nom: 'Moyenne exponentielle 5', valeurs: emaRet.map((v) => (v == null ? null : Number(v.toFixed(1)))) },
          ],
          unite: 'FCFA',
          note: `Valeurs d’exemple. Le cours culmine à ${Math.max(...RET)} à la séance ${iSommet + 1} ; l’exponentielle baisse dès la séance ${baisseEma + 1}, la simple à partir de la séance ${baisseSma + 1}. Aucune des deux ne l’annonce : toutes deux le constatent.`,
          reel: false,
        },
      ],
    },
    {
      type: 'importance',
      titre: 'Moyenne courte et moyenne longue : pourquoi 20 et 50 ?',
      contenu: [
        `Le nombre de séances change ce que la moyenne décrit. La BRVM a tenu entre ${ent(seancesMin)} et ${ent(seancesMax)} séances par an de 2021 à 2025, soit environ ${ent(Math.round(parMois))} par mois. Une moyenne sur 20 séances couvre donc à peu près un mois de cotation ; sur 50 séances, deux mois et demi ; sur 200 séances, plus de neuf mois.`,
        'Ces durées sont des conventions, pas des lois : rien ne rend 20 et 50 meilleurs que 10 et 30. Elles ont l’avantage d’être partagées, donc comparables d’un outil à l’autre. Une moyenne courte suit le cours de près et réagit vite ; une moyenne longue réagit lentement et décrit la tendance de fond.',
        'Une moyenne demande autant de cotations que de séances. Bridge Bank Group Côte d’Ivoire (BBGC), admise à la cote le 24 septembre 2026, n’en comptait que 44 au 24 novembre : ni sa moyenne 50 séances ni sa moyenne 200 séances n’existent encore.',
      ].join('\n'),
      tableau: {
        colonnes: ['Moyenne', 'Séances', 'Équivalent à la BRVM', 'Ce qu’elle décrit'],
        lignes: [
          ['Courte', '20', `≈ ${fr(20 / parMois)} mois`, 'Le mouvement récent'],
          ['Longue', '50', `≈ ${fr(50 / parMois)} mois`, 'La tendance de fond'],
          ['Très longue', '200', `≈ ${fr(200 / parMois)} mois`, 'La tendance de plusieurs trimestres'],
        ],
        note: `Équivalences calculées sur ${fr(seancesMoy)} séances par an en moyenne de 2021 à 2025 (${annees.map(([a, n]) => `${a} : ${n}`).join(' ; ')}). Source : calendrier des séances en base WESTBOURSE.`,
      },
      stats: [
        { label: 'Séances par an, 2021-2025', valeur: `${ent(seancesMin)} à ${ent(seancesMax)}`, detail: `soit environ ${ent(Math.round(parMois))} par mois` },
        { label: '20 séances', valeur: `≈ ${fr(20 / parMois)} mois`, detail: 'la moyenne courte de la leçon' },
        { label: '50 séances', valeur: `≈ ${fr(50 / parMois)} mois`, detail: 'la moyenne longue de la leçon' },
      ],
      simulation: {
        type: 'technique',
        indicateur: 'moyennes',
        consigne: 'Raccourcissez ou allongez les moyennes sur une série réelle, et basculez entre moyenne simple et exponentielle : plus elles sont courtes ou réactives, plus elles suivent le cours de près, et plus elles se croisent.',
        codes: ['SNTS', 'ORAC', 'SGBC', 'ETIT', 'SIBC'],
        courte: 20,
        longue: 50,
      },
    },
    {
      type: 'definition',
      titre: 'Lire le cours face à ses moyennes, et leurs croisements',
      contenu: [
        'On lit d’abord la position du cours face aux deux moyennes. Au-dessus des deux, le mouvement récent et la tendance de fond vont ensemble vers le haut. En dessous des deux, ils vont ensemble vers le bas. Entre les deux, court terme et fond divergent : c’est souvent une phase d’hésitation.',
        'On lit ensuite la pente de la moyenne longue. Une moyenne longue qui monte régulièrement décrit une tendance installée ; une moyenne plate, un marché sans direction de fond. Les manuels ajoutent que les croisements y perdent leur sens ; la mesure présentée plus bas nuance ce conseil pour la BRVM.',
        'Un croisement se lit entre les deux moyennes, pas entre le cours et l’une d’elles. Il est haussier quand la moyenne courte passe au-dessus de la longue, baissier quand elle passe en dessous. En anglais, on parle de « golden cross » et de « death cross » ; ces mots désignent d’abord le croisement des moyennes 50 et 200 séances. Un croisement est une conséquence du mouvement des cours, jamais sa cause.',
      ].join('\n'),
      tableau: {
        colonnes: ['Ce que l’on observe', 'Ce que cela décrit'],
        lignes: [
          ['Cours au-dessus des deux moyennes', 'Mouvement récent et tendance de fond orientés à la hausse'],
          ['Cours sous les deux moyennes', 'Mouvement récent et tendance de fond orientés à la baisse'],
          ['Cours entre les deux', 'Court terme et fond divergent : hésitation'],
          ['Moyenne courte qui passe au-dessus de la longue', 'Croisement haussier : la hausse récente a duré assez pour remonter la moyenne courte'],
          ['Moyenne courte qui passe sous la longue', 'Croisement baissier : la baisse récente a duré assez pour abaisser la moyenne courte'],
        ],
        note: 'Des descriptions du passé. Aucune ligne de ce tableau n’est une raison d’acheter ou de vendre.',
      },
      encadres: [
        { ton: 'info', titre: 'Deux croisements à ne pas confondre', texte: 'Le cours qui passe sa moyenne longue arrive tôt et souvent. Les deux moyennes qui se croisent arrivent plus tard et plus rarement, car la moyenne courte elle-même doit avoir changé de côté. Le simulateur donne les deux dates.' },
      ],
    },
    {
      type: 'cas',
      titre: 'Sur la BRVM : le cours face à ses moyennes',
      reel: true,
      contenu: [
        'Les moyennes sur 20 et 50 séances de cinq valeurs, calculées à l’ouverture de la leçon sur les clôtures réelles. Sous chaque moyenne figure l’écart du cours à cette moyenne.',
        'Pour chaque ligne, faites la lecture en deux temps vue plus haut : où se situe le cours face à ses deux moyennes, et quel écart les sépare ? Un cours très éloigné de sa moyenne courte décrit un mouvement récent rapide. Rien ne dit qu’il se prolongera, ni qu’il se corrigera.',
        'La colonne RSI relève de la leçon suivante. Les deux outils répondent à deux questions différentes : les moyennes décrivent la direction du mouvement, le RSI son intensité récente.',
      ].join('\n'),
      donnees_reelles: { vue: 'technique', codes: ['SNTS', 'ORAC', 'SGBC', 'ETIT', 'SIBC'] },
    },
    {
      type: 'cas',
      titre: `Un cas réel : Coris Bank International Burkina Faso, novembre 2026`,
      reel: true,
      contenu: [
        `Du ${cbDebut.date.slice(0, 7) === cbFin.date.slice(0, 7) ? Number(cbDebut.date.slice(8, 10)) : dateFr(cbDebut.date)} au ${dateFr(cbFin.date)}, le cours de Coris Bank International Burkina Faso (CBIBF) passe de ${ent(cbDebut.cloture)} à ${ent(cbFin.cloture)} FCFA, soit ${pcs(cbBaisseTotale)}. Aucun détachement de dividende ne l’explique : celui de l’exercice 2025 a eu lieu le 18 juin 2026. Les échanges augmentent, de ${ent(cbVolDebut)} titres le ${dateFr(cbDebut.date)} à ${ent(cbVolMax.volume)} le ${dateFr(cbVolMax.date)}.`,
        `Le ${dateFr(cbHaussier.date)}, alors que le cours baisse depuis ${baissesAvantH} séances, la moyenne 20 séances passe au-dessus de la 50 : un croisement haussier. Ce jour-là, la moyenne courte baisse à peine, de ${ent(cbVeilleH.moyenne_20)} à ${ent(cbH.moyenne_20)} FCFA, quand la longue baisse davantage, de ${ent(cbVeilleH.moyenne_50)} à ${ent(cbH.moyenne_50)} : c’est ce décalage qui les fait se croiser, pas un regain d’acheteurs.`,
        `Le ${dateFr(cbBaissier.date)}, la moyenne courte repasse sous la longue : un croisement baissier. Le cours vaut alors ${ent(cbB.cloture)} FCFA, déjà ${pc(Math.abs(cbBaisseAuCroisement))} sous son niveau du ${dateFr(cbDebut.date)}. Les deux croisements sont arrivés après le mouvement ; le premier l’a même contredit.`,
      ].join('\n'),
      tableau: {
        colonnes: ['Séance', 'Clôture (FCFA)', 'Moyenne 20', 'Moyenne 50', 'Titres échangés', 'Croisement'],
        lignes: CB.seances.map((x) => {
          const cr = CB.croisements.find((c) => c.date === x.date);
          return [jjmm(x.date), ent(x.cloture), ent(x.moyenne_20), ent(x.moyenne_50), ent(x.volume), cr ? (cr.sens === 'haussier' ? 'Haussier' : 'Baissier') : ''];
        }),
        note: `Clôtures et titres échangés publiés par la BRVM, séances du ${jjmm(CB.seances[0].date)} au ${jjmm(cbFin.date)}/2026 ; moyennes simples calculées par WESTBOURSE (base lue le 24/11/2026). Un cas daté : le simulateur ci-dessous montre la situation d’aujourd’hui.`,
      },
      simulation: {
        type: 'technique',
        indicateur: 'moyennes',
        consigne: 'La même valeur, en direct : la lecture donne la date du dernier croisement des deux moyennes et celle du dernier passage du cours sous ou au-dessus de sa moyenne longue.',
        codes: ['CBIBF'],
        courte: 20,
        longue: 50,
      },
      donnees_reelles: { vue: 'technique', codes: ['CBIBF'] },
    },
    {
      type: 'importance',
      titre: 'Ce que valent les croisements à la BRVM',
      contenu: [
        `Nous avons repéré tous les croisements des moyennes 20 et 50 séances sur les clôtures de toutes les actions de la BRVM, du ${dateFr(S.periode.debut)} au ${dateFr(S.periode.fin)} : ${ent(SIM.croisements)} croisements de moyennes simples, ${ent(SIM.haussiers)} haussiers et ${ent(SIM.baissiers)} baissiers, soit environ ${ent(Math.round(SIM.par_valeur_et_par_an))} par valeur et par an. Pour chacun, une question : 20 séances plus tard, le cours avait-il bougé dans le sens du croisement ?`,
        `Le point de comparaison est une séance quelconque : sur toutes les séances, le cours était plus haut 20 séances plus tard dans ${pc(B.part_hausse_pct)} des cas, plus bas dans ${pc(B.part_baisse_pct)}. Après un croisement haussier, il était plus haut dans ${pc(SIM.apres_20.haussier.part_pct)} des cas ; après un croisement baissier, plus bas dans ${pc(SIM.apres_20.baissier.part_pct)}. ${nettementMieux === 0 ? 'Aucun croisement n’a fait nettement mieux qu’une séance quelconque' : `${nettementMieux} comparaison(s) font mieux qu’une séance quelconque`}, ni avec des moyennes simples ni avec des exponentielles.`,
        `Le résultat tient dans tous les découpages essayés : croisements isolés, ou deux sous-périodes comparées chacune à ses propres séances. ${p1Moins ? `De 2021 à 2023, les croisements ont même fait nettement moins bien qu’une séance quelconque, dans les deux sens. ` : ''}${p2Neutre ? 'Depuis 2024, ni mieux ni moins bien. ' : ''}Le retard, lui, se chiffre : au croisement haussier, le cours avait déjà monté de ${pc(SIM.avant.haussier_mediane_pct)} depuis son plus-bas des 50 séances précédentes (médiane) ; au croisement baissier, il avait déjà perdu ${pc(Math.abs(SIM.avant.baissier_mediane_pct))} depuis son plus-haut.`,
        `Cette mesure a ses limites. Les cas ne sont pas indépendants : quand le marché se retourne, plusieurs valeurs croisent la même semaine, ce qui rend les intervalles trop étroits. Retenez l’ordre de grandeur, pas la décimale. Ce n’est pas non plus un test de stratégie : ni frais, ni dividendes. Elle suffit à une conclusion : à la BRVM, un croisement de moyennes décrit un mouvement passé ; il n’a pas annoncé la suite.`,
      ].join('\n'),
      stats: [
        { label: 'Croisements mesurés', valeur: ent(SIM.croisements), detail: `moyennes simples 20 et 50, toutes actions, 2021-2026` },
        { label: 'Défaits dans les 20 séances', valeur: pc(SIM.allers_retours_20.part_pct), detail: `${pc(SIM.allers_retours_10.part_pct)} dès les 10 séances` },
        { label: 'Déjà parcouru au croisement haussier', valeur: pcs(SIM.avant.haussier_mediane_pct), detail: 'depuis le plus-bas des 50 séances, médiane' },
        { label: 'Hausse 20 séances après un croisement haussier', valeur: pc(SIM.apres_20.haussier.part_pct), detail: `contre ${pc(B.part_hausse_pct)} après une séance quelconque` },
      ],
      tableau: {
        colonnes: ['Croisement', 'Cas mesurés', 'Sens attendu', 'Part, 20 séances après', 'Séance quelconque', 'Intervalle à 95 %', 'Verdict'],
        lignes: [
          ['Haussier, moyennes simples', SIM.apres_20.haussier, 'Hausse'],
          ['Baissier, moyennes simples', SIM.apres_20.baissier, 'Baisse'],
          ['Haussier, moyennes exponentielles', EXP.apres_20.haussier, 'Hausse'],
          ['Baissier, moyennes exponentielles', EXP.apres_20.baissier, 'Baisse'],
        ].map(([lib, x, sens]) => [lib, ent(x.cas), sens, pc(x.part_pct), pc(x.part_base_pct), `${fr(x.ic95_pct[0])} à ${fr(x.ic95_pct[1])} %`, verdict(x)]),
        note: `Part des cas où le cours, 20 séances après le croisement, était dans le sens du croisement (plus haut après un haussier, plus bas après un baissier). Intervalle de Wilson à 95 %, au moins ${S.parametres.min_cas} cas. ${SRC}`,
      },
      tableaux: [
        {
          colonnes: ['Découpage (moyennes simples)', 'Haussier : plus haut 20 séances après', 'Baissier : plus bas 20 séances après'],
          lignes: [
            ['Tous les croisements', cellule(SIM.apres_20.haussier), cellule(SIM.apres_20.baissier)],
            ['Croisements isolés (aucun autre dans les 20 séances avant)', cellule(SIM.robustesse.isoles.haussier), cellule(SIM.robustesse.isoles.baissier)],
            ['2021 à 2023', cellule(R1.haussier), cellule(R1.baissier)],
            ['2024 à 2026', cellule(R2.haussier), cellule(R2.baissier)],
          ],
          note: 'Chaque sous-période est comparée à ses propres séances quelconques. « Écart non établi » : l’intervalle à 95 % contient la part d’une séance quelconque.',
        },
      ],
      graphiques: [
        {
          type: 'bar',
          titre: 'Après le croisement, le cours est-il allé dans son sens plus souvent ? (%, 20 séances après)',
          labels: ['Haussier, simple', 'Baissier, simple', 'Haussier, exponentielle', 'Baissier, exponentielle'],
          series: [
            { nom: 'Après le croisement', valeurs: [SIM.apres_20.haussier, SIM.apres_20.baissier, EXP.apres_20.haussier, EXP.apres_20.baissier].map((x) => x.part_pct) },
            { nom: 'Séance quelconque', valeurs: [SIM.apres_20.haussier, SIM.apres_20.baissier, EXP.apres_20.haussier, EXP.apres_20.baissier].map((x) => x.part_base_pct) },
          ],
          unite: '%',
          note: `Dans chaque paire, la barre « après le croisement » n’est jamais au-dessus de celle d’une séance quelconque. ${SRC}`,
          reel: true,
        },
      ],
      encadres: [
        { ton: 'cle', titre: 'Ce que cela veut dire pour vous', texte: 'Une moyenne mobile reste un bon outil de lecture : elle situe le cours dans sa tendance et évite de confondre une séance agitée avec un retournement. Un croisement, lui, ne justifie pas à lui seul un achat ou une vente : la grille de décision de la leçon 0 demande toujours le contexte, les niveaux, le volume et un niveau d’invalidation.' },
      ],
    },
    {
      type: 'piege',
      titre: 'Les pièges des moyennes mobiles à la BRVM',
      contenu: [
        'Une moyenne mobile est faite de cours passés, et la BRVM ajoute ses propres pièges : des valeurs qui ne s’échangent pas, des dividendes qui font chuter le cours en une séance.',
        `Le conseil des manuels sur la pente plate se vérifie mal ici pour les moyennes simples : les croisements survenus quand la moyenne longue était plate se sont défaits dans ${pc(SIM.selon_pente.plate.part_pct)} des cas en 20 séances, contre ${pc(SIM.selon_pente.orientee.part_pct)} quand elle était orientée. Avec des moyennes exponentielles, l’écart existe : ${pc(EXP.selon_pente.plate.part_pct)} contre ${pc(EXP.selon_pente.orientee.part_pct)}.`,
      ].join('\n'),
      points: [
        { titre: 'Le retard inévitable', detail: `Au croisement haussier, le cours avait déjà monté de ${pc(SIM.avant.haussier_mediane_pct)} depuis son plus-bas des 50 séances (médiane, BRVM 2021-2026).`, verifier: 'L’écart du cours à sa moyenne au moment du croisement : plus il est grand, plus le mouvement a déjà eu lieu.' },
        { titre: 'Les allers-retours', detail: `${pc(SIM.allers_retours_20.part_pct)} des croisements de moyennes simples se sont défaits dans les 20 séances, ${pc(EXP.allers_retours_20.part_pct)} pour les exponentielles, plus réactives.`, verifier: 'Le croisement précédent : s’il date de quelques séances, le suivant a toutes les chances d’être un aller-retour de plus.' },
        { titre: 'Les séances sans échange', detail: `Du ${dateFr(L.du)} au ${dateFr(L.au)}, ${figees.length === 2 ? 'deux valeurs' : `${figees.length} valeurs`}, ${figees.map((x) => x.code).join(' et ')}, n’ont connu aucun échange sur ${L.fenetre} séances : leur cours est resté figé, et leurs moyennes valent exactement ce cours.`, verifier: 'Les volumes récents sur la fiche de la valeur, et sa classe de liquidité.' },
        { titre: 'Le détachement d’un dividende', detail: `Le ${dateFr(FT.seance.date)}, Filtisac CI (FTSC) passe de ${ent(FT.veille.cloture)} à ${ent(FT.seance.cloture)} FCFA, quelques jours avant le paiement d’un dividende de ${fr(FT.dividende.montant_net, 2)} FCFA net : le cours finit ${pc(Math.abs(FT.moyennes_seance.ecart_20_pct))} sous sa moyenne 20 séances, qui contient encore 19 cours d’avant. L’écart décrit le dividende, pas une tendance.`, verifier: 'Le calendrier des dividendes avant de lire un écart soudain.' },
        { titre: 'La moyenne n’est pas un support', detail: 'Un cours qui revient vers sa moyenne n’y rebondit pas mécaniquement : la moyenne est un calcul, pas un niveau où des acheteurs attendent.', verifier: 'Les volumes et le carnet d’ordres, qui montrent où se trouvent réellement les acheteurs et les vendeurs.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'L’essentiel',
      contenu: 'Une moyenne mobile décrit, elle ne prévoit pas. C’est un outil de lecture, qui rend une tendance plus visible et évite de confondre une séance agitée avec un retournement. Ses croisements arrivent après le mouvement ; sur six ans de BRVM, ils n’ont pas annoncé la suite.',
      points: [
        { titre: 'Simple ou exponentielle', detail: 'La simple pèse chaque séance pareil ; l’exponentielle donne 2 ÷ (N + 1) à la dernière, réagit plus vite, se trompe plus souvent.' },
        { titre: '20 et 50 séances', detail: 'Environ un mois et deux mois et demi de cotation à la BRVM : des conventions, pas des lois.' },
        { titre: 'Position, pente, écart', detail: 'Où est le cours face à ses moyennes, la moyenne longue monte-t-elle, de combien le cours s’en éloigne-t-il.' },
        { titre: 'Les croisements, mesurés', detail: 'En retard par construction, défaits trois fois sur dix en 20 séances, sans avantage établi sur une séance quelconque.' },
        { titre: 'Les pièges de la BRVM', detail: 'Séances sans échange, détachements de dividende : vérifier avant de lire un écart.' },
      ],
    },
  ],
  charts: [],
  quiz,
  qcm: quiz[0],
  liens: [
    ...ancienne.liens,
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
console.log(`écrit l03-moyennes-mobiles.json — ${lecon.sections.length} sections, ${quiz.length} questions, ${total} caractères ; bonne réponse la plus longue ${plusLongues}/${quiz.length} ; positions A-D ${positions.join('/')}`);
if (longs.length) { console.error('paragraphes trop longs :', longs); process.exitCode = 1; }
if (/NaN|undefined|Infinity/.test(JSON.stringify(lecon))) { console.error('valeur non calculée'); process.exitCode = 1; }
