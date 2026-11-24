/**
 * Enrichit les 7 leçons des Modules 2 et 3 (Niveau 1 : leçons 5 à 11) à partir de
 * l'instantané réel figé `sources/niveau1-modules2-3-2026-11-24.json`, en
 * préservant tous les simulateurs, `donnees_reelles` et questions de quiz
 * existantes, puis génère `supabase/migrations/0269_academy_niveau1_modules2_3.sql`.
 *
 * Exécution : node frontend/scripts/academy-niveau1-modules2-3.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CONTENUS = path.join(ROOT, 'frontend', 'lib', 'academy', 'contenus');
const SOURCE_PATH = path.join(CONTENUS, 'sources', 'niveau1-modules2-3-2026-11-24.json');
const MIGRATION_PATH = path.join(ROOT, 'supabase', 'migrations', '0269_academy_niveau1_modules2_3.sql');

const src = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
const ent = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const fr2 = (n) => Number(n).toFixed(2).replace('.', ',');
const fr1 = (n) => Number(n).toFixed(1).replace('.', ',');

const MODULE_2 = 'Module 2 — Dividendes et investissement pratique';
const MODULE_3 = 'Module 3 — Stratégies et compte';
const NOUVEAUTE = { type: 'mis_a_jour', depuis: '2026-11-24' };

const readLesson = (file) => JSON.parse(fs.readFileSync(path.join(CONTENUS, file), 'utf8'));
const writeLesson = (file, data) => fs.writeFileSync(path.join(CONTENUS, file), JSON.stringify(data, null, 2) + '\n', 'utf8');

const divs = src.dividendes_2025_brvm_calendrier;
const topDivs = divs.top_rendements_nets;
const stbc = topDivs.find((d) => d.code === 'STBC');
const abjc = topDivs.find((d) => d.code === 'ABJC');
const sgbc = topDivs.find((d) => d.code === 'SGBC');
const palc = topDivs.find((d) => d.code === 'PALC');
const sphc = topDivs.find((d) => d.code === 'SPHC');
const boab = topDivs.find((d) => d.code === 'BOAB');
const neic = topDivs.find((d) => d.code === 'NEIC');

// ── LEÇON 5 — Dividendes (Module 2, pos 4) ───────────────────────────────────
const l5 = readLesson('lecon5-dividendes.json');
l5.module = MODULE_2;
l5.nouveaute = NOUVEAUTE;
l5.duree_min = 12;
l5.charts = [];
delete l5.chart;

// Conserve les 8 sections existantes (assertion lecon5.test.ts : length === 8) en enrichissant leur contenu et leurs graphiques.
l5.sections[0].contenu = [
  'Quand une société réalise un bénéfice, son assemblée générale décide d’en verser une partie aux actionnaires : c’est le dividende.',
  'Le reste est conservé en réserves pour financer l’activité ou rembourser la dette. Une société bénéficiaire peut aussi choisir de ne rien distribuer.',
  'À la BRVM, la quasi-totalité des sociétés versent un dividende annuel unique, voté entre avril et juillet après la clôture des comptes.',
  'En 2026, le calendrier officiel de la BRVM recense 34 valeurs ayant daté et payé un dividende au titre de l’exercice 2025.',
].join('\n');

l5.sections[1].contenu = [
  'Un investisseur détient 300 actions. La société verse 1 000 FCFA par action, et l’action cote 10 000 FCFA.',
  'Il perçoit 300 000 FCFA bruts dans l’année, soit un rendement brut de 10 % au cours de 10 000 FCFA. Ces chiffres sont pédagogiques.',
  `Sur le marché réel au 24 novembre 2026, les meilleurs rendements nets datés atteignent ${fr2(stbc.rdt_net_pct)} % sur STBC (${fr2(stbc.div_net)} FCFA nets pour ${ent(stbc.cours)} FCFA) et ${fr2(abjc.rdt_net_pct)} % sur ABJC (${fr2(abjc.div_net)} FCFA nets pour ${ent(abjc.cours)} FCFA).`,
  'Le tableau ci-dessous applique le calcul réel à quatre valeurs liquides pour 300 actions, en montants nets d’impôt tels que versés.',
].join('\n');
l5.sections[1].graphiques = [
  {
    type: 'bar',
    titre: 'Meilleurs rendements nets de dividende à la BRVM (ex. 2025, en %)',
    reel: true,
    note: 'Sources : Calendrier officiel des dividendes BRVM (ex. 2025) et clôtures du 24/11/2026. Montants nets d’IRVM.',
    labels: ['STBC', 'NEIC', 'ABJC', 'BOAB', 'SGBC', 'PALC', 'SPHC'],
    valeurs: [stbc.rdt_net_pct, neic.rdt_net_pct, abjc.rdt_net_pct, boab.rdt_net_pct, sgbc.rdt_net_pct, palc.rdt_net_pct, sphc.rdt_net_pct],
  },
];

l5.sections[3].contenu = [
  'Un dividende élevé n’est pas forcément un bon dividende. Cinq questions permettent d’en juger avant d’acheter.',
  'Regardez d’abord la trajectoire sur cinq ans : SGBC a porté son dividende net de 1 005 FCFA (2021) à 2 293,28 FCFA (2025) et SNTS de 140 à 174 FCFA.',
  'À l’inverse, SPHC est passée de 365,40 FCFA (2021) à 65 FCFA (2023) avant de remonter à 430,32 FCFA (2025) : un dividende cyclique suit la matière première.',
  'Le tableau ci-dessous confronte quatre historiques réels sur cinq exercices pour distinguer régularité et cyclicité.',
].join('\n');
l5.sections[3].graphiques = [
  {
    type: 'line',
    titre: 'Dividende net versé sur 5 ans : régularité (SNTS) vs cyclicité (SPHC)',
    reel: true,
    note: 'Sources : BRVM (calendrier officiel 2025) et historiques 2021–2024 (SNTS ajusté du fractionnement par 10).',
    labels: divs.historique_5_ans_fcfa_net.SNTS.map((x) => String(x.exercice)),
    valeurs: [],
    series: [
      { nom: 'SNTS (FCFA net)', valeurs: divs.historique_5_ans_fcfa_net.SNTS.map((x) => x.net), type: 'line', axe: 'gauche' },
      { nom: 'SPHC (FCFA net)', valeurs: divs.historique_5_ans_fcfa_net.SPHC.map((x) => x.net), type: 'line', axe: 'gauche' },
    ],
  },
];

l5.sections[4].contenu = [
  'Trois dates encadrent chaque dividende. Pour l’investisseur, la plus décisive est la date de détachement (ex-date).',
  'Il faut détenir l’action la veille du détachement pour percevoir le dividende. Acheter le jour même ou après ne donne aucun droit au coupon en cours.',
  `En pratique, le paiement intervient 1 à 3 jours ouvrés après : STBC a détaché le ${stbc.ex_date} et payé le ${stbc.payment_date} ; ABJC a détaché le ${abjc.ex_date} et payé le ${abjc.payment_date}.`,
].join('\n');

l5.sections[5].contenu = [
  'Cinq erreurs reviennent souvent chez les investisseurs qui découvrent les dividendes, notamment oublier l’impôt retenu à la source (IRVM).',
  'En Côte d’Ivoire, l’IRVM sur dividendes cotés est de 12 % pour les personnes physiques depuis 2025 (10 % pour les personnes morales).',
  `Exemple réel : sur STBC, le dividende brut voté est de ${ent(stbc.div_brut)} FCFA, mais l’actionnaire particulier perçoit ${fr2(stbc.div_net)} FCFA nets après 12 % d’IRVM.`,
].join('\n');

l5.sections[6].contenu = [
  'Voici les ordres de grandeur pour viser un revenu annuel de dividendes, selon trois taux de rendement hypothétiques.',
  'Ces chiffres reposent sur des hypothèses constantes (aucune baisse du dividende ni frais de courtage inclus) : ils donnent un cap, pas une promesse.',
  'Pour réduire l’effort d’épargne, le réinvestissement automatique des premiers coupons permet de bâtir progressivement le nombre d’actions génératrices de revenus.',
].join('\n');

l5.sections[7].contenu = [
  'Le dividende rémunère la patience, à condition de ne jamais sacrifier la qualité de l’entreprise pour un taux facial élevé.',
  'Vérifiez toujours : la base nette d’impôt, la régularité sur 5 ans, le taux de distribution du bénéfice et la liquidité du titre avant d’entrer.',
].join('\n');

l5.quiz = [
  ...l5.quiz.slice(0, 6),
  {
    question: 'En Côte d’Ivoire depuis 2025, quel est le taux d’IRVM retenu sur les dividendes d’actions cotées pour un particulier ?',
    options: ['5 %', '10 %', '12 %', '25 %'],
    correct: 2,
    explication: 'Depuis la loi de finances 2025, l’IRVM en Côte d’Ivoire est de 12 % pour les personnes physiques (10 % pour les personnes morales).',
  },
  {
    question: 'Un dividende brut de 1 940 FCFA soumis à 12 % d’IRVM donne quel montant net perçu par action ?',
    options: ['1 707,20 FCFA', '1 746,00 FCFA', '1 820,00 FCFA', '1 928,00 FCFA'],
    correct: 0,
    explication: '1 940 × (1 − 0,12) = 1 707,20 FCFA nets (cas réel STBC sur l’exercice 2025).',
  },
  {
    question: 'Que montre la comparaison entre SNTS (140 → 174 FCFA) et SPHC (365 → 65 → 430 FCFA) sur 5 ans ?',
    options: [
      'Tous les dividendes progressent chaque année',
      'Un dividende cyclique peut baisser fortement si l’activité recule',
      'Les actions agricoles versent des dividendes fixes',
      'Le dividende ne dépend pas du bénéfice',
    ],
    correct: 1,
    explication: 'Le dividende suit la capacité bénéficiaire : il est stable ou croissant sur les valeurs défensives, et volatil sur les valeurs cycliques.',
  },
  {
    question: 'Que se passe-t-il techniquement sur le cours le matin du détachement d’un dividende ?',
    options: [
      'Le cours double automatiquement',
      'Le cours est ajusté à la baisse du montant du dividende',
      'La cotation est suspendue pendant un mois',
      'Le dividende est annulé pour les anciens actionnaires',
    ],
    correct: 1,
    explication: 'Le jour du détachement, le cours de référence est ajusté du dividende détaché : toucher le dividende la veille n’est donc pas un gain gratuit.',
  },
];
l5.qcm = l5.quiz[0];

// ── LEÇON 6 — Compte et ordre (Module 3, pos 5) ──────────────────────────────
const l6 = readLesson('lecon6-compte-ordre.json');
l6.module = MODULE_3;
l6.nouveaute = NOUVEAUTE;
l6.duree_min = 10;
l6.charts = [];
delete l6.chart;

l6.sections[0].contenu = [
  'Un particulier ne peut pas acheter d’actions directement sur la BRVM : il doit ouvrir un compte-titres auprès d’une SGI (Société de Gestion et d’Intermédiation) agréée par l’AMF-UMOA (ex-CREPMF).',
  `Fin 2026, l’annuaire officiel recense ${src.sgi.nb_sgi_annuaire} SGI réparties dans 7 pays de l’UEMOA : ${src.sgi.repartition_pays.CI} en Côte d’Ivoire, ${src.sgi.repartition_pays.SN} au Sénégal, ${src.sgi.repartition_pays.BJ} au Bénin, ${src.sgi.repartition_pays.BF} au Burkina Faso, ${src.sgi.repartition_pays.ML} au Mali, ${src.sgi.repartition_pays.NE} au Niger et ${src.sgi.repartition_pays.TG} au Togo.`,
  'Chaque compte-titres est adossé à un compte espèces dédié qui reçoit vos dépôts, règle vos achats et encaisse automatiquement vos dividendes nets.',
].join('\n');
l6.sections[0].graphiques = [
  {
    type: 'bar',
    titre: 'Répartition des 40 SGI agréées par pays de l’UEMOA',
    reel: true,
    note: 'Sources : Annuaire officiel des SGI BRVM / AMF-UMOA (2026).',
    labels: ['Côte d’Ivoire', 'Sénégal', 'Bénin', 'Burkina Faso', 'Mali', 'Niger', 'Togo'],
    valeurs: [
      src.sgi.repartition_pays.CI,
      src.sgi.repartition_pays.SN,
      src.sgi.repartition_pays.BJ,
      src.sgi.repartition_pays.BF,
      src.sgi.repartition_pays.ML,
      src.sgi.repartition_pays.NE,
      src.sgi.repartition_pays.TG,
    ],
  },
];

l6.sections[1].contenu = [
  'Les documents demandés sont standards : pièce d’identité en cours de validité, justificatif de domicile, photo, RIB ou numéro Mobile Money et fiche de connaissance client (KYC).',
  `Sur ${src.sgi.nb_grilles_frais} grilles tarifaires publiées, le dépôt minimum varie fortement d’une SGI à l’autre : de 0 FCFA ou 50 000 FCFA jusqu’à 2 000 000 FCFA selon le positionnement.`,
  'L’ouverture prend généralement quelques jours ouvrés, parfois entièrement en ligne selon la SGI choisie.',
].join('\n');

l6.sections[2].contenu = [
  'Avant de choisir une SGI, comparez quatre postes de frais : la commission de courtage par ordre, les droits de garde annuels, la tenue de compte et les frais de retrait ou de virement.',
  'Sur les grilles homologuées en base, le courtage se situe typiquement entre 0,65 % et 1 % par transaction (parfois avec un minimum de perception de 1 000 FCFA).',
  'Les droits de garde annuels vont souvent de 0,25 % à 0,50 % du portefeuille, et la tenue de compte est nulle chez de nombreuses SGI (ou jusqu’à 12 500 FCFA/an ailleurs).',
].join('\n');

l6.sections[3].contenu = [
  'Passer un ordre revient à donner trois instructions précises : le sens (achat ou vente), la quantité de titres et le type de prix.',
  'Avec un ordre à cours limité, vous fixez le prix maximum d’achat (ou minimum de vente). Avec un ordre au mieux, vous acceptez le prix disponible dans le carnet.',
  'La leçon 7 y ajoute la durée de validité (ordre « jour » ou « à révocation ») et les conditions d’exécution face au carnet d’ordres.',
].join('\n');

l6.sections[4].contenu = [
  'Sur le Bulletin Officiel de la Cote du 23 novembre 2026, le carnet d’ORAC affichait 51 titres à l’achat à 19 000 FCFA face à 64 titres à la vente à 19 005 FCFA : un écart très serré de 5 FCFA.',
  'Sur NSBC le même jour, 50 titres étaient demandés à 14 950 FCFA face à 344 titres offerts à 15 000 FCFA.',
  'Sur SNTS, 27 691 titres attendaient à l’achat à 3 900 FCFA contre 20 titres offerts à 3 990 FCFA : un ordre au mieux trop gros aurait payé plus cher.',
].join('\n');

l6.sections[5].contenu = [
  'Deux réflexes protègent vos premiers ordres : vérifiez toujours le montant total frais inclus, et privilégiez l’ordre à cours limité sur les titres peu liquides.',
  'Commencez par un petit ordre sur une valeur liquide pour tester le parcours complet de votre SGI (dépôt, exécution, avis d’opéré).',
].join('\n');

l6.quiz = [
  ...l6.quiz.slice(0, 5),
  {
    question: 'Dans les grilles tarifaires des SGI de la BRVM, dans quelle fourchette se situe généralement la commission de courtage ?',
    options: ['0,01 % à 0,05 %', '0,65 % à 1 % par ordre', '5 % à 10 % par ordre', 'Toujours gratuite'],
    correct: 1,
    explication: 'Sur les grilles SGI homologuées, le courtage se situe typiquement entre 0,65 % et 1 % par transaction (avec parfois un minimum de perception).',
  },
  {
    question: 'Que sont les « droits de garde » prélevés par une SGI ?',
    options: [
      'Une amende en cas de perte',
      'Des frais annuels pour la conservation de vos titres en portefeuille',
      'La taxe sur les dividendes',
      'Le prix d’un ordre annulé',
    ],
    correct: 1,
    explication: 'Les droits de garde rémunèrent la conservation et le suivi administratif de vos titres (souvent 0,25 % à 0,50 % par an).',
  },
  {
    question: 'Pourquoi l’ordre « à cours limité » est-il recommandé face à un carnet peu profond ?',
    options: [
      'Il garantit une hausse du titre',
      'Il supprime les frais de courtage',
      'Il vous protège contre une exécution à un prix nettement plus élevé que prévu',
      'Il évite de payer l’IRVM',
    ],
    correct: 2,
    explication: 'L’ordre à cours limité fixe un plafond de prix : vous ne payez jamais plus cher que votre limite, même si les vendeurs sont rares.',
  },
  {
    question: 'À quoi sert le compte espèces associé à votre compte-titres chez la SGI ?',
    options: [
      'À détenir uniquement des devises étrangères',
      'À déposer vos fonds, régler vos ordres et encaisser vos dividendes',
      'À emprunter automatiquement à la BCEAO',
      'À bloquer vos actions pendant 10 ans',
    ],
    correct: 1,
    explication: 'Toute opération de trésorerie (dépôt, achat, vente, coupon, dividende) transite par votre compte espèces SGI.',
  },
];
l6.qcm = l6.quiz[0];

// ── LEÇON 7 — Risques (Module 2, pos 6) ──────────────────────────────────────
const l7 = readLesson('lecon7-risques.json');
l7.module = MODULE_2;
l7.nouveaute = NOUVEAUTE;
l7.duree_min = 14;
l7.charts = [];
delete l7.chart;

l7.sections[0].contenu = [
  'Investir à la BRVM expose votre capital à des baisses parfois marquées : une action n’est pas un compte sur livret.',
  'Sur les 52 semaines arrêtées au 23 novembre 2026, plusieurs titres ont reculé fortement depuis leur plus-haut : SCRC (−68,6 %, de 3 920 à 1 230 FCFA), SAFC (−53,4 %), UNLC (−50,9 %) et SIVC (−50,2 %).',
  'Cinq risques principaux doivent être compris et mesurés avant d’engager votre épargne.',
].join('\n');
l7.sections[0].graphiques = [
  {
    type: 'bar',
    titre: 'Plus forts reculs réels depuis le plus-haut 52 semaines (%)',
    reel: true,
    note: 'Sources : BRVM (cours de clôture et plus-hauts 52 semaines au 23/11/2026).',
    labels: src.baisses_52s_2026_11_23.map((b) => b.code),
    valeurs: src.baisses_52s_2026_11_23.map((b) => Math.abs(b.recul_pct)),
  },
];

l7.sections[1].contenu = [
  'Sur un marché étroit comme la BRVM, le risque de liquidité est souvent sous-estimé : vouloir vendre vite peut coûter cher en écart de prix.',
  `Au 23 novembre 2026, seules ${src.liquidite_2026_11_23.classes.A} valeurs sur 48 sont en classe A de liquidité (SNTS 92/100, SGBC 80, BBGC 79, BOAC 75), ${src.liquidite_2026_11_23.classes.B} en classe B, ${src.liquidite_2026_11_23.classes.C} en classe C et ${src.liquidite_2026_11_23.classes.D} en classe D.`,
  'Sur les valeurs les moins liquides de classe D comme PRSC (score 17/100), l’écart entre achat et vente atteint 8,99 %, contre 0,36 % sur BOAC ou 0,75 % sur SNTS.',
].join('\n');
l7.sections[1].graphiques = [
  {
    type: 'bar',
    titre: 'Répartition des 48 actions BRVM par classe de liquidité (A à D)',
    reel: true,
    note: 'Sources : Moteur de liquidité WestBourse (données BRVM au 23/11/2026).',
    labels: ['Classe A (très liquide)', 'Classe B (liquide)', 'Classe C (modérée)', 'Classe D (étroite)'],
    valeurs: [
      src.liquidite_2026_11_23.classes.A,
      src.liquidite_2026_11_23.classes.B,
      src.liquidite_2026_11_23.classes.C,
      src.liquidite_2026_11_23.classes.D,
    ],
  },
];

// Préserve le simulateur carnet, simulation allocation, et simulation scenario_baisse déjà présents dans l7 (requis par lecons-6-11.test.ts).
l7.sections[2].contenu = [
  'La leçon 6 a présenté les deux limites de prix (cours limité et au mieux). Face à un carnet réel peu profond, deux autres paramètres évitent les mauvaises surprises.',
  'La durée de validité précise si l’ordre expire en fin de séance (« jour ») ou reste actif jusqu’à exécution ou annulation (« à révocation »).',
  'La condition « tout ou rien » impose une exécution complète en une fois, utile pour éviter de multiplier les frais sur de micro-exécutions.',
].join('\n');

l7.sections[6].contenu = [
  'Votre première protection est financière : ne placez jamais en Bourse votre épargne de précaution (3 à 6 mois de dépenses essentielles).',
  'Votre deuxième protection est la diversification : limitez chaque société à 20 % et chaque secteur à 35 % de votre portefeuille.',
  'Votre troisième protection est la discipline d’exécution : utilisez des ordres à cours limité et consultez le score de liquidité avant d’acheter.',
].join('\n');

l7.quiz = [
  ...l7.quiz.slice(0, 8),
  {
    question: 'Combien de valeurs sur les 48 cotées atteignent la classe A de liquidité au 23 novembre 2026 ?',
    options: ['4 valeurs', '24 valeurs', '36 valeurs', 'Toutes les 48 valeurs'],
    correct: 0,
    explication: 'Seules 4 valeurs (SNTS, SGBC, BBGC, BOAC) atteignent la classe A, ce qui impose de vérifier la liquidité avant tout ordre important.',
  },
  {
    question: 'Pourquoi un écart achat/vente de 8,99 % sur un titre peu liquide pèse-t-il sur votre rendement ?',
    options: [
      'Parce qu’il est remboursé par la SGI',
      'Parce qu’acheter au prix vendeur puis revendre au prix acheteur coûte d’emblée près de 9 %',
      'Parce que l’IRVM passe à 8,99 %',
      'Parce que le dividende est doublé',
    ],
    correct: 1,
    explication: 'Un spread large agit comme un coût d’entrée/sortie immédiat : il faut plusieurs années de dividende ou de hausse pour le compenser.',
  },
  {
    question: 'Quel recul réel a subi SCRC sur 52 semaines au 23 novembre 2026 depuis son plus-haut ?',
    options: ['−5 %', '−15 %', '−68,6 %', '0 %'],
    correct: 2,
    explication: 'SCRC est passée de 3 920 FCFA à 1 230 FCFA (−68,6 %), illustrant qu’une action individuelle peut perdre plus de la moitié de sa valeur.',
  },
];
l7.qcm = l7.quiz[0];

// ── LEÇON 8 — Cas pratique scolarité (Module 2, pos 7) ───────────────────────
const l8 = readLesson('lecon8-scolarite.json');
l8.module = MODULE_2;
l8.nouveaute = NOUVEAUTE;
l8.duree_min = 10;
l8.charts = [];
delete l8.chart;

l8.sections[0].contenu = [
  'Financer une scolarité future demande deux ingrédients : un horizon long (8 à 12 ans) pour laisser travailler la capitalisation, et un calendrier d’encaissement cohérent avec la rentrée.',
  'Bonne nouvelle à la BRVM : la majorité des dividendes sont versés entre mai et septembre, juste avant les frais de rentrée d’octobre.',
  `Sur l’exercice 2025, BOAB a payé le ${boab.payment_date}, PALC le ${palc.payment_date}, STBC le ${stbc.payment_date} et ABJC le ${abjc.payment_date}.`,
].join('\n');

l8.sections[1].contenu = [
  'Pour construire un revenu annuel cible, partez toujours du rendement net d’IRVM (12 % en Côte d’Ivoire) et déduisez environ 1 % de frais de courtage à chaque achat.',
  'Avec un rendement net hypothétique de 8 %, viser 1 000 000 FCFA par an demande un capital de 12 500 000 FCFA (1 000 000 ÷ 0,08).',
  'À défaut de ce capital dès le départ, un versement mensuel régulier combiné au réinvestissement des dividendes permet de s’en rapprocher année après année.',
].join('\n');
l8.sections[1].graphiques = [
  {
    type: 'bar',
    titre: 'Calendrier réel des paiements de dividendes (mai à septembre 2026, FCFA net/action)',
    reel: true,
    note: 'Sources : Calendrier officiel des dividendes BRVM (ex. 2025). Montants nets versés.',
    labels: ['BOAB (mai)', 'PALC (juin)', 'SGBC (août)', 'STBC (août)', 'ABJC (sept.)'],
    valeurs: [boab.div_net, palc.div_net, sgbc.div_net, stbc.div_net, abjc.div_net],
  },
];

l8.sections[4].contenu = [
  'À l’approche de l’échéance (les 2 à 3 dernières années avant le paiement des frais universitaires), il faut sécuriser progressivement le capital accumulé.',
  'Vendre une partie des actions lors des bonnes périodes pour basculer vers des obligations d’État UEMOA (6,15 % à 6,30 % par an) ou des dépôts à terme évite d’être forcé de vendre en pleine baisse boursière.',
].join('\n');
l8.sections[4].graphiques = [
  {
    type: 'bar',
    titre: 'Exemple pédagogique : trajectoire d’un capital de 1 000 FCFA à 10 %/an sur 10 ans',
    reel: false,
    note: 'Exemple pédagogique à taux composé constant (10 %/an), hors frais et impôts.',
    labels: ['Année 0', 'Année 3', 'Année 5', 'Année 8', 'Année 10'],
    valeurs: [1000, 1331, 1611, 2144, 2594],
  },
];

l8.quiz = [
  ...l8.quiz.slice(0, 5),
  {
    question: 'Pourquoi la période mai–septembre de la BRVM convient-elle bien à un projet de rentrée scolaire ?',
    options: [
      'Parce que la Bourse est fermée de mai à septembre',
      'Parce que la majorité des dividendes sont payés entre mai et septembre, avant la rentrée',
      'Parce que les frais SGI sont supprimés en été',
      'Parce que l’IRVM est remboursé en septembre',
    ],
    correct: 1,
    explication: 'Le gros des détachements et paiements de dividendes BRVM a lieu entre mai et septembre, alimentant le compte espèces avant octobre.',
  },
  {
    question: 'Quelle poche d’actifs privilégier à 1 ou 2 ans de l’entrée à l’université pour sécuriser le capital ?',
    options: [
      'Des actions de classe D très volatiles',
      'Des obligations d’État UEMOA ou de l’épargne bancaire sécurisée',
      'Un seul titre cyclique',
      'Des crypto-actifs à fort levier',
    ],
    correct: 1,
    explication: 'À court terme (1–2 ans), la priorité est la préservation du capital : obligations courtes ou épargne garantie.',
  },
  {
    question: 'Que permet le réinvestissement des dividendes pendant les 6 à 8 premières années du projet ?',
    options: [
      'D’acheter de nouvelles actions qui produiront à leur tour des dividendes',
      'De réduire le nombre d’actions détenues',
      'D’éviter toute variation de cours',
      'De supprimer le risque sectoriel',
    ],
    correct: 0,
    explication: 'Chaque dividende réinvesti augmente le nombre d’actions génératrices de revenus futurs (effet boule de neige).',
  },
  {
    question: 'Quel risque guette un parent qui reste investi à 100 % en actions jusqu’au mois de la rentrée ?',
    options: [
      'Devoir vendre ses titres en pleine baisse temporaire du marché',
      'Recevoir deux fois le même dividende',
      'Ne pas pouvoir payer par virement',
      'Payer un IRVM de 0 %',
    ],
    correct: 0,
    explication: 'Un repli boursier de −20 % à −30 % juste avant la rentrée réduirait le budget disponible s’il n’a pas été sécurisé à l’avance.',
  },
];
l8.qcm = l8.quiz[0];

// ── LEÇON 9 — Trois stratégies (Module 3, pos 8) ─────────────────────────────
const l9 = readLesson('lecon9-strategies.json');
l9.module = MODULE_3;
l9.nouveaute = NOUVEAUTE;
l9.duree_min = 10;
l9.charts = [];
delete l9.chart;

l9.sections[0].contenu = [
  'Acheter sans stratégie revient à réagir à chaque variation du jour. À la BRVM, trois approches complémentaires dominent chez les investisseurs disciplinés.',
  '1. La stratégie Revenu privilégie la régularité et le rendement net du dividende (ex. SGBC à 6,11 % net ou STBC à 8,37 % net).',
  '2. La stratégie Valeur (décote) cherche des sociétés rentables payées sous leur moyenne historique de PER ou de P/B — en vérifiant toujours qu’il ne s’agit pas d’un piège (« value trap »).',
  '3. La stratégie Croissance accepte un rendement immédiat plus modeste pour capter la progression durable des bénéfices et du dividende (ex. SNTS ou SGBC sur 5 ans).',
].join('\n');
l9.sections[0].graphiques = [
  {
    type: 'line',
    titre: 'Croissance régulière du dividende net sur 5 ans : SNTS vs SGBC (base 100 en 2021)',
    reel: true,
    note: 'Sources : BRVM (calendrier officiel 2025) et historiques 2021–2024 rebasés à 100 en 2021.',
    labels: divs.historique_5_ans_fcfa_net.SNTS.map((x) => String(x.exercice)),
    valeurs: [],
    series: [
      { nom: 'SNTS (base 100)', valeurs: divs.historique_5_ans_fcfa_net.SNTS.map((x) => Math.round((x.net / 140) * 100)), type: 'line', axe: 'gauche' },
      { nom: 'SGBC (base 100)', valeurs: divs.historique_5_ans_fcfa_net.SGBC.map((x) => Math.round((x.net / 1004.93) * 100)), type: 'line', axe: 'gauche' },
    ],
  },
];

l9.sections[2].contenu = [
  'Le PER (Price-to-Earnings Ratio) rapporte le cours de l’action au bénéfice par action (BPA). Un PER de 8 signifie qu’au rythme actuel, il faut 8 ans de bénéfices pour égaler le prix payé.',
  'Attention au piège du PER bas : si le bénéfice vient d’un gain exceptionnel ou s’il est en train de chuter, un PER apparemment bon marché devient cher l’année suivante.',
  'À la BRVM, comparez toujours le PER d’une banque avec celui des autres banques, et le ROE (rentabilité des capitaux propres) avec la solidité du bilan.',
].join('\n');

l9.sections[4].contenu = [
  'En pratique, beaucoup d’investisseurs combinent un socle « Revenu / Qualité » (60 à 70 % du portefeuille) avec une poche « Valeur ou Croissance » (30 à 40 %).',
  'Quelle que soit la stratégie, donnez-lui un horizon cohérent : 5 ans minimum pour juger une valeur de rendement ou de croissance, et un suivi semestriel des comptes publiés.',
].join('\n');

l9.quiz = [
  ...l9.quiz.slice(0, 5),
  {
    question: 'Qu’est-ce qu’un « value trap » (piège de valeur) en analyse boursière ?',
    options: [
      'Une action chère qui double chaque mois',
      'Une action à PER très bas dont les bénéfices et l’activité continuent de se dégrader',
      'Un dividende payé deux fois',
      'Un titre obligataire d’État',
    ],
    correct: 1,
    explication: 'Un PER bas n’est une opportunité que si les bénéfices sont durables ; s’ils chutent, le cours peut continuer de baisser.',
  },
  {
    question: 'Sur 5 exercices (2021–2025), comment a évolué le dividende net de SGBC ?',
    options: [
      'Il a été supprimé',
      'Il est passé d’environ 1 005 FCFA à 2 293 FCFA (+128 %)',
      'Il a été divisé par deux',
      'Il est resté figé à 500 FCFA',
    ],
    correct: 1,
    explication: 'Le dividende net de SGBC est passé de 1 004,93 FCFA (2021) à 2 293,28 FCFA (2025), illustrant une dynamique bénéficiaire soutenue.',
  },
  {
    question: 'Pourquoi faut-il comparer le PER d’une banque uniquement à d’autres banques ?',
    options: [
      'Parce que les banques n’ont pas de clients',
      'Parce que leur structure comptable (PNB, levier, coût du risque) diffère des sociétés industrielles',
      'Parce que le PER des banques est toujours égal à 1',
      'Parce que la BRVM interdit de comparer deux secteurs',
    ],
    correct: 1,
    explication: 'Les banques et les industries ont des modèles économiques et des ratios de bilan incomparables directement : comparez toujours au sein du même secteur.',
  },
  {
    question: 'Quel indicateur complète le PER pour vérifier la rentabilité réelle des capitaux investis ?',
    options: ['Le ROE (Return on Equity)', 'Le numéro ISIN', 'L’heure de clôture', 'Le nombre de pages du rapport'],
    correct: 0,
    explication: 'Le ROE (résultat net ÷ capitaux propres) mesure la rentabilité créée pour les actionnaires ; il éclaire si un P/B ou PER est justifié.',
  },
];
l9.qcm = l9.quiz[0];

// ── LEÇON 10 — Diaspora (Module 3, pos 9) ────────────────────────────────────
const l10 = readLesson('lecon10-diaspora.json');
l10.module = MODULE_3;
l10.nouveaute = NOUVEAUTE;
l10.duree_min = 9;
l10.charts = [];
delete l10.chart;

l10.sections[0].contenu = [
  'Un investisseur résidant en France, en Belgique, au Canada ou aux États-Unis peut investir à la BRVM sans résidence fiscale dans l’UEMOA, en ouvrant un compte-titres auprès d’une SGI agréée par l’AMF-UMOA.',
  `Pour la zone euro, la parité fixe garantie par la BCEAO est de 1 € = ${String(src.macro.parite_eur_xof).replace('.', ',')} FCFA : il n’y a aucun risque de change entre l’euro et le franc CFA.`,
  'En revanche, depuis le dollar américain (USD), canadien (CAD) ou la livre sterling (GBP), le taux de change varie chaque jour face à l’euro et donc face au FCFA.',
].join('\n');

l10.sections[1].contenu = [
  `Quarante SGI agréées opèrent dans sept pays de l’UEMOA (${src.sgi.repartition_pays.CI} en Côte d’Ivoire, ${src.sgi.repartition_pays.SN} au Sénégal, ${src.sgi.repartition_pays.BJ} au Bénin, ${src.sgi.repartition_pays.BF} au Burkina Faso…). Plusieurs acceptent l’ouverture à distance avec pièces certifiées.`,
  'Vérifiez trois points avant d’envoyer vos fonds : l’agrément AMF-UMOA, les frais de virement international entrant/sortant, et le délai de rapatriement des dividendes.',
].join('\n');
l10.sections[1].graphiques = [
  {
    type: 'bar',
    titre: 'Implantation des 40 SGI agréées par pays UEMOA (accès à distance)',
    reel: true,
    note: 'Sources : Annuaire officiel des SGI BRVM / AMF-UMOA (2026).',
    labels: ['CI', 'SN', 'BJ', 'BF', 'ML', 'NE', 'TG'],
    valeurs: [
      src.sgi.repartition_pays.CI,
      src.sgi.repartition_pays.SN,
      src.sgi.repartition_pays.BJ,
      src.sgi.repartition_pays.BF,
      src.sgi.repartition_pays.ML,
      src.sgi.repartition_pays.NE,
      src.sgi.repartition_pays.TG,
    ],
  },
];

l10.sections[3].contenu = [
  'Sur le plan fiscal, l’IRVM (ex. 12 % en Côte d’Ivoire) est retenu à la source avant le versement du dividende sur votre compte espèces SGI.',
  'Selon votre pays de résidence et l’existence d’une convention fiscale (comme entre la France et la Côte d’Ivoire ou le Sénégal), ces revenus peuvent devoir être déclarés localement avec crédit d’impôt.',
  'Conservez chaque avis d’opéré et relevé annuel de votre SGI pour justifier l’origine des fonds lors du rapatriement vers votre banque étrangère.',
].join('\n');

l10.sections[5].contenu = [
  'Méfiez-vous des plateformes non agréées qui promettent des rendements garantis ou vendent des « actions africaines » par carte bancaire sans compte-titres SGI à votre nom.',
  'Règle absolue : vérifiez l’agrément AMF-UMOA de l’intermédiaire et ne virez jamais d’argent sur un compte personnel.',
].join('\n');

l10.quiz = [
  ...l10.quiz.slice(0, 5),
  {
    question: 'Un résident aux États-Unis (en USD) investissant à la BRVM est-il exposé au risque de change ?',
    options: [
      'Non, le dollar est lié au FCFA à parité fixe',
      'Oui, car le FCFA est arrimé à l’euro, pas au dollar américain',
      'Uniquement sur les obligations',
      'Jamais, la BRVM compense les écarts de change',
    ],
    correct: 1,
    explication: 'La parité fixe concerne EUR/XOF (655,957). Face au USD, CAD ou GBP, le cours de change fluctue avec la paire EUR/USD.',
  },
  {
    question: 'Pourquoi faut-il conserver les avis d’opéré et relevés annuels de votre SGI depuis l’étranger ?',
    options: [
      'Pour participer au tirage au sort de la BRVM',
      'Pour prouver l’origine fiscale des dividendes et faciliter le rapatriement bancaire',
      'Pour supprimer les droits de garde',
      'Pour voter deux fois en assemblée générale',
    ],
    correct: 1,
    explication: 'Les banques étrangères et administrations fiscales exigent des justificatifs d’origine des fonds et de retenue à la source.',
  },
  {
    question: 'Quel est le réflexe immédiat face à un démarchage promettant « 5 % par mois garantis sur la BRVM » ?',
    options: [
      'Déposer une petite somme pour tester',
      'Refuser : aucun rendement boursier n’est garanti, vérifier l’agrément AMF-UMOA',
      'Donner ses codes bancaires',
      'Envoyer un virement par messagerie',
    ],
    correct: 1,
    explication: 'En bourse, les rendements ne sont jamais garantis ; toute promesse de rendement fixe mensuel élevé est un signal d’alerte majeur.',
  },
  {
    question: 'Une SGI basée au Sénégal peut-elle exécuter vos ordres sur une société ivoirienne cotée à la BRVM ?',
    options: [
      'Non, il faut une SGI par pays',
      'Oui, la BRVM est une bourse régionale unifiée couvrant les 8 pays de l’UEMOA',
      'Seulement pour les obligations',
      'Uniquement le vendredi',
    ],
    correct: 1,
    explication: 'La BRVM est un marché régional unique : toute SGI agréée par l’AMF-UMOA accède à l’ensemble des titres cotés.',
  },
];
l10.qcm = l10.quiz[0];

// ── LEÇON 11 — Comparaison objective (Module 3, pos 10) ──────────────────────
const l11 = readLesson('lecon11-comparaison.json');
l11.module = MODULE_3;
l11.nouveaute = NOUVEAUTE;
l11.duree_min = 10;
l11.charts = [];
delete l11.chart;

const obSen = src.obligations_2026_11_24.find((o) => o.code === 'EOS.O10');
const obMal = src.obligations_2026_11_24.find((o) => o.code === 'EOM.O9');
const obBao = src.obligations_2026_11_24.find((o) => o.code === 'BABS.O1');

l11.sections[0].contenu = [
  'Comparer les placements suppose de regarder quatre critères ensemble : le rendement espéré, le risque de perte en capital, la liquidité (vitesse de sortie) et l’horizon recommandé.',
  `En UEMOA, le taux directeur de la BCEAO sert de boussole monétaire (${fr2(src.macro.bceao_taux_directeur_pct)} % au 16 mars 2026, guichet marginal à ${fr2(src.macro.bceao_guichet_marginal_pct)} %).`,
  'Aucun placement ne gagne sur les quatre tableaux : un livret offre une liquidité totale mais un rendement modeste ; les actions offrent le potentiel long terme mais fluctuent fortement.',
].join('\n');

l11.sections[1].contenu = [
  `Sur le compartiment obligataire de la BRVM au 24 novembre 2026, les emprunts d’État et privés cotés affichent des coupons faciaux de ${fr2(obSen.taux_pct)} % (${obSen.designation}), ${fr2(obMal.taux_pct)} % (${obMal.designation}) ou ${fr2(obBao.taux_pct)} % (${obBao.designation}).`,
  'Face à ces coupons fixes, les actions les plus généreuses versent des dividendes nets entre 5,78 % (SPHC) et 8,37 % (STBC) en 2026, auxquels s’ajoute la variation possible du cours.',
  'Entre les deux, les OPCVM (FCP) mutualisent un panier géré par un professionnel, moyennant des frais de gestion annuels.',
].join('\n');
l11.sections[1].graphiques = [
  {
    type: 'bar',
    titre: 'Repères réels de rendement en UEMOA (%) : BCEAO, obligations et dividendes nets',
    reel: true,
    note: 'Sources : BCEAO (16/03/2026), BRVM Obligations (24/11/2026) et Calendrier officiel des dividendes BRVM (ex. 2025).',
    labels: ['Taux BCEAO', 'Sénégal 2030', 'Mali 2032', 'Baobab 2029', 'SGBC (div. net)', 'ABJC (div. net)', 'STBC (div. net)'],
    valeurs: [
      src.macro.bceao_taux_directeur_pct,
      obSen.taux_pct,
      obMal.taux_pct,
      obBao.taux_pct,
      sgbc.rdt_net_pct,
      abjc.rdt_net_pct,
      stbc.rdt_net_pct,
    ],
  },
];

l11.sections[3].contenu = [
  'Comment articuler ces placements dans la vraie vie ? Par couches successives plutôt qu’en opposant un produit à un autre.',
  'Couche 1 (urgence, disponible sous 24 h) : épargne bancaire ou livret pour couvrir 3 à 6 mois de dépenses.',
  'Couche 2 (moyen terme, 2 à 5 ans) : dépôts à terme, obligations UEMOA ou OPCVM obligataires pour stabiliser le capital.',
  'Couche 3 (long terme, 5 ans et plus) : actions BRVM diversifiées et réinvestissement des dividendes.',
].join('\n');

l11.quiz = [
  ...l11.quiz.slice(0, 5),
  {
    question: 'Quelle différence essentielle oppose une obligation d’État UEMOA (ex. 6,15 % à 6,30 %) à une action cotée ?',
    options: [
      'L’obligation verse un coupon défini et rembourse le nominal à l’échéance (hors défaut)',
      'L’obligation n’a jamais de date d’échéance',
      'L’action garantit un remboursement fixe chaque année',
      'L’obligation donne un droit de vote en AG d’entreprise',
    ],
    correct: 0,
    explication: 'L’obligation est un titre de créance à échéancier défini ; l’action est un titre de propriété dont le dividende et le cours fluctuent.',
  },
  {
    question: 'Quel est le rôle d’un OPCVM (ou FCP) par rapport à un achat d’actions en direct ?',
    options: [
      'Supprimer tout risque de marché',
      'Déléguer la gestion d’un portefeuille diversifié à un gérant agréé',
      'Doubler le dividende net versé',
      'Contourner les SGI agréées',
    ],
    correct: 1,
    explication: 'Un OPCVM mutualise l’épargne et confie la sélection et le suivi à un gérant professionnel, en échange de frais de gestion.',
  },
  {
    question: 'Pourquoi l’immobilier locatif ne remplace-t-il pas totalement les actifs financiers dans un patrimoine ?',
    options: [
      'Parce que l’immobilier demande un ticket d’entrée élevé et reste peu liquide en cas de besoin rapide',
      'Parce qu’il est interdit en UEMOA',
      'Parce qu’il rapporte toujours 0 %',
      'Parce qu’il est coté chaque jour à la BRVM',
    ],
    correct: 0,
    explication: 'L’immobilier est peu fractionnable et long à vendre : la bourse apporte divisibilité et liquidité sur les grandes valeurs.',
  },
  {
    question: 'Dans une allocation patrimoniale équilibrée, à quel horizon réserver les actions BRVM ?',
    options: [
      'Moins de 3 mois',
      '1 an maximum',
      '5 ans et plus, une fois l’épargne de précaution constituée',
      'Uniquement pour l’épargne de la semaine',
    ],
    correct: 2,
    explication: 'Un horizon de 5 ans et plus permet d’absorber les baisses cycliques et de profiter du réinvestissement des dividendes.',
  },
];
l11.qcm = l11.quiz[0];

const OUTPUTS = [
  { pos: 4, file: 'lecon5-dividendes.json', prefix: 'Leçon 5 — ', lesson: l5 },
  { pos: 5, file: 'lecon6-compte-ordre.json', prefix: 'Leçon 6 — ', lesson: l6 },
  { pos: 6, file: 'lecon7-risques.json', prefix: 'Leçon 7 — ', lesson: l7 },
  { pos: 7, file: 'lecon8-scolarite.json', prefix: 'Leçon 8 — ', lesson: l8 },
  { pos: 8, file: 'lecon9-strategies.json', prefix: 'Leçon 9 — ', lesson: l9 },
  { pos: 9, file: 'lecon10-diaspora.json', prefix: 'Leçon 10 — ', lesson: l10 },
  { pos: 10, file: 'lecon11-comparaison.json', prefix: 'Leçon 11 — ', lesson: l11 },
];

for (const { file, lesson } of OUTPUTS) {
  writeLesson(file, lesson);
  const chars = lesson.sections.reduce((a, s) => a + s.contenu.length, 0);
  console.log(file, '-> chars:', chars, '| sections:', lesson.sections.length, '| quiz:', lesson.quiz.length);
}

const sqlBlocks = OUTPUTS.map(({ pos, file, prefix, lesson }, i) => {
  const tag = `L${pos}_M23_${i}`;
  const json = JSON.stringify(lesson);
  return `  -- Position ${pos} (${file})
  IF NOT ((v_content->'lessons'->${pos}->>'titre') LIKE '${prefix}%') THEN
    RAISE EXCEPTION 'Migration 0269 interrompue : leçon en position ${pos} inattendue (%)', v_content->'lessons'->${pos}->>'titre';
  END IF;
  v_content := jsonb_set(
    v_content,
    '{lessons,${pos}}',
    (v_content->'lessons'->${pos}) || $${tag}$${json}$${tag}$::jsonb
  );`;
});

const migrationSql = `-- ══════════════════════════════════════════════════════════════════════════════
-- 0269_academy_niveau1_modules2_3.sql
-- Enrichissement substantiel des 7 leçons des Modules 2 et 3 (Niveau 1 : leçons 5 à 11)
-- Généré par frontend/scripts/academy-niveau1-modules2-3.mjs le 2026-11-24
-- Données réelles figées : frontend/lib/academy/contenus/sources/niveau1-modules2-3-2026-11-24.json
-- Idempotent : vérifie la position et le préfixe de chaque titre avant mise à jour.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_content jsonb;
BEGIN
  SELECT content INTO v_content
  FROM public.academy_courses
  WHERE slug = 'academy-niveau-1-initiation'
  FOR UPDATE;

  IF v_content IS NULL THEN
    RAISE EXCEPTION 'Cours academy-niveau-1-initiation introuvable';
  END IF;

${sqlBlocks.join('\n\n')}

  UPDATE public.academy_courses
  SET content = v_content,
      updated_at = now()
  WHERE slug = 'academy-niveau-1-initiation';
END $$;
`;

fs.writeFileSync(MIGRATION_PATH, migrationSql, 'utf8');
console.log('Migration générée :', MIGRATION_PATH, `(${(migrationSql.length / 1024).toFixed(1)} Ko)`);
