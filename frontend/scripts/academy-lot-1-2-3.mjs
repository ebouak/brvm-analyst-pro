/**
 * Lot #1 + #2 + #3 Academy BRVM :
 *  1) Rattache `exercice_id` aux 9 leçons ciblées des Niveaux 1 à 4
 *  2) Ajoute les simulateurs manquants au Niveau 4 (5/5 leçons équipées)
 *  3) Étend le quiz du Niveau 4 de 25 à 52 questions (longueurs équilibrées, invariants respectés)
 *  4) Génère `supabase/migrations/0270_academy_expert_live_covers.sql`
 *     (couvertures N2/N3/N4, exercice_id N1-N4, leçons N4, questions d'examen debutant + expert)
 *
 * Exécution : node frontend/scripts/academy-lot-1-2-3.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CONTENUS = path.join(ROOT, 'frontend', 'lib', 'academy', 'contenus');
const MIGRATION_PATH = path.join(ROOT, 'supabase', 'migrations', '0270_academy_expert_live_covers.sql');
const TODAY = '2026-11-25';

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(CONTENUS, rel), 'utf8'));
}

function writeJson(rel, obj) {
  const indent = rel.startsWith('niveau2') || rel.startsWith('niveau4') ? 1 : 2;
  fs.writeFileSync(path.join(CONTENUS, rel), `${JSON.stringify(obj, null, indent)}\n`, 'utf8');
}

function sqlDollar(tag, text) {
  let t = tag;
  let n = 0;
  while (text.includes(`$${t}$`)) {
    n += 1;
    t = `${tag}_${n}`;
  }
  return `$${t}$${text}$${t}$`;
}

// ── 1. Rattachement exercice_id sur les 9 leçons ciblées ───────────────────
const EXERCICE_MAP = [
  { rel: 'lecon1-brvm.json', slug: 'academy-niveau-1-initiation', idx: 0, prefix: 'Leçon 1 — ', id: 'capitalisation-du-jour' },
  { rel: 'lecon3-budget.json', slug: 'academy-niveau-1-initiation', idx: 2, prefix: 'Leçon 3 — ', id: 'cout-ordre-du-jour' },
  { rel: 'lecon4-gagner.json', slug: 'academy-niveau-1-initiation', idx: 3, prefix: 'Leçon 4 — ', id: 'rendement-net' },
  { rel: 'niveau2/l02-per.json', slug: 'academy-niveau-2-fondamental', idx: 9, prefix: 'Leçon 2 — ', id: 'per-du-jour' },
  { rel: 'niveau2/l03-pb-roe.json', slug: 'academy-niveau-2-fondamental', idx: 10, prefix: 'Leçon 3 — ', id: 'value-trap-pick' },
  { rel: 'niveau3/l01-lire-graphique.json', slug: 'academy-niveau-3-technique', idx: 1, prefix: 'Leçon 1 — ', id: 'variation-20-seances' },
  { rel: 'niveau3/l03-moyennes-mobiles.json', slug: 'academy-niveau-3-technique', idx: 3, prefix: 'Leçon 3 — ', id: 'position-moyenne-20' },
  { rel: 'niveau3/l04-rsi.json', slug: 'academy-niveau-3-technique', idx: 4, prefix: 'Leçon 4 — ', id: 'rsi-zone-du-jour' },
  { rel: 'niveau4/l04-pourquoi-bourse.json', slug: 'academy-niveau-4-expert', idx: 3, prefix: 'Leçon 4 — ', id: 'ecart-ipo-bbgc' },
];

for (const item of EXERCICE_MAP) {
  const j = readJson(item.rel);
  j.exercice_id = item.id;
  writeJson(item.rel, j);
}

// ── 2. Niveau 4 : simulateurs sur L1, L2, L3, L5 + 52 questions ───────────
const N4_SIMS = {
  'niveau4/l01-architecture.json': {
    sectionIdx: 2,
    simulation: {
      type: 'frais_ordre',
      consigne: 'Simulez les frais cumulés prélevés dans la chaîne SGI, BRVM et DC/BR lors d’un ordre au comptant.',
      cours: 25000,
      quantite: 10,
      taux_frais_pct: 1.4,
      minimum_fcfa: 2500,
    },
  },
  'niveau4/l02-integrite.json': {
    sectionIdx: 2,
    simulation: {
      type: 'carnet',
      niveaux: [
        { prix: 4000, quantite: 20 },
        { prix: 4250, quantite: 15 },
        { prix: 4600, quantite: 25 },
      ],
      quantite_defaut: 45,
      codes: ['SNTS', 'SGBC', 'ORAC'],
    },
  },
  'niveau4/l03-compartiments.json': {
    sectionIdx: 1,
    simulation: {
      type: 'technique',
      consigne: 'Observez l’évolution récente de valeurs phares éligibles aux indices et compartiments de la BRVM.',
      indicateur: 'variation',
      codes: ['SNTS', 'ORAC', 'SGBC'],
    },
  },
  'niveau4/l05-procedure.json': {
    sectionIdx: 3,
    simulation: {
      type: 'souscription_ipo',
      consigne: 'Testez la réduction proportionnelle sur une offre publique sursouscrite à 200 %.',
      titres_offerts: 2000000,
      prix: 5000,
      taux_souscription_pct: 200,
      demande: 1000,
    },
  },
};

const N4_EXTRA_QUIZ = {
  'niveau4/l01-architecture.json': [
    {
      question: 'À quelle date l’AMF-UMOA a-t-elle officiellement succédé à l’ex-CREPMF ?',
      options: ['Le 1er janvier 1998', 'Le 1er octobre 2022', 'Le 15 mars 2015', 'Le 1er juillet 2024'],
      correct: 1,
      explication: 'Le Traité révisé de l’UMOA entré en vigueur le 1er octobre 2022 a transformé l’ex-CREPMF en AMF-UMOA.',
    },
    {
      question: 'Pourquoi les espèces et titres des clients sont-ils cantonnés au DC/BR séparément des fonds propres de la SGI ?',
      options: [
        'Pour protéger les avoirs des clients en cas de défaut de la SGI',
        'Pour augmenter le dividende versé chaque année aux actionnaires',
        'Pour permettre à la BRVM de fixer des cours sans carnet d’ordres',
        'Pour dispenser les particuliers de tout prélèvement fiscal IRVM',
      ],
      correct: 0,
      explication: 'La ségrégation des comptes au DC/BR isole les titres et avoirs des clients du bilan propre de l’intermédiaire.',
    },
    {
      question: 'Quelle mission relève directement de la Bourse Régionale des Valeurs Mobilières (BRVM) ?',
      options: [
        'La politique monétaire des huit États de l’UEMOA',
        'L’organisation des séances de cotation et du carnet',
        'La gestion individuelle des portefeuilles des particuliers',
        'Le prélèvement de l’impôt sur le revenu des sociétés',
      ],
      correct: 1,
      explication: 'La BRVM organise la cotation centralisée, la diffusion des cours officiels et la surveillance technique des séances.',
    },
    {
      question: 'Un épargnant souhaite déposer une réclamation après un litige avec sa SGI. Quel recours interne existe depuis la réforme de 2022 ?',
      options: [
        'Le Médiateur institué auprès de l’AMF-UMOA',
        'La chambre commerciale du Fonds monétaire international',
        'L’assemblée générale annuelle des sociétés du compartiment',
        'Le service client de la Bourse de Dakar uniquement',
      ],
      correct: 0,
      explication: 'La réforme instituant l’AMF-UMOA a mis en place un Médiateur chargé de traiter les différends entre épargnants et intervenants agréés.',
    },
    {
      question: 'Qui délivre l’agrément indispensable pour exercer en tant que SGI dans l’espace UEMOA ?',
      options: [
        'L’AMF-UMOA, autorité de régulation du marché financier',
        'La chambre de commerce du pays du demandeur',
        'Le conseil d’administration de chaque société cotée',
        'La première SGI historique implantée à Abidjan',
      ],
      correct: 0,
      explication: 'Seule l’AMF-UMOA délivre l’agrément aux SGI, sociétés de gestion d’OPCVM et autres acteurs du marché financier régional.',
    },
    {
      question: 'Que se passe-t-il durant l’étape de règlement-livraison pilotée par le DC/BR après exécution d’un achat ?',
      options: [
        'La SGI conserve les titres en papier dans ses propres coffres',
        'Les titres sont virés au compte de l’acheteur contre espèces',
        'La société émettrice verse immédiatement un dividende spécial',
        'Le prix exécuté est recalculé selon la séance du lendemain',
      ],
      correct: 1,
      explication: 'Le DC/BR garantit la livraison simultanée des titres sur le compte-titres de l’acheteur contre le règlement en espèces.',
    },
  ],
  'niveau4/l02-integrite.json': [
    {
      question: 'Qu’est-ce qu’une « fenêtre négative » (black-out period) appliquée aux dirigeants d’une société cotée ?',
      options: [
        'Une interdiction temporaire d’intervenir sur les titres avant publication',
        'Une suspension automatique de l’action pendant trois mois consécutifs',
        'Une exonération fiscale accordée aux fondateurs lors des dividendes',
        'Une séance réservée aux ordres exécutés par la SGI chef de file',
      ],
      correct: 0,
      explication: 'Avant la publication des comptes, les dirigeants doivent s’abstenir d’acheter ou de vendre afin d’éviter tout soupçon de délit d’initié.',
    },
    {
      question: 'Deux complices se vendent et s’achètent simultanément le même titre au même prix pour gonfler le volume affiché. De quel abus s’agit-il ?',
      options: [
        'D’une offre publique d’achat obligatoire',
        'D’une manipulation de marché par opérations fictives',
        'D’un fractionnement régulier de la valeur nominale',
        'D’une couverture réglementaire imposée par le DC/BR',
      ],
      correct: 1,
      explication: 'Créer une apparence artificielle d’activité ou de liquidité trompe les autres investisseurs : c’est une manipulation de cours prohibée.',
    },
    {
      question: 'Transmettre à un proche un tuyau confidentiel avant la publication officielle d’une acquisition constitue :',
      options: [
        'Une pratique courante tolérée hors séance boursière',
        'Une communication illicite d’information privilégiée',
        'Un service commercial normal entre actionnaires individuels',
        'Une obligation liée à la transparence financière permanente',
      ],
      correct: 1,
      explication: 'Communiquer une information privilégiée hors du cadre professionnel normal expose l’initié et le bénéficiaire à des sanctions.',
    },
    {
      question: 'Quel type de message relayé sur les réseaux sociaux peut être sanctionné au titre de la manipulation de marché ?',
      options: [
        'La diffusion d’informations fausses ou trompeuses sur une société',
        'La lecture publique du dernier bilan annuel officiel certifié',
        'Le calcul d’un multiple PER à partir du Bulletin officiel de la cote',
        'L’analyse comparative de deux exercices historiques déjà publiés',
      ],
      correct: 0,
      explication: 'Propager sciemment des rumeurs fausses ou trompeuses susceptibles d’orienter artificiellement le cours relève de l’abus de marché.',
    },
    {
      question: 'Quelle distinction sépare le travail d’enquête de la décision de sanction à l’AMF-UMOA ?',
      options: [
        'La Commission des sanctions statue indépendamment des enquêteurs',
        'Les deux rôles reviennent uniquement au directeur général de la BRVM',
        'Seules les SGI votent les amendes lors des assemblées générales',
        'La BCEAO tranche les dossiers en remplaçant les juges civils',
      ],
      correct: 0,
      explication: 'Pour garantir un procès équitable, les poursuites et l’instruction sont séparées de l’organe indépendant qui prononce les sanctions.',
    },
  ],
  'niveau4/l03-compartiments.json': [
    {
      question: 'Comment sont pondérées les actions au sein de l’indice BRVM Composite ?',
      options: [
        'De manière strictement égale entre les sociétés cotées',
        'Selon leur capitalisation boursière respective sur la cote',
        'Uniquement selon le montant du dividende versé l’année précédente',
        'À parts fixes selon le pays d’implantation du siège social',
      ],
      correct: 1,
      explication: 'Un indice pondéré par la capitalisation donne un poids proportionnel à la taille boursière de chaque émetteur.',
    },
    {
      question: 'Quelle différence distingue le BRVM 30 du BRVM Principal en termes de nature ?',
      options: [
        'Le BRVM 30 est un indice, alors que le Principal est un compartiment',
        'Le BRVM 30 réunit les obligations souveraines et le Principal les actions',
        'Le BRVM Principal rassemble uniquement des PME non encore rentables',
        'Le BRVM 30 mesure l’inflation moyenne de la zone UEMOA',
      ],
      correct: 0,
      explication: 'Les compartiments (Prestige, Principal, Croissance) classent les sociétés admises ; le BRVM 30 est un indice mesurant les 30 valeurs les plus actives.',
    },
    {
      question: 'Quel principe permet à une société initialement cotée sur le compartiment Principal ou Croissance de changer de catégorie ?',
      options: [
        'Le respect durable des critères exigés lors de la revue annuelle',
        'Une décision libre prise par le PDG sans examen de la BRVM',
        'Une augmentation ponctuelle du cours sur une seule séance',
        'Le versement d’un dividende exceptionnel supérieur à 20 %',
      ],
      correct: 0,
      explication: 'La BRVM vérifie périodiquement les critères de flottant, capitalisation, liquidité et gouvernance avant tout reclassement.',
    },
    {
      question: 'À quoi servent les indices sectoriels publiés parallèlement au BRVM Composite ?',
      options: [
        'À suivre la performance d’un secteur précis face au marché global',
        'À garantir un rendement minimal aux détenteurs d’actions bancaires',
        'À remplacer les rapports annuels certifiés des entreprises cotées',
        'À fixer le tarif des frais de courtage pratiqués par les SGI',
      ],
      correct: 0,
      explication: 'Les indices sectoriels (Finance, Télécoms, Services publics, Distribution…) isolent la dynamique propre à chaque branche d’activité.',
    },
    {
      question: 'Pourquoi un indice large peut-il monter alors que la majorité des titres de la cote stagne ?',
      options: [
        'Parce que deux ou trois très grosses capitalisations tirent la moyenne',
        'Parce que la BRVM retire automatiquement les valeurs en baisse',
        'Parce que l’indice intègre les dépôts à terme des banques centrales',
        'Parce que les dividendes sont comptés en double dans le calcul',
      ],
      correct: 0,
      explication: 'Dans un indice pondéré par la capitalisation, les plus grandes valeurs représentent une part majeure de la variation totale.',
    },
  ],
  'niveau4/l04-pourquoi-bourse.json': [
    {
      question: 'Lors d’une introduction réalisée uniquement par augmentation de capital, à qui reviennent les fonds versés par les nouveaux actionnaires ?',
      options: [
        'Aux anciens actionnaires fondateurs qui cèdent leurs parts',
        'Directement à l’entreprise pour financer ses projets ou sa dette',
        'Au budget annuel du Dépositaire central et des SGI intermédiaires',
        'En réserve bloquée non utilisable sur un compte de l’AMF-UMOA',
      ],
      correct: 1,
      explication: 'L’émission d’actions nouvelles injecte de l’argent frais dans la trésorerie et renforce les fonds propres de la société.',
    },
    {
      question: 'Une société compte 8 millions d’actions et en émet 2 millions de nouvelles en bourse. Un actionnaire historique qui ne souscrit pas passe de 10 % du capital à :',
      options: ['12,5 %', '10,0 %', '8,0 %', '5,0 %'],
      correct: 2,
      explication: 'Il détenait 800 000 actions sur 8 M (10 %) ; après émission, il garde 800 000 actions sur 10 M au total, soit 8,0 % (dilution).',
    },
    {
      question: 'Quel engagement durable pèse sur une entreprise dès le premier jour de sa cotation ?',
      options: [
        'Publier régulièrement des comptes audités et faits importants',
        'Garantir un dividende fixe en croissance chaque trimestre',
        'Racheter ses propres titres si le cours baisse sous le prix d’offre',
        'Verser une prime annuelle à la BRVM proportionnelle au cours',
      ],
      correct: 0,
      explication: 'La transparence périodique et permanente envers l’ensemble du marché devient une obligation continue de la société cotée.',
    },
    {
      question: 'Que désigne habituellement une clause d’incessibilité (« lock-up ») signée par les fondateurs à l’occasion d’une IPO ?',
      options: [
        'Un blocage temporaire empêchant les cédants de vendre le reste',
        'Une garantie de prix plancher offerte par la BRVM pendant un an',
        'L’obligation faite au public de conserver ses titres dix ans',
        'L’interdiction de distribuer des dividendes pendant cinq exercices',
      ],
      correct: 0,
      explication: 'Le lock-up rassure les nouveaux actionnaires en évitant qu’un actionnaire majoritaire n’inonde le marché juste après l’introduction.',
    },
    {
      question: 'Quel coût spécifique faut-il intégrer lorsqu’une société prépare une introduction en bourse ?',
      options: [
        'Les honoraires des conseils, des auditeurs et de la SGI chef de file',
        'Le remboursement anticipé de l’ensemble de ses emprunts bancaires',
        'Le paiement préalable des dividendes futurs sur cinq années',
        'Une amende administrative perçue par les concurrents cotés',
      ],
      correct: 0,
      explication: 'L’audit, le montage juridique, le syndicat de placement et la communication financière représentent un coût initial significatif.',
    },
    {
      question: 'Une fois l’action admise sur le marché secondaire, comment évolue son cours par rapport au prix fixe de l’offre publique ?',
      options: [
        'Il se fixe librement selon la confrontation des ordres quotidiens',
        'Il reste bloqué au prix de souscription durant douze mois complets',
        'Il progresse mécaniquement du taux d’intérêt directeur de la BCEAO',
        'Il est recalculé une fois par an par l’AMF-UMOA après l’assemblée',
      ],
      correct: 0,
      explication: 'Dès la première cotation, le prix résulte uniquement de l’offre et de la demande dans le carnet d’ordres de la BRVM.',
    },
  ],
  'niveau4/l05-procedure.json': [
    {
      question: 'Dans le montage d’une introduction en bourse, que signifie un syndicat de placement agissant en « prise ferme » ou « garantie de bonne fin » ?',
      options: [
        'Le syndicat s’engage à souscrire les titres éventuellement invendus',
        'Les acheteurs particuliers promettent de ne jamais revendre leurs parts',
        'La BRVM garantit que le cours doublera dès la première séance',
        'L’État s’engage à racheter l’entreprise en cas de baisse du bénéfice',
      ],
      correct: 0,
      explication: 'Contrairement au placement pour compte (« best efforts »), l’engagement de garantie sécurise la levée pour l’émetteur.',
    },
    {
      question: 'Quelle section d’une note d’information visée mérite en priorité une lecture attentive pour identifier ce qui pourrait fragiliser l’opération ?',
      options: [
        'La rubrique consacrée aux facteurs de risque et à l’usage des fonds',
        'La page de couverture mentionnant le nom de l’imprimeur officiel',
        'L’adresse postale des succursales bancaires recevant les bulletins',
        'Le calendrier des jours fériés bancaires des dix prochains exercices',
      ],
      correct: 0,
      explication: 'Les facteurs de risque, la méthode de valorisation et la destination précise des capitaux éclairent le profil réel de l’IPO.',
    },
    {
      question: 'Que vérifie concrètement le visa apposé par l’AMF-UMOA sur la note d’information ?',
      options: [
        'Que l’information présentée est complète, cohérente et compréhensible',
        'Que le prix d’introduction retenu est mathématiquement sous-évalué',
        'Que la société versera à coup sûr un dividende dès l’année suivante',
        'Que le titre sera automatiquement intégré au BRVM 30 dès le premier jour',
      ],
      correct: 0,
      explication: 'Le visa porte sur la qualité et la sincérité de l’information divulguée ; il ne constitue jamais une appréciation d’opportunité financière.',
    },
    {
      question: 'Pourquoi la période de centralisation des ordres prend-elle plusieurs jours entre la clôture de l’offre et la première cotation ?',
      options: [
        'Pour agréger toutes les demandes des SGI et appliquer les allocations',
        'Pour laisser le temps aux dirigeants de modifier le prix de l’offre',
        'Pour verser un premier acompte sur dividende avant même l’ouverture',
        'Pour convertir l’ensemble des ordres en devises étrangères hors UEMOA',
      ],
      correct: 0,
      explication: 'Le chef de file consolide les souscriptions du réseau, calcule la réduction éventuelle et transmet les titres attribués au DC/BR.',
    },
    {
      question: 'Lorsque votre ordre de souscription est réduit de moitié dans une offre sursouscrite, qu’advient-il de la somme versée en trop à votre SGI ?',
      options: [
        'Le reliquat de trésorerie est restitué sur votre compte espèces',
        'La différence est conservée par la BRVM à titre de commission fixe',
        'Le montant est converti automatiquement en actions d’une autre banque',
        'La somme reste bloquée pendant cinq ans sans produire aucun intérêt',
      ],
      correct: 0,
      explication: 'Vous ne réglez finalement que les titres effectivement servis ; l’excédent bloqué lors de la souscription vous est débloqué.',
    },
  ],
};

for (const [rel, simSpec] of Object.entries(N4_SIMS)) {
  const j = readJson(rel);
  j.sections[simSpec.sectionIdx].simulation = simSpec.simulation;
  j.nouveaute = { type: 'mis_a_jour', depuis: TODAY };
  writeJson(rel, j);
}

// Mettre aussi l04 à jour proprement
{
  const l04 = readJson('niveau4/l04-pourquoi-bourse.json');
  l04.nouveaute = { type: 'mis_a_jour', depuis: TODAY };
  writeJson('niveau4/l04-pourquoi-bourse.json', l04);
}

for (const [rel, extra] of Object.entries(N4_EXTRA_QUIZ)) {
  const j = readJson(rel);
  // Conserver intactes les 5 questions existantes (invariants L4[1]='142 %', L4[2]='Environ 70 %', L5[3]='500', qcm=quiz[0])
  j.quiz = [...j.quiz.slice(0, 5), ...extra];
  writeJson(rel, j);
}

// ── 3. Vérification locale des métriques avant écriture SQL ────────────────
const n4Files = ['l01-architecture.json', 'l02-integrite.json', 'l03-compartiments.json', 'l04-pourquoi-bourse.json', 'l05-procedure.json'];
let n4TotalQ = 0;
let longestRight = 0;
let totalAllQ = 0;
for (const f of n4Files) {
  const j = readJson(`niveau4/${f}`);
  n4TotalQ += j.quiz.length;
  const hasSim = j.sections.some((s) => s.simulation || (s.simulations && s.simulations.length > 0));
  if (!hasSim) throw new Error(`${f} n'a pas de simulateur`);
  console.log(`N4 ${f}: ${j.quiz.length} questions, sim=${hasSim}, exercice=${j.exercice_id ?? '-'}`);
}

for (const dir of ['', 'niveau2', 'niveau3', 'niveau4']) {
  const full = path.join(CONTENUS, dir);
  for (const f of fs.readdirSync(full).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(full, f), 'utf8'));
    for (const q of j.quiz ?? []) {
      totalAllQ += 1;
      const lenRight = q.options[q.correct].length;
      const maxOther = Math.max(...q.options.filter((_, idx) => idx !== q.correct).map((o) => o.length));
      if (lenRight > maxOther) longestRight += 1;
    }
  }
}
const ratio = (longestRight / totalAllQ) * 100;
console.log(`Total N4 questions: ${n4TotalQ} | Global longest-right ratio: ${longestRight}/${totalAllQ} (${ratio.toFixed(1)} %)`);
if (n4TotalQ !== 52) throw new Error(`Attendu 52 questions N4, obtenu ${n4TotalQ}`);
if (ratio >= 38) throw new Error(`Ratio bonne réponse la plus longue trop élevé (${ratio.toFixed(1)} %)`);

// ── 4. Génération de la migration 0270_academy_expert_live_covers.sql ──────
const sqlLines = [
  '-- ══════════════════════════════════════════════════════════════════════════════',
  '-- 0270_academy_expert_live_covers.sql',
  '-- Lots #1 + #2 + #3 :',
  '--  1) Couvertures SVG éditoriales sur les Niveaux 2, 3 et 4',
  '--  2) Rattachement de `exercice_id` (exercices live BRVM) sur les Niveaux 1 à 4',
  '--  3) Enrichissement du Niveau 4 : simulateurs 5/5 + 52 questions de quiz',
  '--  4) Synchronisation idempotente de academy_exam_questions (debutant M1 + expert)',
  `-- Généré par frontend/scripts/academy-lot-1-2-3.mjs le ${TODAY}`,
  '-- ══════════════════════════════════════════════════════════════════════════════',
  '',
  'BEGIN;',
  '',
  'DO $$',
  'DECLARE',
  '  v_content jsonb;',
  'BEGIN',
  '  -- 1. Couvertures des parcours Niveaux 2, 3 et 4',
  "  UPDATE public.academy_courses",
  `  SET content = jsonb_set(content, '{coverUrl}', '"/academy/cover-niveau-2-fondamental.svg"'::jsonb, true), updated_at = now()`,
  "  WHERE slug = 'academy-niveau-2-fondamental';",
  '',
  "  UPDATE public.academy_courses",
  `  SET content = jsonb_set(content, '{coverUrl}', '"/academy/cover-niveau-3-technique.svg"'::jsonb, true), updated_at = now()`,
  "  WHERE slug = 'academy-niveau-3-technique';",
  '',
  "  UPDATE public.academy_courses",
  `  SET content = jsonb_set(content, '{coverUrl}', '"/academy/cover-niveau-4-expert.svg"'::jsonb, true), updated_at = now()`,
  "  WHERE slug = 'academy-niveau-4-expert';",
  '',
  '  -- 2. Mise à jour complète des 5 leçons du Niveau 4 (simulateurs + quiz 52Q + exercice_id L4)',
  "  SELECT content INTO v_content FROM public.academy_courses WHERE slug = 'academy-niveau-4-expert' FOR UPDATE;",
  "  IF v_content IS NULL THEN RAISE EXCEPTION 'Cours academy-niveau-4-expert introuvable'; END IF;",
];

n4Files.forEach((f, idx) => {
  const j = readJson(`niveau4/${f}`);
  const prefix = `Leçon ${idx + 1} — `;
  const jsonStr = JSON.stringify(j);
  sqlLines.push(
    `  IF NOT ((v_content->'lessons'->${idx}->>'titre') LIKE '${prefix}%') THEN`,
    `    RAISE EXCEPTION 'Migration 0270 : N4 position ${idx} inattendue (%)', v_content->'lessons'->${idx}->>'titre';`,
    `  END IF;`,
    `  v_content := jsonb_set(v_content, '{lessons,${idx}}', (v_content->'lessons'->${idx}) || ${sqlDollar(`n4_l${idx + 1}`, jsonStr)}::jsonb, true);`,
  );
});

sqlLines.push(
  "  UPDATE public.academy_courses SET content = v_content, updated_at = now() WHERE slug = 'academy-niveau-4-expert';",
  '',
  '  -- 3. Rattachement exercice_id sur Niveaux 1, 2 et 3',
);

const bySlug = new Map();
for (const item of EXERCICE_MAP.filter((x) => x.slug !== 'academy-niveau-4-expert')) {
  if (!bySlug.has(item.slug)) bySlug.set(item.slug, []);
  bySlug.get(item.slug).push(item);
}

for (const [slug, items] of bySlug.entries()) {
  sqlLines.push(
    `  SELECT content INTO v_content FROM public.academy_courses WHERE slug = '${slug}' FOR UPDATE;`,
    `  IF v_content IS NULL THEN RAISE EXCEPTION 'Cours ${slug} introuvable'; END IF;`,
  );
  for (const item of items) {
    sqlLines.push(
      `  IF NOT ((v_content->'lessons'->${item.idx}->>'titre') LIKE '${item.prefix}%') THEN`,
      `    RAISE EXCEPTION 'Migration 0270 : ${slug} position ${item.idx} inattendue (%)', v_content->'lessons'->${item.idx}->>'titre';`,
      `  END IF;`,
      `  v_content := jsonb_set(v_content, '{lessons,${item.idx},exercice_id}', '"${item.id}"'::jsonb, true);`,
    );
  }
  sqlLines.push(`  UPDATE public.academy_courses SET content = v_content, updated_at = now() WHERE slug = '${slug}';`, '');
}

sqlLines.push('END $$;', '');

// 4. Questions d'examen : Module 1 Débutant + Niveau 4 Expert (52 questions)
const examRows = [];
for (const rel of ['lecon1-brvm.json', 'lecon2-acteurs.json', 'lecon3-budget.json', 'lecon4-gagner.json']) {
  const j = readJson(rel);
  for (const q of j.quiz) {
    examRows.push({ niveau: 'debutant', ...q });
  }
}
for (const rel of n4Files) {
  const j = readJson(`niveau4/${rel}`);
  for (const q of j.quiz) {
    examRows.push({ niveau: 'expert', ...q });
  }
}

sqlLines.push(
  '-- 4. Synchronisation idempotente de academy_exam_questions (debutant Module 1 + expert 52 Q)',
  'INSERT INTO public.academy_exam_questions (niveau, question, options, correct, explication, source, active)',
  "SELECT v.niveau, v.question, v.options, v.correct, v.explication, 'quiz', true",
  'FROM (VALUES',
);

const valuesSql = examRows.map((r, i) => {
  const niv = sqlDollar(`q_n_${i}`, r.niveau);
  const que = sqlDollar(`q_q_${i}`, r.question);
  const opt = `${sqlDollar(`q_o_${i}`, JSON.stringify(r.options))}::jsonb`;
  const exp = sqlDollar(`q_e_${i}`, r.explication);
  return `  (${niv}, ${que}, ${opt}, ${r.correct}, ${exp})`;
});

sqlLines.push(valuesSql.join(',\n'));
sqlLines.push(
  ') AS v(niveau, question, options, correct, explication)',
  'WHERE NOT EXISTS (',
  '  SELECT 1 FROM public.academy_exam_questions existing',
  '  WHERE existing.active AND existing.niveau = v.niveau AND existing.question = v.question',
  ');',
  '',
  'COMMIT;',
  '',
);

fs.writeFileSync(MIGRATION_PATH, sqlLines.join('\n'), 'utf8');
console.log(`Migration écrite : ${MIGRATION_PATH} (${examRows.length} questions vérifiées)`);
