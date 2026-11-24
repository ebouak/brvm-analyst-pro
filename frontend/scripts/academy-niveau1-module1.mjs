/**
 * Génère les 4 leçons enrichies du Niveau 1 — Module 1 (Comprendre la Bourse BRVM)
 * à partir de l'instantané réel figé `sources/niveau1-module1-2026-11-24.json`,
 * puis produit la migration idempotente `supabase/migrations/0268_academy_niveau1_module1.sql`.
 *
 * Exécution : node frontend/scripts/academy-niveau1-module1.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CONTENUS = path.join(ROOT, 'frontend', 'lib', 'academy', 'contenus');
const SOURCE_PATH = path.join(CONTENUS, 'sources', 'niveau1-module1-2026-11-24.json');
const MIGRATION_PATH = path.join(ROOT, 'supabase', 'migrations', '0268_academy_niveau1_module1.sql');

const src = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
const ent = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const fr1 = (n) => Number(n).toFixed(1).replace('.', ',');
const fr2 = (n) => Number(n).toFixed(2).replace('.', ',');

const MODULE_1 = 'Module 1 : Comprendre la Bourse BRVM';
const NOUVEAUTE = { type: 'mis_a_jour', depuis: '2026-11-24' };

// Helper pour lire des valeurs exactes depuis la source figée
const { marche, liquidite_65_seances: liq, indices_2026: idx26, sgi, ftsc_detachement_2025: ftsc, performance_5_ans_2021_2026: perf5 } = src;
const byCode = (arr, code) => arr.find((x) => x.code === code);
const sntsCap = byCode(marche.top_capitalisations, 'SNTS');
const oracCap = byCode(marche.top_capitalisations, 'ORAC');
const sgbcCap = byCode(marche.top_capitalisations, 'SGBC');
const etitCap = byCode(marche.top_capitalisations, 'ETIT');
const unlcCap = byCode(marche.exemples_cours_vs_cap, 'UNLC');
const ciecCap = byCode(marche.exemples_cours_vs_cap, 'CIEC');

const partDeuxTelecoms = fr1(((sntsCap.cap_md + oracCap.cap_md) / marche.capitalisation_totale_md) * 100);
const partSntsCap = fr1((sntsCap.cap_md / marche.capitalisation_totale_md) * 100);
const sous5000 = marche.tranches_cours[0].nb + marche.tranches_cours[1].nb;

const idxMois = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
const idxLabels = ['Mai 26', 'Juin 26', 'Juil. 26', 'Août 26', 'Sept. 26', 'Oct. 26', '24 nov. 26'];

// ══════════════════════════════════════════════════════════════════════════════
// LEÇON 1 — Qu’est-ce que la BRVM et comment ça marche ?
// ══════════════════════════════════════════════════════════════════════════════
const lecon1 = {
  titre: 'Leçon 1 — Qu’est-ce que la BRVM et comment ça marche ?',
  module: MODULE_1,
  nouveaute: NOUVEAUTE,
  image: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/BRVM.jpg/960px-BRVM.jpg',
    alt: 'Bâtiment de la Bourse Régionale des Valeurs Mobilières (BRVM) à Abidjan',
    credit: 'Photo : Wikimedia Commons (BRVM, Abidjan)',
  },
  categorie: 'general',
  duree_min: 16,
  sous_titre: 'Une bourse unique pour huit pays, quarante-huit sociétés cotées, un carnet d’ordres quotidien et des règles qu’il faut connaître avant d’acheter.',
  resume: 'La BRVM est la bourse commune aux huit pays de l’UEMOA, opérationnelle depuis septembre 1998.\nCette leçon détaille son poids réel, la façon dont les prix se forment séance après séance, la concentration particulière de sa liquidité, le rôle exact des indices et la différence entre cours unitaire et capitalisation.',
  avertissement: 'Ceci n’est pas un conseil en investissement. Les performances passées ne préjugent pas des performances futures. Investir en actions comporte un risque de perte en capital.',
  sections: [
    {
      type: 'definition',
      titre: 'Une bourse commune à huit pays d’Afrique de l’Ouest',
      contenu: `La Bourse Régionale des Valeurs Mobilières (BRVM), dont le siège est à Abidjan, a démarré ses activités en septembre 1998. Elle remplace les bourses nationales par un marché unique partagé entre les huit États membres de l’UEMOA : Bénin, Burkina Faso, Côte d’Ivoire, Guinée-Bissau, Mali, Niger, Sénégal et Togo. Chaque pays dispose d’une Antenne Nationale de Bourse qui assure la liaison locale.\nUne même monnaie (le franc CFA), un même système de cotation électronique, un seul régulateur — l’Autorité des Marchés Financiers de l’UMOA (AMF-UMOA, qui a succédé au CREPMF) — et un dépositaire central commun (DC/BR) permettent à un résident de Dakar, Cotonou, Ouagadougou ou de la diaspora d’acheter indifféremment une banque ivoirienne ou un opérateur sénégalais.`,
      stats: [
        { label: 'Pays membres', valeur: '8 États', detail: 'Zone UEMOA, monnaie unique FCFA' },
        { label: 'Actions cotées', valeur: `${marche.nb_actions_cotees} sociétés`, detail: 'Relevé au 24 novembre 2026' },
        { label: 'Capitalisation actions', valeur: `${ent(marche.capitalisation_totale_md)} Md FCFA`, detail: 'Base WESTBOURSE au 24/11/2026' },
        { label: 'Rythme annuel', valeur: '247 à 259 séances', detail: 'Mesuré de 2021 à 2025 (~21 / mois)' },
      ],
      flux: [
        { titre: 'Une entreprise', detail: 'Elle ouvre son capital ou émet un emprunt pour financer sa croissance.', icone: 'entreprise' },
        { titre: 'La cote BRVM', detail: 'Son capital est découpé en actions négociées en séance publique.', icone: 'piece' },
        { titre: 'Des investisseurs', detail: 'Particuliers et institutions achètent ces parts via une SGI agréée.', icone: 'actionnaires' },
      ],
    },
    {
      type: 'importance',
      titre: 'Ce que représente vraiment la cote : secteurs et géants',
      contenu: `La BRVM n’est pas un miroir proportionnel de l’économie réelle ouest-africaine : certains secteurs y pèsent très lourd, d’autres en sont absents. Au 24 novembre 2026, les ${marche.nb_actions_cotees} actions cotées se répartissent en sept grands secteurs, dominés en nombre par les services financiers (17 sociétés, surtout des banques commerciales) et la consommation (16 sociétés au total).\nEn valeur boursière, la concentration est encore plus marquée : deux opérateurs télécoms, Sonatel (${ent(sntsCap.cap_md)} Md FCFA, soit ${partSntsCap} % de la cote) et Orange Côte d’Ivoire (${fr1(oracCap.cap_md)} Md FCFA), représentent à eux seuls ${partDeuxTelecoms} % de la capitalisation totale des actions. Comprendre cette structure évite de croire que le marché entier bouge uniformément.`,
      graphiques: [
        {
          type: 'bar',
          titre: 'Répartition des 48 actions cotées par secteur (24 novembre 2026)',
          labels: marche.par_secteur.map((x) => x.secteur),
          valeurs: marche.par_secteur.map((x) => x.nb),
          unite: ' titres',
          note: 'Source : base WESTBOURSE (référentiel BRVM, 24 novembre 2026). Les services financiers (17 valeurs) représentent plus d’un tiers des sociétés cotées, devant la consommation discrétionnaire et de base (8 chacune).',
          reel: true,
        },
      ],
      encadres: [
        {
          ton: 'info',
          titre: 'Marché actions et marché obligataire cohabitent à la BRVM',
          texte: 'La BRVM cote à la fois des actions d’entreprises et des obligations (emprunts d’États UEMOA, institutions régionales comme la BOAD ou la BIDC, et sociétés privées). Ce module 1 porte sur les actions ; les obligations sont traitées dans le niveau 2.',
        },
      ],
    },
    {
      type: 'definition',
      titre: 'Acheter une action : droits réels et absence de garantie',
      contenu: `Une action est un titre de propriété : elle représente une fraction du capital d’une entreprise réelle, pas un billet de loterie ni un dépôt rémunéré à taux fixe. En tant que copropriétaire, vous partagez à la fois les réussites de la société (bénéfices distribués, croissance de la valeur) et ses difficultés (baisse du cours, suppression du dividende, voire perte totale en cas de faillite).\nLa différence avec un compte d’épargne bancaire ou une obligation est fondamentale : un prêteur reçoit un intérêt prévu par contrat ; un actionnaire est rémunéré après tous les créanciers, sur ce qui reste du bénéfice.`,
      points: [
        { titre: 'Une part du bénéfice votée en assemblée', detail: 'Chaque année, l’assemblée générale décide s’il y a un dividende et fixe son montant. Il peut croître, stagner ou tomber à zéro.', verifier: 'l’historique des dividendes sur cinq exercices et le taux de distribution.' },
        { titre: 'Un droit de vote et d’information', detail: 'Vous pouvez participer aux assemblées générales et consulter les rapports annuels, comptes semestriels et communiqués d’activité publiés au Bulletin officiel.' },
        { titre: 'La faculté de revendre sur le marché secondaire', detail: 'Vous n’êtes pas bloqué jusqu’à la dissolution de l’entreprise : vous pouvez céder vos actions à un autre investisseur via votre SGI, au prix que le marché accepte ce jour-là.', verifier: 'le volume quotidien moyen de la valeur avant de vous engager.' },
        { titre: 'Aucune garantie sur le capital', detail: 'Ni la société, ni votre SGI, ni la BRVM ne garantissent que vous retrouverez votre mise de départ à la date de votre choix.' },
      ],
      tableau: {
        colonnes: ['Critère', 'Livret / dépôt bancaire', 'Obligation cotée', 'Action BRVM'],
        lignes: [
          ['Statut juridique', 'Déposant', 'Créancier (prêteur)', 'Copropriétaire (actionnaire)'],
          ['Revenu attendu', 'Intérêt fixé d’avance', 'Coupon défini dans le contrat', 'Dividende voté chaque année (variable)'],
          ['Capital à l’échéance', 'Garanti dans le cadre bancaire', 'Remboursé sauf défaut de l’émetteur', 'Aucune échéance, prix variable en séance'],
          ['Risque principal', 'Érosion par l’inflation', 'Défaut de l’émetteur ou hausse des taux', 'Baisse durable des résultats et du cours'],
        ],
        note: 'Comparer ces trois placements par leur nature juridique évite d’attendre d’une action la stabilité d’un livret.',
      },
    },
    {
      type: 'definition',
      titre: 'Anatomie d’une séance BRVM : du carnet au règlement J+3',
      contenu: `La BRVM fonctionne du lundi au vendredi (hors jours fériés communs ou ivoiriens), en cotation en continu. Les investisseurs ne négocient jamais en face à face : tous les ordres d’achat et de vente passent par les SGI agréées et s’empilent dans un carnet d’ordres électronique centralisé.\nLe prix d’une action change uniquement lorsqu’un ordre d’achat et un ordre de vente se rencontrent sur un prix compatible. Pour éviter les mouvements désordonnés sur un marché encore étroit, la BRVM encadre la variation quotidienne d’un titre à ±7,5 % autour de son cours de référence (sauf ajustement technique, par exemple le jour d’un détachement de dividende ou d’une division d’actions).`,
      etapes: [
        { titre: 'Pré-ouverture (accumulation des ordres)', detail: 'Les SGI saisissent les ordres dans le carnet avant l’ouverture ; aucun échange n’a encore lieu, un prix d’équilibre théorique se forme.' },
        { titre: 'Ouverture et cotation en continu', detail: 'Dès que le prix d’un acheteur croise celui d’un vendeur, la transaction s’exécute instantanément dans la limite des ±7,5 % par séance.', cle: true },
        { titre: 'Clôture et cours de référence', detail: 'En fin de séance, le dernier cours négocié devient le cours de clôture officiel de la journée.' },
        { titre: 'Publication du BOC', detail: 'La BRVM diffuse chaque soir le Bulletin Officiel de la Cote : cours, variations, volumes, capitaux échangés et avis aux investisseurs.' },
        { titre: 'Règlement-livraison (J+3)', detail: 'Dans les trois jours ouvrés, le DC/BR échange les titres contre les espèces entre SGI ; votre compte-titres est définitivement mis à jour.' },
      ],
      etapes_style: 'frise',
      encadres: [
        {
          ton: 'cle',
          titre: 'Pourquoi certaines actions n’affichent 0 % de variation pendant plusieurs jours',
          texte: 'À la BRVM, une variation de 0 % ne signifie pas toujours que tout le monde est d’accord sur le prix : cela signifie souvent qu’aucune transaction n’a eu lieu durant la séance, faute d’accord entre acheteurs et vendeurs.',
        },
      ],
    },
    {
      type: 'importance',
      titre: 'La liquidité : le trait distinctif de la BRVM',
      contenu: `La liquidité mesure la facilité d’acheter ou de revendre une action rapidement sans faire décaler son prix. Sur les ${liq.periode.seances} séances comprises entre le 24 août et le 23 novembre 2026, ${fr1(liq.capitaux_totaux_md)} milliards de FCFA ont été échangés sur les ${marche.nb_actions_cotees} actions de la cote.\nMais ces échanges sont fortement concentrés : Sonatel (SNTS) capte à elle seule ${fr1(liq.part_snts_pct)} % des capitaux échangés, les cinq valeurs les plus actives en concentrent ${fr1(liq.part_top5_pct)} %, et les dix premières ${fr1(liq.part_top10_pct)} %. Les 38 autres sociétés se partagent les ${fr1(100 - liq.part_top10_pct)} % restants — certaines restent plusieurs séances sans un seul titre échangé.`,
      graphiques: [
        {
          type: 'bar',
          titre: 'Concentration des capitaux échangés sur 65 séances (24 août – 23 novembre 2026)',
          labels: ['Sonatel (n°1)', 'Rangs 2 à 5', 'Rangs 6 à 10', 'Les 38 autres actions'],
          valeurs: [
            liq.part_snts_pct,
            Math.round((liq.part_top5_pct - liq.part_snts_pct) * 10) / 10,
            Math.round((liq.part_top10_pct - liq.part_top5_pct) * 10) / 10,
            Math.round((100 - liq.part_top10_pct) * 10) / 10,
          ],
          unite: ' %',
          note: `Source : base WESTBOURSE (brvm_actions_daily, 65 séances du 24/08/2026 au 23/11/2026, total ${fr1(liq.capitaux_totaux_md)} Md FCFA sur 48 valeurs). Plus de 71 % des volumes passent par dix sociétés seulement.`,
          reel: true,
        },
      ],
      tableau: {
        colonnes: ['Rang', 'Valeur', 'Capitaux échangés (65 séances)', 'Part du marché'],
        lignes: liq.top5.map((x, i) => [
          `#${i + 1}`,
          `${x.code} — ${x.nom}`,
          `${fr2(x.capitaux_md)} Md FCFA`,
          `${fr1((x.capitaux_md / liq.capitaux_totaux_md) * 100)} %`,
        ]),
        note: 'Source : base WESTBOURSE, 24 août au 23 novembre 2026. Une forte liquidité facilite l’exécution des ordres sans écart de prix excessif.',
      },
    },
    {
      type: 'cas',
      reel: true,
      titre: 'Les indices, thermomètre du marché — et leur angle mort',
      contenu: `Un indice résume en un seul chiffre l’évolution d’un panier d’actions. Le BRVM Composite regroupe l’ensemble des actions cotées, pondérées par leur capitalisation boursière ; le BRVM 30 suit trente valeurs parmi les plus échangées du marché ; le BRVM Prestige réunit des sociétés répondant à des critères stricts de taille et de gouvernance.\nPoint essentiel : le BRVM Composite et le BRVM 30 sont des indices « nus », calculés uniquement sur les cours, sans intégrer les dividendes versés. Comme beaucoup d’entreprises de la BRVM distribuent des dividendes significatifs, l’indice sous-estime structurellement le rendement total obtenu par un actionnaire qui conserve ses titres.`,
      donnees_reelles: { vue: 'indices', codes: ['BRVMC', 'BRVM30'] },
      graphiques: [
        {
          type: 'line',
          titre: 'Évolution mensuelle du BRVM Composite et du BRVM 30 (mai – novembre 2026)',
          labels: idxLabels,
          series: [
            { nom: 'BRVM Composite (axe gauche)', valeurs: idxMois.map((m) => idx26.BRVMC[m].valeur), axe: 'gauche' },
            { nom: 'BRVM 30 (axe droite)', valeurs: idxMois.map((m) => idx26.BRVM30[m].valeur), axe: 'droite' },
          ],
          unite: ' pts',
          unite_droite: ' pts',
          note: 'Source : base WESTBOURSE (brvm_indices_daily, clôtures de fin de mois de mai à octobre 2026 et séance du 24/11/2026). Après un sommet à 548,38 points fin septembre, le BRVM Composite a corrigé à 472,04 points : la bourse alterne hausses et replis.',
          reel: true,
        },
      ],
      encadres: [
        {
          ton: 'attention',
          titre: 'Un indice ne monte jamais en ligne droite',
          texte: 'Entre le 30 septembre 2026 (548,38 pts) et le 24 novembre 2026 (472,04 pts), le BRVM Composite a reculé de 13,9 % en moins de deux mois. Ces respirations font partie de la vie normale d’un marché actions.',
        },
      ],
    },
    {
      type: 'cas',
      reel: true,
      titre: 'Cours unitaire contre capitalisation : ce que le prix ne dit pas',
      contenu: `Une confusion très répandue chez les débutants consiste à croire qu’une action à 52 FCFA est « moins chère » ou « plus petite » qu’une action à 42 000 FCFA. En réalité, le prix d’une action isolée ne dit rien sans le nombre total d’actions qui composent le capital de la société.\nAu 24 novembre 2026, ETI Togo (ETIT) cote ${etitCap.cours} FCFA par titre mais compte plus de 18 milliards d’actions : sa capitalisation atteint ${fr1(etitCap.cap_md)} Md FCFA, la 4e plus grande de la BRVM. À l’inverse, Unilever CI (UNLC) cote ${ent(unlcCap.cours)} FCFA — plus de 800 fois plus cher au titre — pour une capitalisation de ${fr1(unlcCap.cap_md)} Md FCFA, soit 2,4 fois moins qu’ETIT.`,
      donnees_reelles: { vue: 'cours', codes: ['SNTS', 'ORAC', 'SGBC', 'CIEC', 'TTLC', 'ETIT'] },
      formules: [
        { nom: 'Capitalisation boursière', expression: 'Cours de l’action × Nombre total d’actions émises', exemple: `ETIT (24/11/2026) : 52 FCFA × 18,08 Md d’actions ≈ ${fr1(etitCap.cap_md)} Md FCFA` },
      ],
      tableau: {
        colonnes: ['Code', 'Société', 'Cours (24/11/2026)', 'Capitalisation', 'Ce qu’on observe'],
        lignes: [
          ['ETIT', 'ETI Togo (Ecobank)', `${etitCap.cours} FCFA`, `${fr1(etitCap.cap_md)} Md FCFA`, 'Prix le plus bas, mais 4e poids du marché'],
          ['SNTS', 'Sonatel Sénégal', `${ent(sntsCap.cours)} FCFA`, `${ent(sntsCap.cap_md)} Md FCFA`, 'Prix intermédiaire, n°1 de la BRVM'],
          ['CIEC', 'CIE Côte d’Ivoire', `${ent(ciecCap.cours)} FCFA`, `${fr1(ciecCap.cap_md)} Md FCFA`, 'Cours proche de SNTS, capitalisation 16× moindre'],
          ['ORAC', 'Orange Côte d’Ivoire', `${ent(oracCap.cours)} FCFA`, `${fr1(oracCap.cap_md)} Md FCFA`, 'N°2 de la cote par la capitalisation'],
          ['SGBC', 'Société Générale CI', `${ent(sgbcCap.cours)} FCFA`, `${fr1(sgbcCap.cap_md)} Md FCFA`, '1re banque cotée en capitalisation'],
          ['UNLC', 'Unilever Côte d’Ivoire', `${ent(unlcCap.cours)} FCFA`, `${fr1(unlcCap.cap_md)} Md FCFA`, 'Prix unitaire le plus élevé, taille bien inférieure à ETIT'],
        ],
        note: 'Source : base WESTBOURSE au 24 novembre 2026. Comparer des actions par leur cours unitaire n’a aucun sens économique.',
      },
    },
    {
      type: 'cas',
      titre: 'Observer un cours réel sur plusieurs horizons',
      contenu: `Regarder la variation d’une action sur une seule journée donne souvent une impression trompeuse : un titre peut baisser sur une semaine tout en progressant nettement sur un an, ou inversement.\nUtilisez le simulateur ci-dessous pour comparer l’évolution réelle de cinq valeurs majeures de la BRVM sur plusieurs fenêtres de séances. Une série passée décrit ce qui s’est produit ; elle ne prédit jamais la suite.`,
      simulation: {
        type: 'technique',
        consigne: 'Sélectionnez une valeur réelle de la BRVM et observez comment son comportement change selon le nombre de séances affichées.',
        indicateur: 'variation',
        codes: ['SNTS', 'SGBC', 'ORAC', 'CIEC', 'ETIT'],
      },
    },
    {
      type: 'piege',
      titre: 'Cinq erreurs classiques de débutant à la BRVM',
      contenu: `La plupart des déceptions des premiers mois ne viennent pas d’un manque de mathématiques financières, mais de cinq réflexes évitables.`,
      points: [
        { titre: 'Chercher un gain rapide sur quelques semaines', detail: 'Entre les frais d’aller-retour et les variations quotidiennes imprévisibles, le court terme joue contre le particulier. Les actions se conçoivent sur plusieurs années.' },
        { titre: 'Placer de l’argent nécessaire à court terme', detail: 'Loyer, frais de scolarité, fonds d’urgence : cet argent n’a pas sa place en bourse. Devoir vendre pendant un repli de 15 % transforme une baisse passagère en perte définitive.' },
        { titre: 'Ignorer la liquidité d’une petite valeur', detail: 'Sur un titre qui s’échange quelques dizaines de fois par mois, un ordre urgent peut rester bloqué plusieurs jours ou s’exécuter loin du dernier cours publié.', verifier: 'les capitaux échangés et le nombre de séances sans échange sur les derniers mois.' },
        { titre: 'Confondre cours bas et action bon marché', detail: 'Une action à 1 500 FCFA peut être très chère par rapport à ses bénéfices, alors qu’une action à 35 000 FCFA peut être raisonnablement valorisée.' },
        { titre: 'Passer par un intermédiaire non agréé', detail: 'Seules les SGI agréées par l’AMF-UMOA ont accès au système de cotation de la BRVM. Tout autre intermédiaire qui collecte vos fonds agit hors la loi.', verifier: 'la présence de la société sur la liste officielle publiée par l’AMF-UMOA.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'L’essentiel à retenir',
      contenu: `Six repères fondamentaux avant de passer à l’étude des acteurs du marché.`,
      points: [
        { titre: 'Un marché unique pour 8 pays', detail: 'La BRVM réunit toute l’UEMOA depuis 1998, en FCFA, sous la supervision de l’AMF-UMOA.' },
        { titre: '48 actions, une cote concentrée', detail: 'Banques, consommation et télécoms dominent ; Sonatel concentre plus de 40 % des échanges sur 65 séances fin 2026.' },
        { titre: 'Une action = copropriété sans garantie', detail: 'Droits au dividende voté, au vote en AG et à la revente, mais risque de perte en capital.' },
        { titre: 'Un prix formé par l’offre et la demande', detail: 'Cotation en continu, variation plafonnée à ±7,5 % par séance hors ajustement technique, livraison en J+3.' },
        { titre: 'Indices nus hors dividendes', detail: 'BRVM Composite et BRVM 30 mesurent les cours seuls : ils ne comptabilisent pas les dividendes distribués.' },
        { titre: 'Ne jamais juger une société à son seul cours', detail: 'C’est la capitalisation (cours × nombre de titres) qui mesure la taille boursière d’une entreprise.' },
      ],
    },
  ],
  chart: null,
  charts: [],
  quiz: [
    {
      question: 'Combien de pays partagent la BRVM ?',
      options: ['Trois pays', 'Cinq pays', 'Huit pays', 'Quinze pays'],
      correct: 2,
      explication: 'La BRVM est commune aux huit pays de l’UEMOA : Bénin, Burkina Faso, Côte d’Ivoire, Guinée-Bissau, Mali, Niger, Sénégal et Togo.',
    },
    {
      question: 'Qui supervise le marché financier régional et agrée les intermédiaires ?',
      options: ['La BRVM elle-même', 'L’AMF-UMOA', 'Chaque SGI en autonomie', 'Les banques centrales nationales'],
      correct: 1,
      explication: 'L’Autorité des Marchés Financiers de l’UMOA (qui a succédé au CREPMF) agrée les intermédiaires, contrôle le marché et protège les investisseurs.',
    },
    {
      question: 'Pour acheter une action cotée à la BRVM, par qui un particulier doit-il obligatoirement passer ?',
      options: ['Directement par le site de la BRVM', 'Par une SGI agréée', 'Par le siège de la société cotée', 'Par un groupe de conseil sur messagerie'],
      correct: 1,
      explication: 'Seules les Sociétés de Gestion et d’Intermédiation agréées ont accès au système de cotation de la BRVM pour transmettre vos ordres.',
    },
    {
      question: 'Le BRVM Composite termine une année exactement à 0 %. Les actionnaires ont-ils forcément gagné 0 % ?',
      options: ['Oui, l’indice inclut tous les gains', 'Non : il ignore les dividendes', 'Non : il exclut les valeurs ivoiriennes', 'Oui, sauf en cas de hausse des taux'],
      correct: 1,
      explication: 'Le BRVM Composite et le BRVM 30 sont des indices de prix nus : les dividendes versés par les entreprises n’y entrent pas.',
    },
    {
      question: 'Lequel de ces droits une action ne donne-t-elle PAS ?',
      options: ['Voter en assemblée générale', 'Percevoir le dividende voté', 'Revendre ses titres en séance', 'Un revenu garanti chaque année'],
      correct: 3,
      explication: 'Le dividende dépend des bénéfices et du vote annuel de l’assemblée générale : il n’est jamais garanti.',
    },
    {
      question: 'Quelle est la limite habituelle de variation du cours d’une action au cours d’une même séance BRVM (hors ajustement technique) ?',
      options: ['±7,5 %', '±2,0 %', '±25,0 %', 'Aucune limite'],
      correct: 0,
      explication: 'La BRVM encadre la variation quotidienne à ±7,5 % autour du cours de référence pour amortir les chocs sur un marché étroit.',
    },
    {
      question: 'Une action A cote 52 FCFA et une action B cote 42 000 FCFA. Que peut-on en déduire sur la taille des deux entreprises ?',
      options: ['L’entreprise B est forcément plus grande', 'L’entreprise A est en difficulté financière', 'Rien sans connaître leur nombre d’actions', 'L’action A est huit cents fois moins chère à l’achat'],
      correct: 2,
      explication: 'La taille boursière est la capitalisation (cours × nombre d’actions). Au 24/11/2026, ETIT à 52 FCFA vaut 940,4 Md FCFA contre 385,7 Md FCFA pour UNLC à 42 000 FCFA.',
    },
    {
      question: 'Dans quel délai habituel s’effectue le règlement-livraison (échange titres contre espèces) après une exécution à la BRVM ?',
      options: ['Instantanément dans la minute', 'En trois jours ouvrés (J+3)', 'À la fin de chaque mois civil', 'Après la prochaine assemblée générale'],
      correct: 1,
      explication: 'Le dénouement titres contre espèces par le Dépositaire Central (DC/BR) intervient en J+3 ouvrés après la séance d’exécution.',
    },
    {
      question: 'Que révèle la mesure réelle de la liquidité à la BRVM sur fin 2026 ?',
      options: ['Les 48 titres s’échangent à parts égales', 'Les dix titres les plus actifs concentrent plus de 70 % des échanges', 'Seules les obligations sont réellement échangées', 'Aucune action ne dépasse 5 % des volumes'],
      correct: 1,
      explication: 'Sur 65 séances (24/08 au 23/11/2026), les 10 valeurs les plus échangées représentent 71,9 % des capitaux échangés (dont 40,9 % pour Sonatel seule).',
    },
    {
      question: 'Une action affiche 0 % de variation pendant trois séances d’affilée à la BRVM. Quelle est l’explication la plus fréquente ?',
      options: ['Son cours est figé par le régulateur', 'Aucun échange n’a eu lieu sur ces séances', 'La société prépare une fusion imminente', 'Les dividendes sont en cours de calcul'],
      correct: 1,
      explication: 'Sur les valeurs peu liquides, il arrive fréquemment qu’aucun ordre d’achat ne croise un ordre de vente durant une ou plusieurs séances : le cours reste alors inchangé.',
    },
  ],
  liens: [
    { label: 'Les indices et la séance du jour', href: '/dashboard' },
    { label: 'Les cours de toutes les actions', href: '/actions' },
    { label: 'Comparer les SGI agréées', href: '/comparateur-sgi' },
  ],
};
lecon1.qcm = lecon1.quiz[0];

// ══════════════════════════════════════════════════════════════════════════════
// LEÇON 2 — Les 4 acteurs clés du marché
// ══════════════════════════════════════════════════════════════════════════════
const PAYS_SGI_NOMS = { CI: 'Côte d’Ivoire', SN: 'Sénégal', BF: 'Burkina Faso', ML: 'Mali', BJ: 'Bénin', TG: 'Togo', NE: 'Niger' };
const sgiPaysEntries = Object.entries(sgi.annuaire_par_pays).sort((a, b) => b[1] - a[1]);

const lecon2 = {
  titre: 'Leçon 2 — Les 4 acteurs clés du marché',
  module: MODULE_1,
  nouveaute: NOUVEAUTE,
  image: {
    url: 'https://images.pexels.com/photos/18435332/pexels-photo-18435332.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    alt: 'Immeubles du Plateau, quartier des affaires d’Abidjan, vus depuis la lagune Ébrié',
    credit: 'Photo : Jean Marc Bonnel / Pexels',
  },
  categorie: 'regulatory',
  duree_min: 15,
  sous_titre: 'Qui organise les séances, qui contrôle, qui exécute vos ordres, qui protège vos titres — et comment éviter les faux courtiers.',
  resume: 'Quatre institutions encadrent chaque franc investi à la BRVM : la bourse (BRVM), le régulateur (AMF-UMOA), votre intermédiaire (SGI) et le dépositaire central (DC/BR).\nCette leçon détaille leurs missions exactes, la protection de vos titres en cas de défaillance d’une SGI, l’écosystème réel des SGI dans l’UEMOA, le parcours de résolution d’un incident et les réflexes anti-escroquerie.',
  avertissement: 'Ceci n’est pas un conseil en investissement. Les performances passées ne préjugent pas des performances futures. Investir en actions comporte un risque de perte en capital.',
  sections: [
    {
      type: 'definition',
      titre: 'L’architecture du marché : quatre piliers, zéro confusion',
      contenu: `Un marché financier sain sépare toujours celui qui organise les échanges, celui qui fait la police, celui qui parle au client et celui qui garde les titres. Cette séparation limite les conflits d’intérêts et protège l’épargnant.\nConfondre ces quatre acteurs fait perdre des semaines lorsqu’un incident survient — et ouvre surtout la porte aux escrocs qui se prétendent « représentants directs de la BRVM ».`,
      stats: [
        { label: 'Piliers institutionnels', valeur: '4 acteurs', detail: 'BRVM, AMF-UMOA, SGI, DC/BR' },
        { label: 'Annuaire SGI UEMOA', valeur: `${sgi.nb_sgi_annuaire} SGI`, detail: 'Réparties dans 7 pays de la zone' },
        { label: 'Grilles suivies', valeur: `${sgi.nb_homologuees_base} / ${sgi.nb_sgi_frais_base}`, detail: '34 grilles homologuées AMF-UMOA suivies' },
        { label: 'Dénouement sécurisé', valeur: 'J+3 ouvrés', detail: 'Livraison contre paiement via le DC/BR' },
      ],
      tableau: {
        colonnes: ['Acteur', 'Rôle principal', 'Ce qu’il fait pour vous', 'Quand le contacter ?'],
        lignes: [
          ['BRVM', 'Entreprise de marché', 'Organise les séances, diffuse les cours, les indices et le Bulletin officiel de la cote (BOC).', 'Jamais pour un compte client ; uniquement pour l’information publique.'],
          ['AMF-UMOA', 'Régulateur public', 'Agrée les SGI et SGO, vise les notes d’information, contrôle les acteurs et sanctionne les abus.', 'En dernier recours après réclamation écrite restée sans suite auprès de votre SGI, ou pour signaler une arnaque.'],
          ['SGI', 'Votre intermédiaire agréé', 'Ouvre compte-titres et compte espèces, transmet vos ordres, émet vos avis d’opéré et verse vos dividendes.', 'Toujours en premier pour toute opération, question fiscale ou anomalie de compte.'],
          ['DC/BR', 'Dépositaire central', 'Tient le registre central des titres dématérialisés et règle les échanges entre SGI (J+3).', 'Vous ne traitez pas directement avec lui : votre SGI est son point d’accès.'],
        ],
        note: 'L’AMF-UMOA a succédé au CREPMF : les décisions ou grilles tarifaires antérieures à la réforme mentionnent encore ce sigle.',
      },
    },
    {
      type: 'definition',
      titre: 'La BRVM et l’AMF-UMOA : l’organisateur et le gendarme',
      contenu: `Beaucoup d’investisseurs confondent la BRVM et le régulateur. La BRVM est une société anonyme chargée de l’infrastructure technique : elle exploite la plateforme de cotation, admet les sociétés à la cote, suspend une valeur en cas d’annonce majeure et publie chaque soir le Bulletin officiel.\nL’AMF-UMOA, qui a succédé au CREPMF, est l’autorité publique de tutelle. C’est elle qui délivre (ou retire) l’agrément d’une SGI, qui appose son visa sur les documents d’introduction en bourse ou d’augmentation de capital, qui homologue les grilles tarifaires et qui sanctionne les manquements ou les manipulations de cours.`,
      points: [
        { titre: 'Ce que garantit un visa AMF-UMOA', detail: 'Que la note d’information d’une opération (introduction, obligation, augmentation de capital) est complète et conforme aux règles de transparence — jamais que l’investissement sera rentable.' },
        { titre: 'Ce que garantit un agrément SGI', detail: 'Que l’intermédiaire dispose du capital minimum, des dirigeants habilités, du contrôle interne et de l’accès réglementé au système BRVM et au DC/BR.' },
        { titre: 'Le rôle des Antennes Nationales de Bourse (ANB)', detail: 'Présentes dans les huit capitales de l’UEMOA, elles informent le public local et accompagnent les entreprises candidates à la cote, mais n’exécutent pas d’ordres pour les particuliers.' },
      ],
      encadres: [
        {
          ton: 'cle',
          titre: 'Un visa du régulateur n’est jamais un label de performance',
          texte: 'La formule figure en tête de chaque prospectus visé par l’AMF-UMOA : le visa atteste de la qualité de l’information fournie, pas de l’opportunité financière de l’opération.',
        },
      ],
    },
    {
      type: 'definition',
      titre: 'La SGI et le DC/BR : votre guichet et votre coffre-fort',
      contenu: `Votre Société de Gestion et d’Intermédiation (SGI) est votre unique porte d’entrée pour acheter et vendre sur la BRVM. À l’ouverture, elle crée deux comptes liés : un compte-titres (qui recense vos quantités d’actions par société) et un compte espèces dédié (qui reçoit vos dépôts, règle vos achats et encaisse vos dividendes).\nDerrière votre SGI, le Dépositaire Central / Banque de Règlement (DC/BR) conserve l’enregistrement dématérialisé de tous les titres cotés de l’UEMOA. Il applique le principe de « livraison contre paiement » : aucun titre ne quitte un vendeur sans que l’argent correspondant soit simultanément transféré.`,
      encadres: [
        {
          ton: 'info',
          titre: 'Que deviennent mes actions si ma SGI fait faillite ?',
          texte: 'Les titres que vous achetez ne font pas partie du patrimoine propre de votre SGI : ils sont inscrits de manière ségréguée dans les livres du DC/BR. En cas de défaillance ou de retrait d’agrément d’une SGI, le régulateur et le DC/BR organisent le transfert des comptes-titres des clients vers une autre SGI agréée. Vos actions restent votre propriété.',
        },
      ],
    },
    {
      type: 'importance',
      titre: 'L’écosystème réel des SGI dans l’UEMOA (et les autres acteurs)',
      contenu: `L’annuaire recensé sur WESTBOURSE compte ${sgi.nb_sgi_annuaire} SGI actives réparties dans sept pays de l’UEMOA (plus la moitié sont établies en Côte d’Ivoire, pôle historique du siège de la BRVM, et six au Sénégal). Deux grandes familles coexistent : les SGI adossées à un groupe bancaire régional et les maisons indépendantes.\nRègle souvent méconnue : vous n’êtes pas obligé d’ouvrir un compte dans votre pays de résidence. Un investisseur malien, béninois ou résidant en Europe peut ouvrir un compte auprès d’une SGI ivoirienne ou sénégalaise qui accepte les ouvertures à distance, à condition de fournir ses justificatifs d’identité et d’origine des fonds (règles KYC).`,
      graphiques: [
        {
          type: 'bar',
          titre: `Implantation géographique des ${sgi.nb_sgi_annuaire} SGI recensées dans l’annuaire WESTBOURSE (2026)`,
          labels: sgiPaysEntries.map(([code]) => PAYS_SGI_NOMS[code] || code),
          valeurs: sgiPaysEntries.map(([, nb]) => nb),
          unite: ' SGI',
          note: `Source : annuaire des SGI agréées BRVM / base WESTBOURSE (2026, ${sgi.nb_sgi_annuaire} SGI recensées ; ${sgi.nb_sgi_frais_base} grilles suivies dont ${sgi.nb_homologuees_base} homologuées AMF-UMOA). La Guinée-Bissau est couverte via les SGI de la zone.`,
          reel: true,
        },
      ],
      tableau: {
        colonnes: ['Acteur complémentaire', 'Rôle précis sur le marché', 'Lien avec le particulier'],
        lignes: [
          ['Banque teneur de compte-conservateur (BTCC)', 'Peut conserver vos titres et gérer vos espèces en lien avec le DC/BR.', 'Votre banque habituelle si elle est agréée conservateur (l’exécution boursière reste confiée à une SGI).'],
          ['SGO (Société de Gestion d’OPCVM)', 'Gère des fonds communs (FCP, SICAV) investis en actions et/ou obligations BRVM.', 'Permet d’investir dans un panier diversifié géré par des professionnels, moyennant des frais de gestion.'],
          ['Émetteurs (sociétés cotées et États)', 'Publient leurs comptes, tiennent les assemblées générales et paient dividendes ou coupons.', 'Vous lisez leurs rapports financiers ; ils ne prennent jamais vos ordres de bourse.'],
        ],
        note: 'Tous ces acteurs sont agréés ou contrôlés dans le cadre réglementaire de l’AMF-UMOA.',
      },
    },
    {
      type: 'importance',
      titre: 'Le voyage d’un ordre, de votre demande à la livraison (J à J+3)',
      contenu: `Entre le moment où vous validez un achat et celui où les titres sont définitivement livrés, quatre maillons se coordonnent selon une mécanique stricte. Avant même de transmettre votre ordre, votre SGI vérifie que votre compte espèces contient assez d’argent pour couvrir le montant de l’achat et les frais (provision préalable).\nPour ouvrir ce compte au départ, la réglementation impose un dossier d’identification (pièce d’identité valide, justificatif de domicile, RIB bancaire et formulaire de connaissance client). Ce contrôle KYC protège le marché contre le blanchiment et sécurise vos retraits futurs vers votre seul compte bancaire personnel.`,
      flux: [
        { titre: 'Vous', detail: 'Vous transmettez un ordre (valeur, quantité, prix, validité) à votre SGI.', icone: 'decision' },
        { titre: 'Votre SGI', detail: 'Elle vérifie votre provision et injecte l’ordre dans le carnet électronique.', icone: 'entreprise' },
        { titre: 'La BRVM', detail: 'Le moteur de cotation apparie votre ordre avec une contrepartie compatible.', icone: 'graphique' },
        { titre: 'Le DC/BR', detail: 'À J+3, les espèces passent au vendeur et les titres sont inscrits à votre nom.', icone: 'paiement' },
      ],
      etapes: [
        { titre: 'J — Saisie et contrôle de provision', detail: 'Votre SGI bloque sur votre compte espèces le montant maximal de votre ordre d’achat (ou bloque les titres en cas de vente).' },
        { titre: 'J — Rencontre dans le carnet BRVM', detail: 'Si un vendeur accepte votre prix, l’ordre est exécuté (totalement ou partiellement) pendant la séance.', cle: true },
        { titre: 'J / J+1 — Avis d’opéré', detail: 'Votre SGI vous envoie un justificatif officiel détaillant la quantité, le cours exécuté et chaque ligne de frais.' },
        { titre: 'J+3 — Règlement-livraison au DC/BR', detail: 'Les fonds et les actions changent définitivement de main entre la SGI acheteuse et la SGI vendeuse.' },
      ],
      etapes_style: 'frise',
    },
    {
      type: 'cas',
      titre: 'Dans la salle des machines : voir la BRVM apparier un ordre',
      contenu: `Comment la BRVM décide-t-elle concrètement à quel prix votre ordre s’exécute ? Elle consulte les ordres en attente en face de vous (le carnet d’ordres) en commençant toujours par le meilleur prix disponible.\nTestez ci-dessous l’effet d’un ordre « à cours limité » face à un ordre « au mieux » : sur un carnet peu profond, acheter trop vite « au mieux » fait grimper votre prix moyen sur plusieurs niveaux. Vous pouvez aussi basculer sur un carnet réel publié au BOC.`,
      simulation: {
        type: 'carnet',
        niveaux: [
          { prix: 4250, quantite: 15 },
          { prix: 4300, quantite: 30 },
          { prix: 4400, quantite: 50 },
          { prix: 4550, quantite: 100 },
        ],
        quantite_defaut: 40,
        codes: ['SNTS', 'SGBC', 'CIEC'],
      },
    },
    {
      type: 'cas',
      titre: 'Incident pratique : dividende manquant ou litige, la bonne escalade',
      contenu: `Situation pédagogique : la date annoncée de paiement d’un dividende est passée depuis cinq jours ouvrés et rien n’apparaît sur votre relevé. Plutôt que d’écrire à la société cotée ou à la BRVM — qui n’ont pas accès à votre compte personnel —, suivez l’ordre exact d’escalade.\nGardez toujours une trace écrite (e-mail ou courrier daté) de vos échanges : c’est indispensable si le différend devait être porté devant le régulateur.`,
      etapes: [
        { titre: 'Distinguons détachement et paiement', detail: 'Vérifiez au calendrier BRVM que vous déteniez bien le titre avant la date de détachement, et que la date de mise en paiement (souvent quelques jours plus tard) est bien dépassée.' },
        { titre: 'Consulter le compte espèces, pas le compte-titres', detail: 'Les dividendes arrivent en francs CFA sur le compte espèces associé à votre compte-titres, après retenue fiscale à la source.' },
        { titre: 'Contacter votre chargé de clientèle SGI', detail: 'C’est votre interlocuteur unique : il vérifie la réception des fonds venant du DC/BR et leur imputation sur votre compte.', cle: true },
        { titre: 'Envoyer une réclamation écrite formelle à la SGI', detail: 'Sans réponse claire sous quelques jours, adressez une réclamation écrite à la direction de la SGI en joignant votre relevé de portefeuille.' },
        { titre: 'Saisir l’AMF-UMOA en dernier recours', detail: 'En cas de blocage persistant ou de manquement grave, vous pouvez saisir l’AMF-UMOA avec le dossier de vos échanges écrits.' },
      ],
      tableau: {
        colonnes: ['Situation rencontrée', 'Premier interlocuteur', 'Point à vérifier'],
        lignes: [
          ['Dividende non crédité après la date de paiement', 'Votre SGI', 'Date d’achat vs date de détachement ; relevé du compte espèces'],
          ['Erreur sur le montant des frais prélevés', 'Votre SGI', 'Avis d’opéré comparé à la grille tarifaire homologuée'],
          ['Volonté de changer de SGI sans vendre vos actions', 'Nouvelle SGI + ancienne SGI', 'Frais de transfert par ligne dans la grille de la SGI quittée'],
          ['Société cotée qui n’a pas publié ses comptes', 'Information publique BRVM / AMF-UMOA', 'Communiqués officiels publiés au Bulletin officiel de la cote'],
          ['Démarchage suspect sur WhatsApp ou Telegram', 'AMF-UMOA (vérification d’agrément)', 'Ne versez aucun franc ; vérifiez la liste officielle des SGI'],
        ],
        note: 'Le transfert de titres d’une SGI à une autre est un droit, mais vérifiez toujours le tarif de transfert par ligne avant d’ouvrir un compte.',
      },
    },
    {
      type: 'piege',
      titre: 'Guide anti-arnaques UEMOA : cinq signaux qui doivent vous stopper',
      contenu: `La popularité croissante de la BRVM attire des escrocs très actifs sur WhatsApp, Telegram, Facebook et TikTok. Ils usurpent parfois le logo de la BRVM, d’une banque ou d’une vraie SGI pour collecter de l’argent via Mobile Money ou cryptomonnaies. Cinq drapeaux rouges ne trompent pratiquement jamais.`,
      points: [
        { titre: 'Un rendement « garanti » ou démesuré', detail: '« 15 % par mois garantis sur la BRVM », « doubler votre mise en 30 jours » : aucune action cotée ne peut promettre cela. C’est la signature quasi certaine d’une chaîne de Ponzi.' },
        { titre: 'Un versement demandé sur un compte personnel ou Mobile Money privé', detail: 'Une SGI agréée reçoit vos fonds uniquement sur ses comptes bancaires professionnels dédiés à la clientèle, jamais sur le numéro personnel d’un « coach » ou d’un « gestionnaire ».' },
        { titre: 'Une urgence artificielle pour vous faire payer vite', detail: '« Offre valable jusqu’à minuit », « plus que trois places VIP » : une véritable SGI prend le temps de vous remettre la convention de compte et la grille tarifaire homologuée.' },
        { titre: 'Un intermédiaire introuvable sur la liste de l’AMF-UMOA', detail: 'Une belle page web ou un faux certificat PDF ne prouvent rien. Seule la liste officielle publiée par l’AMF-UMOA et la BRVM fait foi.', verifier: 'le nom légal exact, le siège et les coordonnées officielles de la SGI.' },
        { titre: 'Une gestion de compte confiée sans mandat écrit', detail: 'Ne donnez jamais vos identifiants de connexion SGI à un tiers. La gestion sous mandat est une activité strictement encadrée, régie par un contrat écrit avec une SGI agréée.' },
      ],
      encadres: [
        {
          ton: 'alerte',
          titre: 'Test de sécurité en 60 secondes avant le premier virement',
          texte: '1) Vérifiez le nom de la SGI sur le site officiel de la BRVM ou de l’AMF-UMOA. 2) Demandez la convention d’ouverture de compte et la grille tarifaire homologuée. 3) Vérifiez que le RIB bénéficiaire est bien au nom légal de la SGI, jamais d’un particulier.',
        },
      ],
    },
    {
      type: 'lexique',
      titre: 'Dix mots clés de l’écosystème boursier',
      contenu: `Ces dix termes reviennent sur vos conventions, vos avis d’opéré et le Bulletin officiel.`,
      points: [
        { titre: 'BRVM', detail: 'Bourse Régionale des Valeurs Mobilières : entreprise de marché commune aux huit pays de l’UEMOA.' },
        { titre: 'AMF-UMOA', detail: 'Autorité des Marchés Financiers de l’UMOA : régulateur public qui a succédé au CREPMF.' },
        { titre: 'SGI', detail: 'Société de Gestion et d’Intermédiation : intermédiaire agréé disposant du monopole de négociation à la BRVM.' },
        { titre: 'DC/BR', detail: 'Dépositaire Central / Banque de Règlement : teneur du registre central des titres et opérateur du règlement-livraison.' },
        { titre: 'Compte-titres', detail: 'Compte ouvert chez votre SGI (ou une BTCC) recensant les quantités d’actions et d’obligations que vous possédez.' },
        { titre: 'Compte espèces', detail: 'Compte en FCFA adossé au compte-titres : il finance vos achats et reçoit vos produits de vente et dividendes.' },
        { titre: 'Avis d’opéré', detail: 'Document officiel émis par votre SGI après chaque transaction exécutée (prix, quantité, courtage, commissions, taxes).' },
        { titre: 'BOC (Bulletin officiel de la cote)', detail: 'Publication quotidienne de la BRVM recensant les cours, volumes, indices et avis aux investisseurs.' },
        { titre: 'Règlement-livraison (J+3)', detail: 'Dénouement simultané des titres contre espèces au DC/BR trois jours ouvrés après la séance.' },
        { titre: 'SGO / OPCVM', detail: 'Société de Gestion d’Organismes de Placement Collectif : gère des fonds diversifiés (FCP, SICAV) accessibles aux particuliers.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'L’essentiel à retenir',
      contenu: `Cinq règles simples pour naviguer sereinement entre les acteurs du marché.`,
      points: [
        { titre: 'La BRVM organise, l’AMF-UMOA contrôle', detail: 'La première fait tourner les séances et publie le BOC ; la seconde agrée, vise, contrôle et sanctionne.' },
        { titre: 'Votre SGI est votre seul guichet', detail: 'Ouverture de compte, passage d’ordres, avis d’opéré, versement des dividendes et premier niveau de réclamation.' },
        { titre: 'Le DC/BR protège la propriété de vos titres', detail: 'Ségrégation des titres hors du bilan de la SGI et règlement simultané livraison contre paiement à J+3.' },
        { titre: 'Vous êtes libre de choisir votre SGI dans toute l’UEMOA', detail: 'Comparez les grilles tarifaires homologuées, les dépôts minimums et la qualité du service client.' },
        { titre: 'Aucune promesse de gain garanti n’existe en actions', detail: 'Vérifiez toujours l’agrément AMF-UMOA et ne virez jamais d’argent sur un compte personnel.' },
      ],
    },
  ],
  chart: null,
  charts: [],
  quiz: [
    {
      question: 'Votre dividende n’est pas arrivé cinq jours après la date de paiement. Qui contactez-vous en premier ?',
      options: ['La BRVM', 'L’AMF-UMOA', 'Votre SGI', 'La société cotée'],
      correct: 2,
      explication: 'Votre SGI tient votre compte-titres et votre compte espèces : elle seule peut vérifier l’imputation sur votre compte. L’AMF-UMOA n’intervient qu’en dernier recours.',
    },
    {
      question: 'Quel acteur agrée les SGI, homologue leurs tarifs et sanctionne les abus ?',
      options: ['La BRVM', 'L’AMF-UMOA', 'Le DC/BR', 'La société cotée'],
      correct: 1,
      explication: 'L’Autorité des Marchés Financiers de l’UMOA, qui a succédé au CREPMF, est le régulateur public du marché financier régional.',
    },
    {
      question: 'Quel est le rôle principal du DC/BR ?',
      options: ['Fixer le prix quotidien des actions', 'Tenir les titres et régler les échanges', 'Démarcher les épargnants particuliers', 'Voter les dividendes des entreprises'],
      correct: 1,
      explication: 'Le Dépositaire Central / Banque de Règlement tient le registre central dématérialisé et assure le règlement-livraison (titres contre espèces) à J+3.',
    },
    {
      question: 'Un « conseiller » vous propose sur WhatsApp un placement BRVM garanti à 15 % par mois via Mobile Money. Que faites-vous ?',
      options: ['Vous testez avec une petite somme', 'Vous refusez : c’est une arnaque', 'Vous demandez son attestation PDF', 'Vous négociez les frais d’entrée'],
      correct: 1,
      explication: 'Un gain élevé garanti et un versement hors compte professionnel d’une SGI agréée sont des signaux caractéristiques d’escroquerie.',
    },
    {
      question: 'Où sont juridiquement conservés les titres que vous achetez à la BRVM ?',
      options: ['Inscrits en compte-titres et enregistrés au DC/BR', 'Imprimés sur certificat papier envoyé par poste', 'Déposés dans les coffres de la société cotée', 'Fusionnés dans votre compte courant bancaire'],
      correct: 0,
      explication: 'Les titres sont dématérialisés : inscrits sur votre compte-titres chez votre SGI et enregistrés de façon ségréguée au DC/BR.',
    },
    {
      question: 'Que se passe-t-il pour vos actions si votre SGI fait faillite ou perd son agrément ?',
      options: ['Elles servent à rembourser les créanciers de la SGI', 'Vos titres restent votre propriété et sont transférés', 'La BRVM indemnise uniquement la moitié de leur valeur', 'Vous perdez définitivement vos droits aux dividendes'],
      correct: 1,
      explication: 'Grâce à la ségrégation des avoirs au DC/BR, vos titres ne font pas partie du bilan de la SGI : ils restent votre propriété et sont transférables vers une autre SGI agréée.',
    },
    {
      question: 'Que signifie un visa délivré par l’AMF-UMOA sur une note d’information d’introduction en bourse ?',
      options: ['Le régulateur garantit la hausse future du titre', 'L’information publiée est conforme et complète', 'L’État couvre les pertes éventuelles des souscripteurs', 'Les dividendes sont assurés pendant cinq exercices'],
      correct: 1,
      explication: 'Le visa porte uniquement sur la conformité et la transparence de l’information fournie au public, jamais sur la rentabilité future de l’opération.',
    },
    {
      question: 'Un résident du Mali ou de la diaspora européenne peut-il ouvrir un compte dans une SGI basée en Côte d’Ivoire ou au Sénégal ?',
      options: ['Non, seule une SGI de son pays de résidence est autorisée', 'Oui, la zone UEMOA forme un marché unique', 'Oui, mais uniquement pour souscrire à des emprunts publics', 'Non, sauf dérogation individuelle délivrée par la BRVM'],
      correct: 1,
      explication: 'Le marché est régional : vous pouvez choisir n’importe quelle SGI agréée de l’UEMOA qui accepte votre dossier et vos justificatifs d’identité.',
    },
    {
      question: 'Quel document officiel prouve le prix exact exécuté et le détail des frais payés après un ordre ?',
      options: ['Le Bulletin officiel de la cote du soir', 'L’avis d’opéré remis par votre SGI', 'Le rapport annuel de la société cotée', 'Le reçu bancaire de votre dernier virement'],
      correct: 1,
      explication: 'Après chaque exécution, votre SGI émet un avis d’opéré détaillant la quantité, le cours d’exécution, le courtage, les commissions de marché et les taxes.',
    },
    {
      question: 'Quel acteur gère des fonds collectifs diversifiés (FCP, SICAV) investis à la BRVM ?',
      options: ['Une SGO (Société de Gestion d’OPCVM)', 'Le Dépositaire Central (DC/BR)', 'Une Antenne Nationale de Bourse', 'Le greffe du tribunal de commerce'],
      correct: 0,
      explication: 'Les SGO agréées par l’AMF-UMOA créent et gèrent les OPCVM (FCP et SICAV) pour les épargnants qui souhaitent déléguer la sélection et la diversification.',
    },
  ],
  liens: [
    { label: 'Comparer les SGI agréées', href: '/comparateur-sgi' },
    { label: 'Le calendrier des dividendes', href: '/dividendes/calendrier' },
    { label: 'Le guide du débutant', href: '/debutant' },
  ],
};
lecon2.qcm = lecon2.quiz[0];

// ══════════════════════════════════════════════════════════════════════════════
// LEÇON 3 — Combien faut-il pour investir à la BRVM ?
// ══════════════════════════════════════════════════════════════════════════════
// Calcul exact du taux effectif aller-retour avec 1,5 % et minimum de 2 500 FCFA par ordre
const taillesOrdre = [10_000, 25_000, 50_000, 100_000, 200_000, 500_000];
const tauxAR = (montant, tauxPct = 1.5, minFcfa = 2500) => {
  const fraisUnSens = Math.max(montant * (tauxPct / 100), minFcfa);
  return { fraisUnSens: Math.round(fraisUnSens), fraisAR: Math.round(fraisUnSens * 2), pctAR: Math.round(((fraisUnSens * 2) / montant) * 1000) / 10 };
};

const lecon3 = {
  titre: 'Leçon 3 — Combien faut-il pour investir à la BRVM ?',
  module: MODULE_1,
  nouveaute: NOUVEAUTE,
  image: {
    url: 'https://images.pexels.com/photos/7491011/pexels-photo-7491011.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    alt: 'Mains posées sur une calculatrice, à côté d’un carnet de notes',
    credit: 'Photo : RDNE Stock project / Pexels',
  },
  categorie: 'evaluation',
  duree_min: 17,
  sous_titre: 'Prix réel des 48 actions, anatomie complète des frais de bourse, seuil de rentabilité et budgets concrets pour bien démarrer.',
  resume: 'La loi ne fixe aucun capital minimum pour acheter une action à la BRVM : on achète des titres entiers, au cours de la séance.\nCette leçon montre combien coûtent réellement les 48 actions de la cote, démontre comment le minimum de frais pénalise les trop petits ordres, compare trois budgets de départ (50 000, 250 000 et 1 000 000 FCFA) et propose trois simulateurs pour calibrer votre plan.',
  avertissement: 'Ceci n’est pas un conseil en investissement. Les performances passées ne préjugent pas des performances futures. Investir en actions comporte un risque de perte en capital.',
  sections: [
    {
      type: 'definition',
      titre: 'Aucun minimum légal : distinguer trois montants différents',
      contenu: `À la BRVM, on achète des actions entières — il n’existe pas de fractions d’action. Techniquement, une seule action suffit pour devenir actionnaire. Mais en pratique, trois montants bien distincts déterminent votre vrai ticket d’entrée : le cours unitaire de l’action choisie, le dépôt minimum éventuellement exigé par la SGI à l’ouverture, et le montant d’ordre nécessaire pour que les frais restent raisonnables.\nDans la base WESTBOURSE, sur les ${sgi.depot_renseigne_nb} SGI dont le dépôt minimum est renseigné, ${sgi.depot_zero_nb} n’en imposent aucun (0 FCFA), tandis que d’autres demandent de 50 000 FCFA jusqu’à ${ent(sgi.depot_max_fcfa)} FCFA. Ce critère se compare avant toute signature.`,
      stats: [
        { label: 'Minimum légal BRVM', valeur: '1 action', detail: 'Aucun plancher fixé par la bourse' },
        { label: 'Cours médian (48 titres)', valeur: `${ent(marche.cours_median_fcfa)} FCFA`, detail: 'Relevé au 24 novembre 2026' },
        { label: 'Titres sous 5 000 FCFA', valeur: `${sous5000} / ${marche.nb_actions_cotees}`, detail: 'Plus de la moitié de la cote' },
        { label: 'SGI sans dépôt minimum', valeur: `${sgi.depot_zero_nb} / ${sgi.depot_renseigne_nb}`, detail: 'Parmi les SGI à dépôt renseigné' },
      ],
      formules: [
        { nom: 'Coût total d’un achat', expression: 'Quantité × Cours exécuté + Frais d’achat', exemple: '10 × 2 500 + 1 % de frais = 25 250 FCFA' },
      ],
    },
    {
      type: 'importance',
      titre: 'Combien coûte une action à la BRVM ? La réalité des 48 titres',
      contenu: `L’idée que « la bourse est réservée aux millionnaires » ne résiste pas aux chiffres. Au 24 novembre 2026, ${sous5000} actions sur ${marche.nb_actions_cotees} — soit plus de la moitié de la cote — s’échangent à moins de 5 000 FCFA l’unité, et ${marche.tranches_cours[0].nb} titres coûtent moins de 2 000 FCFA. Le cours médian s’établit à ${ent(marche.cours_median_fcfa)} FCFA.\nSeules ${marche.tranches_cours[3].nb} sociétés dépassent 15 000 FCFA par titre (jusqu’à ${ent(marche.cours_max.cours)} FCFA pour ${marche.cours_max.code}). Le prix d’une action n’est donc pas un obstacle d’accès ; le vrai sujet est l’équilibre entre taille d’ordre, frais et diversification.`,
      graphiques: [
        {
          type: 'bar',
          titre: 'Répartition des 48 actions BRVM par tranche de cours (24 novembre 2026)',
          labels: marche.tranches_cours.map((x) => x.label),
          valeurs: marche.tranches_cours.map((x) => x.nb),
          unite: ' titres',
          note: `Source : base WESTBOURSE (brvm_actions_daily, clôture du 24/11/2026, 48 actions). Cours le plus bas : ${marche.cours_min.code} (${marche.cours_min.cours} FCFA) ; cours médian : ${ent(marche.cours_median_fcfa)} FCFA ; cours le plus haut : ${marche.cours_max.code} (${ent(marche.cours_max.cours)} FCFA).`,
          reel: true,
        },
      ],
      encadres: [
        {
          ton: 'attention',
          titre: 'Attention au piège du « petit prix = bonne affaire »',
          texte: `Acheter 100 actions à 500 FCFA plutôt que 2 actions à 25 000 FCFA engage exactement la même somme (50 000 FCFA) et n’offre aucun avantage mathématique. Si les deux titres gagnent 10 %, votre gain est de 5 000 FCFA dans les deux cas.`,
        },
      ],
    },
    {
      type: 'cas',
      reel: true,
      titre: 'Sur la BRVM : ce que coûtent 10 actions aujourd’hui',
      contenu: `Le tableau ci-dessous lit les derniers cours en base pour six sociétés de profils variés et calcule le coût de 10 actions de chacune, hors frais de transaction.\nRegardez l’écart entre le coût de 10 actions d’une valeur autour de quelques milliers de francs et celui d’une grande banque comme SGBC : votre budget par ligne détermine le nombre de titres, jamais la qualité de l’entreprise.`,
      donnees_reelles: { vue: 'cours', codes: ['UNXC', 'TTLC', 'CIEC', 'SPHC', 'SGBC', 'SNTS'], actions: 10 },
    },
    {
      type: 'definition',
      titre: 'Anatomie complète des frais de bourse en zone UEMOA',
      contenu: `Chaque transaction supporte plusieurs couches de frais qu’il faut connaître avant de passer son premier ordre. Une partie revient à votre SGI (négociable ou variable selon sa grille homologuée par l’AMF-UMOA), une autre aux infrastructures de marché (BRVM et DC/BR), et la fiscalité locale (TVA ou TAF) s’applique sur les commissions.\nAu-delà des frais de transaction, vérifiez deux coûts récurrents souvent oubliés par les débutants : les droits de garde (facturés annuellement ou trimestriellement en pourcentage du portefeuille) et les frais fixes de tenue de compte (0 FCFA dans ${sgi.tenue_compte_zero_nb} des ${sgi.nb_sgi_frais_base} grilles suivies, mais parfois facturés au trimestre dans d’autres).`,
      tableau: {
        colonnes: ['Poste de frais', 'Qui prélève ?', 'Ordres de grandeur observés', 'Ce qu’il faut vérifier'],
        lignes: [
          ['Courtage SGI', 'Votre SGI', `${fr1(sgi.courtage_min_pct)} % à ${fr1(sgi.courtage_max_pct)} % HT (grilles suivies), parfois avec minimum`, 'Le taux appliqué aux particuliers ET le minimum en FCFA par ordre'],
          ['Commissions de marché', 'BRVM + DC/BR', 'Environ 0,3 % HT au total sur actions (barème réglementé)', 'Communes à toutes les SGI ; apparaissent sur l’avis d’opéré'],
          ['Taxe sur commissions (TVA / TAF)', 'Administration fiscale', 'Selon le pays de la SGI (souvent 10 % à 18 % des commissions)', 'S’applique sur les frais de courtage, pas sur le montant des actions'],
          ['Droits de garde (conservation)', 'SGI / conservateur', `Jusqu’à ${fr1(sgi.droits_garde_annuels_max_pct)} % / an (ou facturation trimestrielle avec plancher)`, 'S’il existe un plancher en FCFA par trimestre qui pèse sur un petit compte'],
          ['Tenue de compte & virements', 'Votre SGI', `0 FCFA (${sgi.tenue_compte_zero_nb} grilles) à quelques milliers de FCFA / trimestre`, 'Frais de retrait d’espèces et frais de transfert de titres vers une autre SGI'],
        ],
        note: `Source : synthèse des ${sgi.nb_sgi_frais_base} grilles SGI suivies dans la base WESTBOURSE (dont ${sgi.nb_homologuees_base} homologuées AMF-UMOA, novembre 2026). Demandez toujours la grille complète avant d’ouvrir votre compte.`,
      },
    },
    {
      type: 'importance',
      titre: 'L’effet ciseau du minimum de frais sur les petits ordres',
      contenu: `Les frais de transaction se paient deux fois : à l’achat, puis à la revente. Avec 1,5 % de frais tout compris par sens, l’action doit déjà monter d’environ 3 % pour que l’aller-retour revienne à zéro.\nMais le vrai danger pour un petit budget est le minimum de perception par ordre. Si votre SGI prélève un minimum de 2 500 FCFA par ordre (exemple pédagogique fréquent), un achat de 10 000 FCFA subit 25 % de frais dès l’entrée — soit 50 % aller-retour ! Dès 170 000 FCFA par ordre, ce plancher s’efface et vous payez le taux normal.`,
      formules: [
        { nom: 'Seuil de rentabilité d’un aller-retour', expression: 'Frais à l’achat + Frais à la revente (en % du montant investi)', exemple: '1,5 % + 1,5 % ≈ 3 % sans minimum ; 25 % + 25 % = 50 % sur 10 000 FCFA avec 2 500 FCFA de minimum' },
      ],
      tableau: {
        colonnes: ['Montant de l’ordre', 'Frais d’achat (1,5 %, min 2 500)', 'Coût aller-retour', 'Hausse nécessaire pour équilibrer'],
        lignes: taillesOrdre.map((m) => {
          const r = tauxAR(m, 1.5, 2500);
          return [`${ent(m)} FCFA`, `${ent(r.fraisUnSens)} FCFA`, `${ent(r.fraisAR)} FCFA`, `${fr1(r.pctAR)} %`];
        }),
        note: 'Calcul pédagogique (taux 1,5 % TTC, minimum de 2 500 FCFA par ordre). Si votre SGI n’applique aucun minimum ou un minimum de 1 000 FCFA, le seuil baisse d’autant : testez vos propres chiffres dans le simulateur ci-dessous.',
      },
      graphiques: [
        {
          type: 'bar',
          titre: 'Coût réel aller-retour en % selon la taille de l’ordre (exemple : 1,5 %, min 2 500 FCFA)',
          labels: taillesOrdre.map((m) => `${ent(m)}`),
          valeurs: taillesOrdre.map((m) => tauxAR(m, 1.5, 2500).pctAR),
          unite: ' %',
          note: 'Exemple pédagogique calculé pour un taux de 1,5 % et un minimum de perception de 2 500 FCFA par ordre. En dessous de 100 000 FCFA par ordre, un minimum forfaitaire pèse très lourd ; regrouper son épargne avant d’acheter règle le problème.',
          reel: false,
        },
      ],
      simulation: {
        type: 'frais_ordre',
        consigne: 'Faites varier la quantité et saisissez le minimum de frais de votre SGI (0, 1 000 ou 2 500 FCFA) pour observer l’impact exact sur votre seuil de rentabilité.',
        cours: 2500,
        quantite: 10,
        taux_frais_pct: 1.5,
        minimum_fcfa: 1000,
      },
    },
    {
      type: 'cas',
      titre: 'Trois budgets de départ concrets : 50 000, 250 000 et 1 000 000 FCFA',
      contenu: `Il n’existe pas de somme « idéale » universelle : l’important est d’adapter votre méthode à votre budget pour éviter que les frais ou le manque de diversification ne vous pénalisent.\nExemple pédagogique : avec 50 000 FCFA, vous pouvez commencer sur trois valeurs de secteurs différents (environ 16 667 FCFA par ligne) uniquement chez une SGI sans minimum de perception élevé ni frais fixes trimestriels lourds — sinon, mieux vaut cumuler son épargne deux ou trois mois avant de passer chaque ordre.`,
      formules: [
        { nom: 'Budget indicatif par ligne', expression: 'Budget total ÷ Nombre de valeurs visées', exemple: '50 000 ÷ 3 ≈ 16 667 FCFA par valeur ; 250 000 ÷ 5 = 50 000 FCFA par valeur' },
      ],
      tableau: {
        colonnes: ['Budget de départ', 'Nombre de lignes conseillé', 'Taille moyenne par ordre', 'Priorité pratique'],
        lignes: [
          ['50 000 FCFA', '2 à 3 valeurs (secteurs distincts)', '16 000 à 25 000 FCFA', 'Choisir impérativement une SGI sans dépôt minimum et sans frais fixes élevés (ou un OPCVM)'],
          ['250 000 FCFA', '4 à 5 valeurs (3 à 4 secteurs)', '50 000 à 60 000 FCFA', 'Première vraie diversification sectorielle ; frais maîtrisés dès 50 000 FCFA par ordre'],
          ['1 000 000 FCFA', '5 à 8 valeurs (4+ secteurs)', '125 000 à 200 000 FCFA', 'Respecter facilement les plafonds de 20 % par société et 35 % par secteur'],
        ],
        note: 'Exemples pédagogiques d’organisation de budget. Ne placez en actions que l’argent dont vous n’aurez pas besoin avant plusieurs années.',
      },
      encadres: [
        {
          ton: 'cle',
          titre: 'La règle d’or avant le premier franc en bourse',
          texte: 'Constituez d’abord une épargne de précaution disponible (l’équivalent de 3 à 6 mois de dépenses courantes) sur un support liquide sans risque de perte en capital. La bourse vient ensuite.',
        },
      ],
    },
    {
      type: 'importance',
      titre: 'Construire son capital mois après mois : la force de la régularité',
      contenu: `La plupart des investisseurs particuliers ne démarrent pas avec un gros capital : ils alimentent leur compte espèces chaque mois (par exemple 25 000 ou 50 000 FCFA à la réception du salaire) et passent un ordre dès que le solde atteint un montant suffisant pour diluer les frais.\nCette discipline régulière présente deux avantages majeurs : elle évite de tout investir au plus haut d’un cycle et laisse le temps au réinvestissement des dividendes de composer le capital année après année.`,
      simulation: {
        type: 'valeur_future',
        consigne: 'Testez l’effet d’un versement mensuel régulier sur 5, 10 ou 15 ans. Le taux annuel est une hypothèse de calcul, jamais une promesse.',
        capital_initial: 50000,
        versement_mensuel: 25000,
        taux_pct: 8,
        annees: 10,
        objectif: 5000000,
      },
    },
    {
      type: 'cas',
      titre: 'Ne pas mettre tous ses œufs dans le même panier',
      contenu: `Exemple pédagogique : 50 000 FCFA placés sur une seule action qui recule de 20 %, c’est 10 000 FCFA de perte (20 % de votre capital). Répartis à parts égales sur cinq valeurs de secteurs différents, la même chute de 20 % sur l’une d’elles coûte 2 000 FCFA, soit seulement 4 % du portefeuille.\nPour garder ce filet de sécurité à mesure que votre portefeuille grandit, deux repères simples sont utilisés tout au long de l’Académie : ne jamais dépasser 20 % sur une seule société, ni plus de 35 % sur un seul secteur d’activité.`,
      illustration: {
        gabarit: 'avant_apres',
        titre: '50 000 FCFA et une valeur qui baisse de 20 % (exemple pédagogique)',
        unite: 'FCFA',
        colonnes: [
          {
            label: 'Tout sur une seule valeur',
            segments: [
              { label: 'Ce qui reste', valeur: 40000 },
              { label: 'Perte', valeur: 10000 },
            ],
          },
          {
            label: 'Réparti sur cinq valeurs',
            segments: [
              { label: 'Ce qui reste', valeur: 48000 },
              { label: 'Perte', valeur: 2000 },
            ],
          },
        ],
        note: 'La même baisse coûte 10 000 FCFA quand tout est concentré sur un titre, contre 2 000 FCFA (4 % du portefeuille) quand le budget est réparti en cinq parts égales et qu’une seule baisse.',
      },
      simulation: {
        type: 'allocation',
        capital: 250000,
        secteurs: [
          { nom: 'Services financiers', pct: 30 },
          { nom: 'Télécommunications', pct: 25 },
          { nom: 'Services publics & Énergie', pct: 25 },
          { nom: 'Consommation & Industrie', pct: 20 },
        ],
        seuil_secteur_pct: 35,
      },
    },
    {
      type: 'piege',
      titre: 'Cinq erreurs de budget qui rognent le capital dès le départ',
      contenu: `Éviter ces cinq erreurs protège souvent plusieurs points de rendement dès la première année.`,
      points: [
        { titre: 'Tout miser sur une seule valeur « coup de cœur »', detail: 'Même une grande entreprise peut traverser une crise sectorielle, une baisse de marge ou une suppression de dividende.' },
        { titre: 'Multiplier les micro-ordres mangés par le minimum de frais', detail: 'Dix ordres de 10 000 FCFA avec un minimum de 2 500 FCFA coûtent 25 000 FCFA de frais, contre 1 500 à 2 500 FCFA pour un seul ordre regroupé de 100 000 FCFA.', verifier: 'le minimum de perception de votre SGI avant d’envoyer un ordre.' },
        { titre: 'Oublier les frais fixes annuels sur un petit compte', detail: 'Des frais de tenue de compte de 10 000 FCFA par an représentent 20 % d’un portefeuille de 50 000 FCFA — ils effaceraient à eux seuls les dividendes.', verifier: 'les frais de tenue de compte et le plancher des droits de garde.' },
        { titre: 'Investir son fonds d’urgence ou de l’argent emprunté', detail: 'En cas d’imprévu ou d’échéance de crédit, vous seriez contraint de vendre au pire moment, potentiellement à perte.' },
        { titre: 'Choisir ses actions parce que leur cours unitaire est petit', detail: 'Un cours bas n’indique ni une sous-évaluation ni un risque moindre : regardez toujours la santé financière de la société et sa valorisation.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'L’essentiel à retenir',
      contenu: `Cinq principes pratiques pour calibrer votre premier budget en bourse.`,
      points: [
        { titre: 'Coût = quantité × cours + frais', detail: 'Aucun minimum légal ; plus de la moitié des 48 actions BRVM cotent sous 5 000 FCFA (médiane 4 530 FCFA).' },
        { titre: 'Comparez la grille complète de votre SGI', detail: 'Dépôt minimum, courtage, minimum par ordre, droits de garde et tenue de compte.' },
        { titre: 'Les frais se paient à l’aller comme au retour', detail: 'Regroupez votre épargne pour passer des ordres qui ne sont pas écrasés par le minimum de perception.' },
        { titre: 'Épargne de précaution d’abord, régularité ensuite', detail: 'Investissez uniquement de l’argent disponible sur plusieurs années, idéalement par versements réguliers.' },
        { titre: 'Diversifiez dès le départ', detail: 'Plusieurs secteurs distincts, avec pour repère maximal 20 % par société et 35 % par secteur.' },
      ],
    },
  ],
  chart: null,
  charts: [],
  quiz: [
    // Indices 0, 1 et 3 préservés pour compatibilité avec lecons-1-4.test.ts !
    {
      question: 'Une action cote 2 500 FCFA. Vous en achetez 10, avec 1 % de frais (sans minimum). Combien payez-vous ?',
      options: ['2 525 FCFA', '25 000 FCFA', '25 250 FCFA', '27 500 FCFA'],
      correct: 2,
      explication: '10 × 2 500 = 25 000 FCFA, plus 1 % de frais, soit 250 FCFA : 25 250 FCFA au total.',
    },
    {
      question: 'Vos frais sont de 1,5 % à l’achat et 1,5 % à la revente. De combien l’action doit-elle monter, environ, pour que l’opération ne perde rien ?',
      options: ['0,75 %', '1,5 %', '3 %', '15 %'],
      correct: 2,
      explication: 'Les frais se paient deux fois : 1,5 % à l’achat + 1,5 % à la revente = environ 3 %. En dessous, l’aller-retour est perdant.',
    },
    {
      question: 'Une action cote 1 800 FCFA, une autre 30 000 FCFA. Que peut-on en conclure ?',
      options: ['La première est la meilleure affaire', 'La seconde est de meilleure qualité', 'Rien sans analyser leurs fondamentaux', 'La première verse un plus petit dividende'],
      correct: 2,
      explication: 'Le cours d’une action dépend du nombre de titres en circulation, pas de sa cherté ni de sa qualité. Il faut rapporter le prix aux bénéfices ou aux dividendes.',
    },
    {
      question: '50 000 FCFA répartis à parts égales sur cinq valeurs. L’une d’elles baisse de 20 %. Combien perd le portefeuille ?',
      options: ['10 000 FCFA', '2 000 FCFA', '4 000 FCFA', '20 000 FCFA'],
      correct: 1,
      explication: 'Chaque ligne vaut 10 000 FCFA ; 20 % de 10 000 = 2 000 FCFA, soit 4 % du portefeuille. Sur une seule valeur, la perte aurait été de 10 000 FCFA.',
    },
    {
      question: 'Pourquoi éviter de multiplier les très petits ordres quand votre SGI applique un minimum de perception ?',
      options: ['La BRVM refuse les ordres sous dix titres', 'Le minimum de frais pèse très lourd en %', 'Ils ne donnent pas droit au dividende', 'Ils sont exécutés seulement le vendredi'],
      correct: 1,
      explication: 'Un minimum de 2 500 FCFA sur un ordre de 10 000 FCFA représente 25 % de frais dès l’achat (50 % aller-retour). Mieux vaut regrouper son épargne.',
    },
    {
      question: 'Votre SGI facture 10 000 FCFA de frais fixes de tenue de compte par an. Combien cela représente-t-il sur un portefeuille de 50 000 FCFA ?',
      options: ['20 % par an', '2 % par an', '5 % par an', '0,5 % par an'],
      correct: 0,
      explication: '10 000 ÷ 50 000 = 20 % par an : ces frais fixes absorberaient plus que les dividendes habituels. Sur un petit budget, il faut cibler une SGI sans frais fixes lourds.',
    },
    {
      question: 'À la BRVM, quel est le montant minimum fixé par la loi pour acheter des actions ?',
      options: ['Aucun : le prix d’une seule action entière', '100 000 FCFA obligatoires', '500 000 FCFA fixés par la BRVM', '1 000 000 FCFA fixés par l’AMF-UMOA'],
      correct: 0,
      explication: 'La BRVM ne fixe aucun plancher en FCFA : on achète au minimum une action entière. Le dépôt minimum éventuel dépend uniquement de la politique commerciale de chaque SGI.',
    },
    {
      question: 'Quel repère de diversification est retenu dans l’Académie pour limiter le risque de concentration ?',
      options: ['Max 50 % par titre et 80 % par secteur', 'Max 20 % par société et 35 % par secteur', 'Exactement 100 % sur le secteur bancaire', 'Uniquement des titres sous 2 000 FCFA'],
      correct: 1,
      explication: 'Limiter chaque société à 20 % et chaque secteur à 35 % évite qu’un choc isolé ou sectoriel ne mette en danger tout votre capital.',
    },
    {
      question: 'Que faut-il constituer AVANT d’investir son premier franc en actions ?',
      options: ['Un crédit bancaire à taux variable', 'Une épargne de précaution disponible', 'Un compte dans trois SGI différentes', 'Un portefeuille d’au moins vingt titres'],
      correct: 1,
      explication: 'Disposer de 3 à 6 mois de dépenses courantes sur un support liquide évite d’être forcé de vendre vos actions en pleine baisse lors d’un imprévu.',
    },
    {
      question: 'Vous épargnez 20 000 FCFA par mois chez une SGI qui applique un minimum de 2 000 FCFA par ordre. Quelle pratique réduit vos frais ?',
      options: ['Passer quatre ordres de 5 000 FCFA', 'Cumuler 4 à 6 mois avant d’acheter', 'Vendre et racheter chaque semaine', 'Emprunter pour acheter plus vite'],
      correct: 1,
      explication: 'En cumulant 100 000 à 120 000 FCFA sur votre compte espèces avant de passer l’ordre, le minimum de 2 000 FCFA retombe sous 2 % au lieu de 10 % sur 20 000 FCFA.',
    },
  ],
  liens: [
    { label: 'Simuler un budget d’épargne', href: '/simulateur-budget' },
    { label: 'Comparer les frais des SGI', href: '/comparateur-sgi' },
    { label: 'Les cours de toutes les actions', href: '/actions' },
  ],
};
lecon3.qcm = lecon3.quiz[0];

// ══════════════════════════════════════════════════════════════════════════════
// LEÇON 4 — Dividende et plus-value : les deux sources de gain
// ══════════════════════════════════════════════════════════════════════════════
// 6 valeurs choisies pour l'analyse 5 ans réelle (2021-2026) — variété de profils (croissance, dividende régulier, cyclique, coupure)
const perfSelection = ['SNTS', 'CIEC', 'TTLC', 'PALC', 'SGBC', 'UNXC'].map((c) => byCode(perf5, c));
const ftscVeille = ftsc.seances.find((s) => s.date === '2025-09-25');
const ftscJour = ftsc.seances.find((s) => s.date === '2025-09-26');
const ftscDrop = ftscVeille.cours - ftscJour.cours;

const lecon4 = {
  titre: 'Leçon 4 — Dividende et plus-value : les deux sources de gain',
  module: MODULE_1,
  nouveaute: NOUVEAUTE,
  categorie: 'income',
  duree_min: 18,
  sous_titre: 'Comment se combinent dividende et plus-value, ce qui se passe vraiment au détachement, l’impôt UEMOA, et comment protéger vos DPS.',
  resume: 'Une action peut rapporter de deux façons : par le dividende voté chaque année, et par la plus-value à la revente. Lors d’une augmentation de capital, les droits préférentiels de souscription (DPS) ne créent pas de gain : ils compensent la dilution de vos titres.\nCette leçon décompose le rendement total sur cinq années réelles à la BRVM, démontre le mécanisme du détachement sur l’épisode réel Filtisac CI (2025), détaille la fiscalité IRVM par pays UEMOA et propose trois simulateurs interactifs.',
  avertissement: 'Ceci n’est pas un conseil en investissement. Les dividendes ne sont pas garantis et les performances passées ne préjugent pas des performances futures. Investir en actions comporte un risque de perte en capital.',
  sections: [
    {
      type: 'definition',
      titre: 'Deux sources de gain, un droit à protéger',
      contenu: `Un actionnaire gagne de l’argent de deux manières distinctes, qui peuvent s’additionner — ou se compenser partiellement. Un troisième élément souvent mal compris, le droit préférentiel de souscription (DPS), ne crée pas de richesse supplémentaire : il protège la valeur de ce que vous possédez déjà lors d’une augmentation de capital.`,
      // ⚠️ B1 (relecture.test.ts) : sections[0].points doit contenir un point avec "DPS" dans titre et "compensent la dilution" dans detail !
      points: [
        { titre: 'Le dividende', detail: 'La part du bénéfice annuel que l’assemblée générale décide de distribuer en espèces aux actionnaires. Il procure un revenu sans vendre vos titres, mais n’est jamais garanti.' },
        { titre: 'La plus-value', detail: 'L’écart positif entre le prix de revente et le prix d’achat. Si le cours baisse sous votre prix d’entrée, l’écart est négatif : c’est une moins-value.' },
        { titre: 'Les droits préférentiels de souscription (DPS)', detail: 'Lors d’une augmentation de capital en numéraire, vous recevez des droits qui compensent la dilution de vos titres. Ils ne créent pas de gain : exercés ou cédés, ils évitent une perte.' },
      ],
      tableau: {
        colonnes: ['Élément', 'Origine', 'Quand est-il encaissé ?', 'Nature du risque'],
        lignes: [
          ['Dividende', 'Part du bénéfice net votée en assemblée', 'À la date de paiement, sur le compte espèces', 'Peut baisser ou disparaître si les bénéfices chutent'],
          ['Plus-value', 'Hausse du cours entre l’achat et la vente', 'Uniquement au moment de la revente (avant, elle reste latente)', 'Peut se transformer en moins-value si le marché se retourne'],
          ['DPS', 'Augmentation de capital avec maintien du droit', 'Pendant la période de souscription (exercice ou vente du droit)', 'Perte sèche uniquement si vous laissez expirer vos droits'],
        ],
        note: 'Ne confondez jamais un revenu encaissé (dividende), un gain potentiel sur papier (plus-value latente) et un mécanisme de protection contre la dilution (DPS).',
      },
    },
    {
      type: 'importance',
      titre: 'Additionner les deux moteurs : le rendement total',
      contenu: `Observer une action uniquement par son cours — ou uniquement par son dividende — donne une image tronquée. Une société au cours stable qui verse 8 % de dividende net par an rapporte davantage qu’une action qui monte de 5 % sans rien distribuer. À l’inverse, un dividende de 8 % ne compense pas une chute durable de 30 % du cours.\nLe seul juge complet est le rendement total : la somme des dividendes réellement perçus et de la variation du cours, rapportée au capital engagé au départ. Les exemples ci-dessous sont pédagogiques.`,
      formules: [
        { nom: 'Revenu du dividende', expression: 'Nombre d’actions × Dividende par action', exemple: '300 × 1 000 = 300 000 FCFA' },
        { nom: 'Plus-value (hors frais)', expression: '(Prix de revente − Prix d’achat) × Nombre d’actions', exemple: '(5 600 − 5 000) × 200 = 120 000 FCFA' },
        { nom: 'Rendement total', expression: '(Dividendes reçus + Plus-value) ÷ Somme investie', exemple: '(80 000 + 120 000) ÷ 1 000 000 = 20 %' },
        { nom: 'Rendement du dividende', expression: 'Dividende annuel ÷ Cours retenu', exemple: '400 ÷ 5 000 = 8 % sur prix d’achat' },
      ],
      illustration: {
        gabarit: 'decomposition',
        titre: 'Le rendement total additionne dividende et plus-value (exemple pédagogique)',
        operation: 'somme',
        resultat: { label: 'Rendement total', valeur: 20, pourcentage: true },
        facteurs: [
          { label: 'Dividendes reçus (80 000 FCFA)', valeur: 8, pourcentage: true },
          { label: 'Plus-value (120 000 FCFA)', valeur: 12, pourcentage: true },
        ],
        note: 'Sur 1 000 000 FCFA investis, les deux sources de gain s’additionnent. La plus-value n’est acquise qu’à la revente ; le dividende, lui, est encaissé sur le compte espèces au paiement.',
      },
      simulation: {
        type: 'rendement_total',
        consigne: 'Modifiez le prix de revente, le dividende ou la durée de détention : voyez comment la part de chaque moteur évolue (y compris en cas de baisse du cours).',
        prix_achat: 5000,
        prix_vente: 5600,
        actions: 200,
        dividendes_par_action: 400,
        annees: 1,
      },
    },
    {
      type: 'importance',
      titre: 'Ce que montrent cinq années réelles à la BRVM (2021–2026)',
      contenu: `À la BRVM, les dividendes jouent un rôle bien plus important que sur de nombreuses bourses occidentales. Entre janvier 2021 et le 24 novembre 2026, sur des sociétés distributrices régulières comme TotalEnergies CI (TTLC), Sonatel (SNTS) ou Palm CI (PALC), les dividendes cumulés des exercices 2021 à 2025 représentent entre 56 % et 177 % du prix d’achat initial (séries ajustées des divisions de titres).\nMais rien n’est automatique : sur Uniwax CI (UNXC), le dividende est tombé à 0 FCFA pendant quatre exercices consécutifs (2022 à 2025). Les deux moteurs varient fortement selon la santé et le cycle de chaque entreprise.`,
      graphiques: [
        {
          type: 'bar',
          titre: 'Décomposition réelle 2021–2026 : variation du cours contre dividendes cumulés (% du cours de janv. 2021)',
          labels: perfSelection.map((x) => x.code),
          series: [
            { nom: 'Variation du cours (janv. 2021 → 24 nov. 2026)', valeurs: perfSelection.map((x) => x.part_plus_value_pct) },
            { nom: 'Dividendes cumulés (exercices 2021–2025)', valeurs: perfSelection.map((x) => x.part_dividendes_pct) },
          ],
          unite: ' %',
          note: 'Source : base WESTBOURSE (brvm_actions_daily & dividends, janv. 2021 au 24/11/2026, séries ajustées des divisions de titres, hors réinvestissement et hors frais). Période historiquement très haussière sur la BRVM : ce constat passé ne présage en rien de l’avenir.',
          reel: true,
        },
      ],
      tableau: {
        colonnes: ['Valeur', 'Cours janv. 2021', 'Cours 24/11/2026', 'Dividendes cumulés (ex. 21–25)', 'Part cours', 'Part dividendes'],
        lignes: perfSelection.map((x) => [
          `${x.code} — ${x.nom}`,
          `${ent(x.cours_debut)} FCFA`,
          `${ent(x.cours_fin)} FCFA`,
          `${ent(x.somme_dividendes)} FCFA`,
          `+${fr1(x.part_plus_value_pct)} %`,
          `+${fr1(x.part_dividendes_pct)} %`,
        ]),
        note: 'Source : base WESTBOURSE (janv. 2021 – 24/11/2026). Sur UNXC, aucun dividende n’a été versé au titre des exercices 2022 à 2025 ; sur SGBC, le dividende a plus que doublé entre 2021 et 2025.',
      },
      encadres: [
        {
          ton: 'attention',
          titre: 'Les années 2021–2026 ne sont pas une promesse',
          texte: 'La BRVM a connu entre 2021 et 2026 un cycle de rattrapage particulièrement favorable, après une longue phase de baisse entre 2016 et 2020. Extrapoler ces pourcentages sur les cinq prochaines années serait une erreur grave.',
        },
      ],
    },
    {
      type: 'definition',
      titre: 'Chronologie d’un dividende : de l’assemblée générale au compte espèces',
      contenu: `Pour toucher le dividende d’une année, il n’est pas nécessaire d’avoir détenu l’action pendant douze mois : tout se joue autour d’une date précise, la date de détachement (ou date ex-dividende).\nVous devez être propriétaire de l’action à la clôture de la séance qui précède le détachement. Si vous achetez le matin du détachement ou après, le dividende de l’exercice revient au vendeur, même si le paiement effectif n’intervient que plusieurs jours plus tard.`,
      etapes: [
        { titre: 'Clôture et publication des comptes', detail: 'L’entreprise publie son bénéfice annuel et le conseil d’administration propose un dividende par action.' },
        { titre: 'Vote en assemblée générale (AGO)', detail: 'Les actionnaires approuvent (ou modifient) le montant du dividende ; la société communique le calendrier officiel à la BRVM.' },
        { titre: 'Date de détachement (ex-dividende)', detail: 'L’action cote désormais sans le droit au dividende de l’exercice : son cours de référence est mécaniquement ajusté à la baisse du montant du dividende.', cle: true },
        { titre: 'Date de paiement (compte espèces)', detail: 'La société transfère les fonds via le DC/BR ; votre SGI crédite votre compte espèces du montant net, après retenue à la source.' },
      ],
      etapes_style: 'frise',
    },
    {
      type: 'cas',
      titre: 'Le mythe du « dividende gratuit » : l’épisode réel Filtisac CI (2025)',
      contenu: `Une illusion tenace consiste à acheter une action la veille du détachement pour « prendre le dividende » et revendre aussitôt. En réalité, l’argent distribué sort de la trésorerie de l’entreprise : la société vaut immédiatement d’autant moins, et le marché ajuste le cours en conséquence.\nL’épisode réel de Filtisac Côte d’Ivoire (FTSC) en septembre 2025 l’illustre avec une clarté spectaculaire. Pour l’exercice 2024, la société distribue un dividende exceptionnel net de 1 726,56 FCFA. Le 25 septembre 2025 (veille du détachement), FTSC clôture à ${ent(ftscVeille.cours)} FCFA. Le 26 septembre 2025 (jour du détachement), le cours ouvre et clôture à ${ent(ftscJour.cours)} FCFA, soit une baisse immédiate de ${ent(ftscDrop)} FCFA (−41,9 %) en une seule séance.`,
      graphiques: [
        {
          type: 'line',
          titre: 'Cours réel de Filtisac CI (FTSC) autour du détachement du 26 septembre 2025',
          labels: ftsc.seances.map((s) => s.date.slice(5).split('-').reverse().join('/')),
          valeurs: ftsc.seances.map((s) => s.cours),
          unite: ' FCFA',
          note: `Source : base WESTBOURSE (brvm_actions_daily, FTSC du 22/09/2025 au 03/10/2025). Entre le 25/09 (${ent(ftscVeille.cours)} FCFA) et le 26/09 (${ent(ftscJour.cours)} FCFA), le cours recule de ${ent(ftscDrop)} FCFA le jour du détachement du dividende net de 1 726,56 FCFA.`,
          reel: true,
        },
      ],
      tableau: {
        colonnes: ['Séance', 'Cours de clôture FTSC', 'Variation', 'Ce qui se passe'],
        lignes: [
          ['24/09/2025', '4 060 FCFA', '−7,4 %', 'Avant-veille du détachement'],
          ['25/09/2025', `${ent(ftscVeille.cours)} FCFA`, '−7,4 %', 'Dernier jour pour acheter avec droit au dividende'],
          ['26/09/2025', `${ent(ftscJour.cours)} FCFA`, '−41,9 %', 'Jour du détachement (dividende net 1 726,56 FCFA) : ajustement technique hors plafond ±7,5 %'],
          ['29/09/2025', '2 345 FCFA', '+7,3 %', 'Reprise des cotations normales dans la limite de ±7,5 %'],
        ],
        note: 'Source : base WESTBOURSE (2025). Acheter la veille du détachement ne crée aucun gain gratuit : l’ajustement du cours compense le dividende et les frais de courtage restent à votre charge.',
      },
    },
    {
      type: 'cas',
      reel: true,
      titre: 'Sur la BRVM : observer la régularité sur cinq exercices',
      contenu: `Au-delà d’un seul versement, ce qui compte pour un investisseur de long terme est la constance de l’entreprise. Le tableau en direct ci-dessous lit dans la base les dividendes des cinq derniers exercices de quatre grandes valeurs cotées.\nComparez les trajectoires : certaines sociétés augmentent régulièrement leur distribution année après année, d’autres l’ajustent selon leurs investissements ou leur conjoncture.`,
      donnees_reelles: { vue: 'historique', codes: ['SNTS', 'ORAC', 'SGBC', 'CIEC'] },
    },
    {
      type: 'cas',
      reel: true,
      titre: 'Sur la BRVM : ce que rapportent 100 actions au cours du jour',
      contenu: `Le rendement du dividende n’est pas un taux fixe gravé dans le marbre : il évolue chaque jour avec le cours de l’action. Si une société maintient son dividende à 500 FCFA mais que son cours double de 5 000 à 10 000 FCFA, le rendement pour un nouvel acheteur passe de 10 % à 5 % — tandis que l’actionnaire entré à 5 000 FCFA conserve 10 % sur son prix d’achat initial.`,
      donnees_reelles: { vue: 'rendement', codes: ['SNTS', 'ORAC', 'SGBC', 'CIEC'], actions: 100 },
    },
    {
      type: 'importance',
      titre: 'Impôt sur les dividendes (IRVM) et inflation : du brut au réel',
      contenu: `Les dividendes versés par les sociétés cotées à la BRVM subissent une retenue à la source appelée IRVM (Impôt sur le Revenu des Valeurs Mobilières). Point crucial : c’est le pays où siège la société émettrice qui fixe le taux, pas votre pays de résidence ! Votre SGI crédite directement le montant net.\nDeux autres réalités séparent le gain affiché du gain réel : d’abord, une plus-value reste « latente » (virtuelle) tant que vous n’avez pas vendu ; ensuite, si votre portefeuille rapporte 6 % dans une année où les prix à la consommation montent de 4 %, votre pouvoir d’achat réel n’a progressé que d’environ 2 %.`,
      tableau: {
        colonnes: ['Pays de l’émetteur', 'Taux IRVM dividendes cotés (personne physique)', 'Précision vérifiée'],
        lignes: [
          ['Togo', '3 %', 'Personnes morales : 7 %'],
          ['Bénin', '5 %', 'Taux réduit pour les sociétés cotées'],
          ['Mali', '7 %', 'Retenu automatiquement à la source'],
          ['Sénégal', '10 %', 'Applicable notamment à Sonatel (SNTS)'],
          ['Côte d’Ivoire', '12 %', 'Depuis la loi de finances 2025 (10 % pour les personnes morales ; 10 % pour tous avant 2025)'],
          ['Burkina Faso', '12,5 %', 'Retenu automatiquement à la source'],
        ],
        note: 'Source : barème fiscal UEMOA vérifié dans WESTBOURSE (Annexe fiscale 2025 Côte d’Ivoire, calendrier BRVM 2026). Vérifiez toujours si un dividende annoncé dans la presse est brut ou net d’IRVM ; certains émetteurs bénéficient de régimes consolidés particuliers.',
      },
      simulation: {
        type: 'rendement_net',
        consigne: 'Saisissez un dividende brut, un cours et changez le pays de l’émetteur (Togo, Bénin, Sénégal, Côte d’Ivoire, Burkina Faso) pour mesurer l’impact exact de l’IRVM.',
        dividende_brut: 800,
        cours: 15000,
        pays: 'CI',
      },
    },
    {
      type: 'importance',
      titre: 'Augmentation de capital et DPS : calculer la dilution et choisir',
      contenu: `Lorsqu’une société cotée lève des fonds frais en émettant de nouvelles actions à un prix inférieur au cours du marché (augmentation de capital en numéraire), chaque action existante représente soudain une part plus petite de l’entreprise : c’est la dilution.\nPour ne pas léser les actionnaires actuels, l’entreprise leur attribue (sauf suppression votée en assemblée) un Droit Préférentiel de Souscription (DPS) par action détenue. Au détachement du DPS, le cours baisse d’environ la valeur de ce droit : vous avez alors trois options — dont une seule fait perdre de l’argent à coup sûr.`,
      formules: [
        { nom: 'Valeur théorique d’un DPS', expression: '(Cours avant détachement − Prix d’émission) ÷ (Parité + 1)', exemple: 'Parité 4 anciennes pour 1 nouvelle, cours 10 000, émission 7 000 → (10 000 − 7 000) ÷ 5 = 600 FCFA' },
        { nom: 'Cours théorique ex-droit', expression: 'Cours avant détachement − Valeur théorique du DPS', exemple: '10 000 − 600 = 9 400 FCFA (les 600 FCFA de baisse sont compensés par le DPS)' },
      ],
      points: [
        { titre: 'Exercer ses droits', detail: 'Vous apportez les espèces nécessaires pour acheter les nouvelles actions au prix réduit et maintenez intacte votre part du capital.', verifier: 'le prix de souscription, la parité et la date limite dans la note d’information.' },
        { titre: 'Céder ses droits sur le marché', detail: 'Les DPS sont cotés à la BRVM pendant la période de souscription : les vendre compense la baisse technique du cours au détachement, sans rien débourser.' },
        { titre: 'Ne rien faire (le seul mauvais choix)', detail: 'À la clôture de la période, les droits non utilisés tombent à 0 FCFA : vous subissez toute la dilution sans aucune compensation.' },
      ],
      simulation: {
        type: 'dps',
        consigne: 'Simulez une augmentation de capital : voyez la valeur théorique de vos DPS, le cours ex-droit et la perte sèche si vous laissez expirer vos droits.',
        cours: 10000,
        prix_emission: 7000,
        parite: 4,
        actions: 100,
      },
    },
    {
      type: 'piege',
      titre: 'Cinq confusions qui coûtent cher sur les gains boursiers',
      contenu: `Ces cinq erreurs reviennent chaque année au printemps, en pleine saison des dividendes à la BRVM.`,
      points: [
        { titre: 'Prendre une envolée passée pour la norme', detail: 'Une action qui a triplé en quatre ans est une exception, pas un rythme de croisière garanti pour les quatre années suivantes.' },
        { titre: 'Chasser le dividende la veille du détachement', detail: 'Comme le prouve l’épisode réel de Filtisac CI (26/09/2025), le cours s’ajuste à la baisse dès le détachement et vos frais d’aller-retour restent perdus.' },
        { titre: 'Confondre dividende brut et dividende net', detail: 'Selon le pays de l’émetteur (3 % à 12,5 % d’IRVM), le montant crédité sur votre compte espèces diffère du montant brut voté en assemblée.', verifier: 'la mention « brut » ou « net » sur l’avis de paiement de la BRVM.' },
        { titre: 'Confondre plus-value latente et argent en poche', detail: 'Tant que vos actions ne sont pas vendues, une hausse de +30 % peut fondre en quelques semaines lors d’une correction de marché.' },
        { titre: 'Oublier ses DPS lors d’une augmentation de capital', detail: 'Ne pas surveiller les avis de sa SGI pendant deux semaines peut faire expirer des droits qui valaient plusieurs pourcents de votre position.', verifier: 'régulièrement les avis d’opérations sur titres envoyés par votre SGI.' },
      ],
    },
    {
      type: 'retenir',
      titre: 'L’essentiel à retenir',
      contenu: `Cinq repères clés pour mesurer honnêtement ce que rapporte une action.`,
      points: [
        { titre: 'Deux sources de gain, un droit à protéger', detail: 'Dividende et plus-value créent le rendement total ; les DPS compensent la dilution lors d’une augmentation de capital.' },
        { titre: 'Le rendement total combine les deux moteurs', detail: 'À la BRVM, les dividendes cumulés pèsent lourd sur plusieurs années, mais ne sont jamais promis.' },
        { titre: 'Le dividende n’est jamais gratuit', detail: 'Le jour du détachement, le cours s’ajuste à la baisse du montant distribué ; seul l’investissement de durée crée de la valeur.' },
        { titre: 'Raisonnez toujours en net d’IRVM et après inflation', detail: 'La retenue à la source dépend du pays de la société émettrice (3 % à 12,5 % selon les pays UEMOA).' },
        { titre: 'Ne laissez jamais expirer vos DPS', detail: 'Exercez-les ou cédez-les pendant la période de cotation, mais ne restez jamais passif.' },
      ],
    },
  ],
  chart: null,
  charts: [],
  quiz: [
    // Indices 0 et 1 préservés pour compatibilité avec lecons-1-4.test.ts !
    {
      question: 'Vous achetez 200 actions à 5 000 FCFA et les revendez à 5 600 FCFA. Quelle est votre plus-value, hors frais ?',
      options: ['600 FCFA', '12 000 FCFA', '120 000 FCFA', '1 120 000 FCFA'],
      correct: 2,
      explication: '(5 600 − 5 000) × 200 = 600 × 200 = 120 000 FCFA.',
    },
    {
      question: 'Vous avez investi 1 000 000 FCFA, reçu 80 000 FCFA de dividendes et réalisé 120 000 FCFA de plus-value. Quel est votre rendement total ?',
      options: ['8 %', '12 %', '20 %', '200 %'],
      correct: 2,
      explication: '(80 000 + 120 000) ÷ 1 000 000 = 200 000 ÷ 1 000 000 = 20 %.',
    },
    {
      question: 'Une société lance une augmentation de capital avec DPS. Quel choix fait perdre de l’argent à coup sûr ?',
      options: ['Exercer tous ses DPS', 'Céder ses DPS sur le marché', 'Les laisser expirer sans agir', 'Vendre une part et exercer l’autre'],
      correct: 2,
      explication: 'À la fin de la période de souscription, les droits non utilisés tombent à zéro : vous subissez la dilution du cours sans aucune compensation.',
    },
    {
      question: 'Vous achetez une action la veille du détachement, uniquement pour toucher le dividende. Que se passe-t-il le lendemain ?',
      options: ['Vous gagnez le dividende sans contrepartie', 'Le cours s’ajuste à la baisse du dividende', 'Votre SGI annule automatiquement l’ordre', 'La société rembourse vos frais d’achat'],
      correct: 1,
      explication: 'Au détachement (comme sur FTSC le 26/09/2025), le cours baisse d’environ le montant du dividende. Le gain apparent est compensé et les frais restent à votre charge.',
    },
    {
      question: 'Une société a versé un dividende chaque année depuis dix ans. Que pouvez-vous en déduire ?',
      options: ['Le dividende est garanti à vie', 'Il peut baisser ou disparaître', 'Il augmentera forcément l’an prochain', 'L’AMF-UMOA interdit de le réduire'],
      correct: 1,
      explication: 'La régularité passée est un indice de discipline, jamais une garantie : chaque année, l’assemblée générale vote en fonction des résultats réels.',
    },
    {
      question: 'Quel pays détermine le taux d’impôt retenu à la source (IRVM) sur un dividende BRVM ?',
      options: ['Le pays où siège la société cotée', 'Le pays où réside l’actionnaire', 'Toujours la Côte d’Ivoire (siège BRVM)', 'Le pays où est située votre SGI'],
      correct: 0,
      explication: 'L’IRVM est prélevé à la source selon la fiscalité du pays de l’émetteur (par exemple 10 % au Sénégal, 12 % en Côte d’Ivoire pour les particuliers depuis 2025, 3 % au Togo).',
    },
    {
      question: 'Quelle date devez-vous surveiller pour savoir si votre achat vous donne droit au dividende de l’exercice ?',
      options: ['La date de détachement (ex-dividende)', 'La date de paiement sur votre compte', 'Le 31 décembre de l’année suivante', 'La date de publication du rapport annuel'],
      correct: 0,
      explication: 'Il faut détenir le titre avant la date de détachement. Un achat effectué le jour du détachement ou après ne donne plus droit au dividende de l’exercice.',
    },
    {
      question: 'Sur quel compte votre SGI verse-t-elle un dividende en espèces ?',
      options: ['Sur le compte espèces associé', 'Sur le compte-titres en actions', 'Sur un compte bloqué au DC/BR', 'Directement chez la BRVM'],
      correct: 0,
      explication: 'Les dividendes en numéraire sont toujours crédités en francs CFA sur le compte espèces lié à votre compte-titres.',
    },
    {
      question: 'Pourquoi les DPS reçus lors d’une augmentation de capital ne constituent-ils pas une « troisième source de gain » ?',
      options: ['Ils sont interdits aux particuliers', 'Ils compensent seulement la dilution', 'Ils ne peuvent jamais être vendus', 'Ils sont taxés à 100 % à la source'],
      correct: 1,
      explication: 'La valeur des DPS correspond à la baisse technique du cours au détachement : les vendre ou les exercer préserve votre patrimoine mais ne crée pas de gain nouveau.',
    },
    {
      question: 'Une action achetée 10 000 FCFA vaut aujourd’hui 13 000 FCFA, mais vous ne l’avez pas vendue. De quoi s’agit-il ?',
      options: ['D’un dividende exceptionnel acquis', 'D’une plus-value latente (non réalisée)', 'D’un gain définitivement garanti', 'D’un droit préférentiel de souscription'],
      correct: 1,
      explication: 'Tant que la vente n’est pas exécutée, le gain reste latent : une baisse ultérieure du cours peut le réduire ou l’effacer.',
    },
  ],
  liens: [
    { label: 'Les dividendes de toutes les valeurs', href: '/dividendes' },
    { label: 'Le calendrier des dividendes', href: '/dividendes/calendrier' },
    { label: 'Le rendement réel, après inflation', href: '/rendement-vrai' },
  ],
};
lecon4.qcm = lecon4.quiz[0];

const OUTPUTS = [
  ['lecon1-brvm.json', lecon1, 0, 'Leçon 1 — '],
  ['lecon2-acteurs.json', lecon2, 1, 'Leçon 2 — '],
  ['lecon3-budget.json', lecon3, 2, 'Leçon 3 — '],
  ['lecon4-gagner.json', lecon4, 3, 'Leçon 4 — '],
];

// Vérifications internes avant écriture
for (const [file, lesson] of OUTPUTS) {
  let maxPara = 0;
  let totalChars = 0;
  for (const s of lesson.sections) {
    totalChars += s.contenu.length;
    for (const p of s.contenu.split(/\n+/)) if (p.length > maxPara) maxPara = p.length;
  }
  let longestRight = 0;
  const dist = [0, 0, 0, 0];
  for (const q of lesson.quiz) {
    dist[q.correct] = (dist[q.correct] || 0) + 1;
    const others = q.options.filter((_, i) => i !== q.correct).map((o) => o.length);
    if (q.options[q.correct].length > Math.max(...others)) longestRight += 1;
  }
  console.log(
    `${file.padEnd(20)} | sections:${lesson.sections.length} | chars:${totalChars} | maxPara:${maxPara} | quiz:${lesson.quiz.length} | longestRight:${longestRight}/${lesson.quiz.length} | dist:${dist.join('/')}`,
  );
  if (maxPara > 650) throw new Error(`${file}: paragraphe trop long (${maxPara} > 650)`);
  fs.writeFileSync(path.join(CONTENUS, file), JSON.stringify(lesson, null, 2) + '\n', 'utf8');
}

// Générer la migration idempotente 0268_academy_niveau1_module1.sql
const sqlBlocks = OUTPUTS.map(([file, lesson, pos, prefix]) => {
  const tag = `lecon${pos + 1}_n1m1`;
  // Note: on préserve `image` si existante en base tout en mettant à jour tout le contenu de la leçon
  const json = JSON.stringify(lesson);
  return `  -- Position ${pos} (${file})
  IF NOT ((v_content->'lessons'->${pos}->>'titre') LIKE '${prefix}%') THEN
    RAISE EXCEPTION 'Migration 0268 interrompue : leçon en position ${pos} inattendue (%)', v_content->'lessons'->${pos}->>'titre';
  END IF;
  v_content := jsonb_set(
    v_content,
    '{lessons,${pos}}',
    (v_content->'lessons'->${pos}) || $${tag}$${json}$${tag}$::jsonb
  );`;
});

const migrationSql = `-- ══════════════════════════════════════════════════════════════════════════════
-- 0268_academy_niveau1_module1.sql
-- Enrichissement substantiel des 4 leçons du Module 1 (Niveau 1 : Initiation BRVM)
-- Généré par frontend/scripts/academy-niveau1-module1.mjs le 2026-11-24
-- Données réelles figées : frontend/lib/academy/contenus/sources/niveau1-module1-2026-11-24.json
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
