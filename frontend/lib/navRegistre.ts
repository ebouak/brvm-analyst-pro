/**
 * Registre de navigation : SOURCE UNIQUE de toutes les pages servies hors /admin.
 *
 * Spec 2026-11-11-architecture-navigation-design, lots 3 et 4. Aucune URL ne
 * change : ce registre ne crée ni ne déplace de route, il DÉCLARE chaque page
 * existante avec sa rubrique, son parent et son statut. Le menu (sidebar et
 * tiroir mobile), la palette de recherche, l'élément actif et le fil d'Ariane
 * en sont tous dérivés.
 *
 * Test : `lib/navRegistre.test.ts` échoue si une page de `app/` n'est pas
 * déclarée ici, si une entrée ne correspond à aucune page, ou si un parent
 * n'existe pas. Une page orpheline ne peut donc plus naître en silence.
 *
 * PUR : aucune dépendance, utilisable côté serveur, client et Edge.
 */

export type Rubrique = 'aujourdhui' | 'marche' | 'idee' | 'revenus' | 'portefeuille' | 'apprendre';

/** Libellés des six rubriques (variante ambitieuse retenue, spec §5). */
export const RUBRIQUES: { id: Rubrique; libelle: string }[] = [
  { id: 'aujourdhui', libelle: "Aujourd'hui" },
  { id: 'marche', libelle: 'Le marché' },
  { id: 'idee', libelle: 'Trouver une idée' },
  { id: 'revenus', libelle: 'Mes revenus' },
  { id: 'portefeuille', libelle: 'Mon portefeuille' },
  { id: 'apprendre', libelle: 'Apprendre' },
];

/**
 * Statut, en énumération FERMÉE (pas de statut fourre-tout, risque signalé par
 * la revue Fable) :
 * - `menu` : entrée du menu ;
 * - `secondaire` : page de l'application hors menu, atteinte par un onglet, un
 *   lien ou la palette ;
 * - `parcours` : étape d'un parcours (détail atteint depuis sa liste, retour de
 *   paiement, lien d'e-mail, impression) ;
 * - `interne` : maquette, widget ou support de test, jamais montré dans la nav ;
 * - `essai` : version en essai, en attente d'une décision produit ;
 * - `public` : page vitrine hors menu (SEO).
 */
export type StatutPage = 'menu' | 'secondaire' | 'parcours' | 'interne' | 'essai' | 'public';

interface EntreeCommune {
  /** Chemin du modèle de route, segments dynamiques entre crochets. */
  chemin: string;
  /** Libellé de la page, aligné sur le glossaire (spec §3) et sur le h1. */
  libelle: string;
  /** Libellé plus court pour le menu, si différent. */
  libelleMenu?: string;
  rubrique?: Rubrique;
  /** Chemin (modèle) du parent. Obligatoire sauf pour les racines. */
  parent?: string;
  /** Racine hors menu (sans parent). Les entrées du menu sont des racines. */
  racine?: true;
  premium?: boolean;
  /**
   * Page dynamique : le dernier maillon du fil prend la valeur du DERNIER
   * paramètre de l'adresse (un code de valeur, une date) plutôt que le libellé
   * du modèle. C'est la valeur réelle de l'URL, jamais une valeur inventée.
   */
  libelleParam?: true;
  /** Pas de fil d'Ariane (sorties d'impression). */
  sansFil?: true;
}

export type EntreeNav =
  | (EntreeCommune & { statut: 'menu'; raison?: undefined })
  | (EntreeCommune & { statut: Exclude<StatutPage, 'menu'>; raison: string });

const ONGLET = (de: string) => `onglet de ${de}`;
const COMPTE = 'menu du compte (avatar)';

export const REGISTRE: EntreeNav[] = [
  // ── Aujourd'hui ────────────────────────────────────────────────────────────
  { chemin: '/dashboard', libelle: 'Tableau de bord', rubrique: 'aujourdhui', statut: 'menu' },
  { chemin: '/dashboard/personnaliser', libelle: 'Personnaliser', rubrique: 'aujourdhui', parent: '/dashboard', statut: 'secondaire', raison: 'réglage, lié depuis le tableau de bord' },
  { chemin: '/brief', libelle: 'Brief de séance', rubrique: 'aujourdhui', statut: 'menu' },
  { chemin: '/brief/[date]', libelle: 'Brief de séance', rubrique: 'aujourdhui', parent: '/brief', statut: 'public', raison: 'brief daté (SEO)', libelleParam: true },
  { chemin: '/actualites', libelle: 'Actualités', rubrique: 'aujourdhui', statut: 'menu' },
  { chemin: '/actualites/[slug]', libelle: 'Article', rubrique: 'aujourdhui', parent: '/actualites', statut: 'public', raison: 'article (SEO)' },
  { chemin: '/veille', libelle: 'Veille', rubrique: 'aujourdhui', parent: '/actualites', statut: 'secondaire', raison: ONGLET('Actualités') },
  { chemin: '/weekly', libelle: 'Matières premières', rubrique: 'aujourdhui', parent: '/actualites', statut: 'secondaire', raison: ONGLET('Actualités') },
  { chemin: '/weekly/[slug]', libelle: 'Édition hebdomadaire', rubrique: 'aujourdhui', parent: '/weekly', statut: 'parcours', raison: 'édition datée, atteinte depuis la liste et la newsletter' },
  { chemin: '/weekly/thesis', libelle: 'Exposition aux matières premières', rubrique: 'aujourdhui', parent: '/weekly', statut: 'secondaire', raison: 'référentiel lié depuis Matières premières' },
  { chemin: '/calendrier', libelle: 'Agenda', rubrique: 'aujourdhui', statut: 'menu' },
  { chemin: '/premium/calendrier', libelle: 'Dates clés', rubrique: 'aujourdhui', parent: '/calendrier', statut: 'secondaire', raison: ONGLET("l'Agenda"), premium: true },
  { chemin: '/analyses', libelle: 'Analyses', rubrique: 'aujourdhui', statut: 'menu' },
  { chemin: '/analyses/[slug]', libelle: 'Analyse', rubrique: 'aujourdhui', parent: '/analyses', statut: 'public', raison: 'analyse citable (SEO)' },
  { chemin: '/analyses/hebdo', libelle: 'Valeurs de la semaine', rubrique: 'aujourdhui', parent: '/analyses', statut: 'public', raison: 'index hebdomadaire (SEO)' },
  { chemin: '/analyses/hebdo/[date]', libelle: 'Valeurs de la semaine', rubrique: 'aujourdhui', parent: '/analyses/hebdo', statut: 'public', raison: 'semaine datée (SEO)', libelleParam: true },

  // ── Le marché ──────────────────────────────────────────────────────────────
  { chemin: '/actions', libelle: 'Actions', rubrique: 'marche', statut: 'menu' },
  { chemin: '/actions/[code]', libelle: 'Fiche valeur', rubrique: 'marche', parent: '/actions', statut: 'public', raison: 'fiche valeur, atteinte depuis les listes', libelleParam: true },
  { chemin: '/actions/[code]/financials', libelle: 'États financiers', rubrique: 'marche', parent: '/actions/[code]', statut: 'public', raison: 'document de la fiche' },
  { chemin: '/actions/[code]/print', libelle: 'Version imprimable', rubrique: 'marche', parent: '/actions/[code]/financials', statut: 'parcours', raison: "sortie d'impression", sansFil: true },
  { chemin: '/actions/[code]/quant', libelle: 'Fiche Quant', rubrique: 'marche', parent: '/actions/[code]', statut: 'public', raison: 'document de la fiche' },
  { chemin: '/actions/[code]/revue', libelle: 'Revue de résultats', rubrique: 'marche', parent: '/actions/[code]', statut: 'public', raison: 'document de la fiche' },
  { chemin: '/rapports/dossiers', libelle: 'Dossiers valeur', rubrique: 'marche', statut: 'menu' },
  { chemin: '/rapports/revues', libelle: 'Revues de résultats', rubrique: 'marche', parent: '/rapports/dossiers', statut: 'secondaire', raison: ONGLET('Rapports') },
  { chemin: '/actions/compare', libelle: 'Comparer des actions', rubrique: 'marche', parent: '/actions', statut: 'secondaire', raison: 'lié depuis Actions et la palette' },
  { chemin: '/rapports/dossier/[code]', libelle: 'Dossier A4', rubrique: 'marche', parent: '/actions/[code]', statut: 'parcours', raison: 'document imprimable de la fiche' },
  { chemin: '/societes', libelle: 'Sociétés cotées', libelleMenu: 'Sociétés', rubrique: 'marche', statut: 'menu' },
  { chemin: '/societes/[code]', libelle: 'Fiche société', rubrique: 'marche', parent: '/societes', statut: 'public', raison: 'fiche publique (SEO)', libelleParam: true },
  { chemin: '/obligations', libelle: 'Obligations', rubrique: 'marche', statut: 'menu' },
  { chemin: '/secteurs', libelle: 'Secteurs', rubrique: 'marche', statut: 'menu' },
  { chemin: '/heatmap', libelle: 'Heatmap', rubrique: 'marche', statut: 'menu' },
  { chemin: '/fondamentaux', libelle: 'Fondamentaux', rubrique: 'marche', statut: 'menu' },
  { chemin: '/notations', libelle: 'Notations financières', rubrique: 'marche', parent: '/fondamentaux', statut: 'secondaire', raison: ONGLET('Fondamentaux') },
  { chemin: '/liquidite', libelle: 'Liquidité', rubrique: 'marche', statut: 'menu' },
  { chemin: '/premium/classements', libelle: 'Palmarès', rubrique: 'marche', statut: 'menu', premium: true },

  // ── Trouver une idée ───────────────────────────────────────────────────────
  { chemin: '/screener', libelle: 'Screener multi-critères', libelleMenu: 'Filtrer', rubrique: 'idee', statut: 'menu', premium: true },
  { chemin: '/scanner', libelle: 'Scanner technique', rubrique: 'idee', parent: '/screener', statut: 'secondaire', raison: ONGLET('Filtrer'), premium: true },
  { chemin: '/screener/intraday', libelle: 'Screener intraday', rubrique: 'idee', parent: '/screener', statut: 'secondaire', raison: 'vue de séance, liée depuis Filtrer et la palette' },
  { chemin: '/signaux', libelle: 'Signaux', rubrique: 'idee', statut: 'menu', premium: true },
  { chemin: '/conseiller', libelle: 'Conseiller', rubrique: 'idee', statut: 'menu' },
  { chemin: '/conseiller/track-record', libelle: 'Bilan du Conseiller', rubrique: 'idee', parent: '/conseiller', statut: 'secondaire', raison: 'lié depuis le Conseiller' },
  { chemin: '/saisonnalite', libelle: 'Saisonnalité', rubrique: 'idee', statut: 'menu', premium: true },
  { chemin: '/saisonnalite/ce-mois-ci', libelle: 'Ce mois-ci', rubrique: 'idee', parent: '/saisonnalite', statut: 'secondaire', raison: 'lié depuis Saisonnalité' },
  { chemin: '/premium/valorisation', libelle: 'Valorisation', rubrique: 'idee', statut: 'menu', premium: true },
  { chemin: '/premium/dcf', libelle: 'Valorisation DCF', rubrique: 'idee', parent: '/premium/valorisation', statut: 'secondaire', raison: ONGLET('Valorisation'), premium: true },
  { chemin: '/premium/dcf/[code]', libelle: 'DCF', rubrique: 'idee', parent: '/premium/dcf', statut: 'parcours', raison: 'détail atteint depuis le classement DCF', premium: true, libelleParam: true },
  { chemin: '/premium/diagnostic', libelle: 'Diagnostic', rubrique: 'idee', statut: 'menu', premium: true },
  { chemin: '/premium/diagnostic/[code]', libelle: 'Diagnostic', rubrique: 'idee', parent: '/premium/diagnostic', statut: 'parcours', raison: 'diagnostic d’une société, choisie sur la page parente', premium: true, libelleParam: true },
  { chemin: '/assistant', libelle: 'Poser une question', rubrique: 'idee', statut: 'menu', premium: true },
  { chemin: '/analyse/combined-alpha', libelle: 'Combined Alpha', rubrique: 'idee', statut: 'menu', premium: true },
  { chemin: '/backtest', libelle: 'Backtest', rubrique: 'idee', statut: 'menu', premium: true },
  { chemin: '/backtests/demo', libelle: 'Infographie de backtest', rubrique: 'idee', parent: '/backtest', statut: 'interne', raison: 'support du test e2e/animated.spec.ts' },
  { chemin: '/premium/outils', libelle: 'Outils Pro', rubrique: 'idee', statut: 'menu', premium: true },
  { chemin: '/premium/anomalies', libelle: 'Anomalies de marché', rubrique: 'idee', parent: '/premium/outils', statut: 'secondaire', raison: 'outil du hub Outils Pro', premium: true },
  { chemin: '/premium/correlations', libelle: 'Corrélations avec les matières premières', rubrique: 'idee', parent: '/premium/outils', statut: 'secondaire', raison: 'outil du hub Outils Pro', premium: true },
  { chemin: '/premium/comparateur', libelle: "Classes d'actifs", rubrique: 'idee', parent: '/premium/outils', statut: 'secondaire', raison: 'outil du hub Outils Pro', premium: true },

  // ── Mes revenus ────────────────────────────────────────────────────────────
  { chemin: '/dividendes', libelle: 'Dividendes', rubrique: 'revenus', statut: 'menu' },
  { chemin: '/dividendes/calendrier', libelle: 'Calendrier des dividendes', rubrique: 'revenus', parent: '/dividendes', statut: 'secondaire', raison: ONGLET('Dividendes') },
  { chemin: '/fiscalite', libelle: 'Fiscalité des dividendes', rubrique: 'revenus', parent: '/dividendes', statut: 'public', raison: 'page publique (SEO), onglet de Dividendes' },
  { chemin: '/rendement-vrai', libelle: 'Rendement réel', rubrique: 'revenus', parent: '/dividendes', statut: 'public', raison: 'page publique (SEO), liée depuis Dividendes' },
  { chemin: '/simulateur', libelle: "Et si j'avais investi ?", libelleMenu: 'Simulateurs', rubrique: 'revenus', statut: 'menu' },
  { chemin: '/simulateur/[code]', libelle: "Et si j'avais investi ?", rubrique: 'revenus', parent: '/simulateur', statut: 'public', raison: 'simulation sur une valeur (SEO)', libelleParam: true },
  { chemin: '/simulateur-budget', libelle: 'Que faire de mon budget ?', rubrique: 'revenus', parent: '/simulateur', statut: 'public', raison: 'simulateur public (SEO)' },

  // ── Mon portefeuille ───────────────────────────────────────────────────────
  { chemin: '/portefeuille', libelle: 'Portefeuille', rubrique: 'portefeuille', statut: 'menu' },
  { chemin: '/portefeuille/import', libelle: 'Importer un relevé SGI', rubrique: 'portefeuille', parent: '/portefeuille', statut: 'secondaire', raison: 'lié depuis le portefeuille' },
  { chemin: '/journal', libelle: 'Journal de décision', libelleMenu: 'Journal', rubrique: 'portefeuille', statut: 'menu' },
  { chemin: '/parametres/alertes', libelle: 'Mes alertes', libelleMenu: 'Alertes', rubrique: 'portefeuille', statut: 'menu' },
  { chemin: '/premium/paper-trading', libelle: 'Portefeuille virtuel', rubrique: 'portefeuille', statut: 'menu' },
  { chemin: '/classement', libelle: 'Classement des portefeuilles virtuels', rubrique: 'portefeuille', parent: '/premium/paper-trading', statut: 'secondaire', raison: 'lié depuis le portefeuille virtuel' },
  { chemin: '/dashboard/reports/events', libelle: 'Événements de marché', rubrique: 'marche', parent: '/rapports/dossiers', statut: 'secondaire', raison: ONGLET('Rapports') },
  { chemin: '/dashboard/reports/events/[id]', libelle: "Étude d'événement", rubrique: 'marche', parent: '/dashboard/reports/events', statut: 'parcours', raison: 'détail atteint depuis la liste des événements' },
  { chemin: '/premium/reports', libelle: 'Relevé mensuel', libelleMenu: 'Mon relevé', rubrique: 'portefeuille', statut: 'menu', premium: true },
  { chemin: '/premium/reports/[month]', libelle: 'Rapport mensuel', rubrique: 'portefeuille', parent: '/premium/reports', statut: 'parcours', raison: 'mois atteint depuis l’archive', premium: true, libelleParam: true },

  // ── Apprendre ──────────────────────────────────────────────────────────────
  { chemin: '/debutant', libelle: 'Débuter', rubrique: 'apprendre', statut: 'menu' },
  { chemin: '/formations', libelle: 'Formations et conférences', libelleMenu: 'Academy et formations', rubrique: 'apprendre', statut: 'menu' },
  { chemin: '/formations/academy', libelle: 'WestBourse Academy', rubrique: 'apprendre', parent: '/formations', statut: 'public', raison: 'hub de l’Academy (SEO)' },
  { chemin: '/formations/academy/[slug]', libelle: 'Leçon', rubrique: 'apprendre', parent: '/formations/academy', statut: 'public', raison: 'leçon de l’Academy' },
  { chemin: '/formations/academy/certificat', libelle: 'Certificat', rubrique: 'apprendre', parent: '/formations/academy', statut: 'parcours', raison: 'génération du certificat après l’examen' },
  { chemin: '/formations/academy/examen/[niveau]', libelle: 'Examen', rubrique: 'apprendre', parent: '/formations/academy', statut: 'parcours', raison: 'examen d’un niveau, depuis le hub et les leçons' },
  { chemin: '/formations/academy/integrale', libelle: 'Édition intégrale', rubrique: 'apprendre', parent: '/formations/academy', statut: 'public', raison: 'toutes les leçons sur une page' },
  { chemin: '/formations/academy/lecon-0', libelle: 'Leçon 0', rubrique: 'apprendre', parent: '/formations/academy', statut: 'public', raison: 'leçon gratuite (SEO)' },
  { chemin: '/formations/modules', libelle: 'Modules vidéo', rubrique: 'apprendre', parent: '/formations', statut: 'secondaire', raison: 'lié depuis Formations' },
  { chemin: '/formations/modules/[course]', libelle: 'Module vidéo', rubrique: 'apprendre', parent: '/formations/modules', statut: 'parcours', raison: 'lecteur atteint depuis la liste des modules' },
  { chemin: '/formations/sessions', libelle: 'Formations en direct', rubrique: 'apprendre', parent: '/formations', statut: 'public', raison: 'sessions en direct (SEO)' },
  { chemin: '/formations/sessions/[id]', libelle: 'Session', rubrique: 'apprendre', parent: '/formations/sessions', statut: 'public', raison: 'fiche d’une session' },
  { chemin: '/premium/formations/[id]', libelle: 'Formation', rubrique: 'apprendre', parent: '/formations', statut: 'parcours', raison: 'replay atteint depuis Formations', premium: true },
  { chemin: '/comparateur-sgi', libelle: 'Choisir sa SGI', rubrique: 'apprendre', statut: 'menu' },
  { chemin: '/comparateur-sgi/annuaire', libelle: 'Annuaire des SGI', rubrique: 'apprendre', parent: '/comparateur-sgi', statut: 'public', raison: 'module du comparateur (SEO)' },
  { chemin: '/comparateur-sgi/annuaire/[slug]', libelle: 'Fiche SGI', rubrique: 'apprendre', parent: '/comparateur-sgi/annuaire', statut: 'public', raison: 'fiche d’une SGI (SEO)' },
  { chemin: '/comparateur-sgi/comparer', libelle: 'Comparer les SGI', rubrique: 'apprendre', parent: '/comparateur-sgi', statut: 'public', raison: 'module du comparateur (SEO)' },
  { chemin: '/comparateur-sgi/methodologie', libelle: 'Méthodologie du comparateur', rubrique: 'apprendre', parent: '/comparateur-sgi', statut: 'public', raison: 'module du comparateur (SEO)' },
  { chemin: '/comparateur-sgi/simuler', libelle: 'Combien coûte ma SGI ?', rubrique: 'apprendre', parent: '/comparateur-sgi', statut: 'public', raison: 'module du comparateur (SEO)' },
  { chemin: '/comparateur-sgi/trouver', libelle: 'Trouver ma SGI', rubrique: 'apprendre', parent: '/comparateur-sgi', statut: 'public', raison: 'module du comparateur (SEO)' },
  { chemin: '/forum', libelle: 'Forum', rubrique: 'apprendre', statut: 'menu' },
  { chemin: '/forum/[id]', libelle: 'Sujet', rubrique: 'apprendre', parent: '/forum', statut: 'parcours', raison: 'sujet atteint depuis le forum' },
  { chemin: '/forum/nouveau', libelle: 'Nouveau sujet', rubrique: 'apprendre', parent: '/forum', statut: 'parcours', raison: 'formulaire lié depuis le forum' },
  { chemin: '/methodologie', libelle: 'Méthodologie', rubrique: 'apprendre', statut: 'menu' },
  { chemin: '/qualite-donnees', libelle: 'Qualité des données', rubrique: 'apprendre', parent: '/methodologie', statut: 'public', raison: 'transparence : contrôle quotidien contre le Bulletin officiel (SEO)' },
  { chemin: '/operations-titres', libelle: 'Opérations sur titres', rubrique: 'apprendre', parent: '/methodologie', statut: 'public', raison: 'registre public des fractionnements et suspensions (SEO)' },

  // ── Compte (menu de l'avatar) ──────────────────────────────────────────────
  { chemin: '/parametres/compte', libelle: 'Mon compte', racine: true, statut: 'secondaire', raison: COMPTE },
  { chemin: '/profil', libelle: 'Mon profil', parent: '/parametres/compte', statut: 'secondaire', raison: COMPTE },
  { chemin: '/account/plan', libelle: 'Mon abonnement', parent: '/parametres/compte', statut: 'secondaire', raison: COMPTE },
  { chemin: '/account/billing', libelle: 'Facturation', parent: '/parametres/compte', statut: 'secondaire', raison: COMPTE },
  { chemin: '/account/security', libelle: 'Sécurité', parent: '/parametres/compte', statut: 'secondaire', raison: COMPTE },
  { chemin: '/account/security/verify', libelle: 'Vérification', parent: '/account/security', statut: 'parcours', raison: 'étape de double authentification' },
  { chemin: '/account/achats', libelle: 'Mes achats', parent: '/parametres/compte', statut: 'secondaire', raison: COMPTE },
  { chemin: '/account/formations', libelle: 'Mes formations', parent: '/parametres/compte', statut: 'secondaire', raison: COMPTE },
  { chemin: '/account/newsletters', libelle: 'Préférences newsletter', parent: '/parametres/compte', statut: 'secondaire', raison: 'lié depuis Mon compte' },

  // ── Hors rubrique ──────────────────────────────────────────────────────────
  { chemin: '/', libelle: 'Accueil', racine: true, statut: 'public', raison: 'landing publique' },
  { chemin: '/pricing', libelle: 'Formules et tarifs', racine: true, statut: 'public', raison: 'pied de page et menu du compte' },
  { chemin: '/developers', libelle: 'API et widgets', racine: true, statut: 'public', raison: 'pied de page' },
  { chemin: '/cgu', libelle: "Conditions générales d'utilisation", racine: true, statut: 'public', raison: 'page légale' },
  { chemin: '/confidentialite', libelle: 'Politique de confidentialité', racine: true, statut: 'public', raison: 'page légale' },
  { chemin: '/mentions-legales', libelle: 'Mentions légales', racine: true, statut: 'public', raison: 'page légale' },
  { chemin: '/certificat/[id]', libelle: 'Certificat', racine: true, statut: 'public', raison: 'vérification publique d’un certificat partagé' },
  { chemin: '/login', libelle: 'Connexion', racine: true, statut: 'parcours', raison: 'authentification' },
  { chemin: '/signup', libelle: 'Inscription', racine: true, statut: 'parcours', raison: 'authentification' },
  { chemin: '/bienvenue', libelle: 'Bienvenue', racine: true, statut: 'parcours', raison: 'accueil après inscription' },
  { chemin: '/bienvenue/whatsapp', libelle: 'WhatsApp', parent: '/bienvenue', statut: 'parcours', raison: 'appairage proposé aux nouveaux comptes' },
  { chemin: '/premium/upgrade', libelle: 'Accès Premium', racine: true, statut: 'parcours', raison: 'porte Premium (middleware et cadenas)' },
  { chemin: '/paiement/annule', libelle: 'Paiement annulé', racine: true, statut: 'parcours', raison: 'retour Chariow' },
  { chemin: '/paiement/succes', libelle: 'Paiement confirmé', racine: true, statut: 'parcours', raison: 'retour Chariow' },
  { chemin: '/offre/dossier', libelle: 'Dossier offert', racine: true, statut: 'parcours', raison: 'lien d’e-mail de relance' },
  { chemin: '/crm/opposition', libelle: 'Ne plus recevoir de proposition', racine: true, statut: 'parcours', raison: 'lien d’opposition des e-mails' },
  { chemin: '/embed/heatmap', libelle: 'Widget heatmap', racine: true, statut: 'interne', raison: 'widget pour iframe tierce' },
  { chemin: '/embed/ticker', libelle: 'Widget bandeau de cours', racine: true, statut: 'interne', raison: 'widget pour iframe tierce' },
  { chemin: '/embed/valeur/[code]', libelle: 'Widget valeur', racine: true, statut: 'interne', raison: 'widget pour iframe tierce' },
  { chemin: '/apercu', libelle: 'Aperçu', racine: true, statut: 'interne', raison: 'maquette non indexée' },
  { chemin: '/apercu/actions', libelle: 'Aperçu Actions', parent: '/apercu', statut: 'interne', raison: 'maquette non indexée' },
  { chemin: '/apercu/dashboard', libelle: 'Aperçu Tableau de bord', parent: '/apercu', statut: 'interne', raison: 'maquette non indexée' },
  { chemin: '/apercu/heatmap', libelle: 'Aperçu Heatmap', parent: '/apercu', statut: 'interne', raison: 'maquette non indexée' },
  { chemin: '/apercu/obligations', libelle: 'Aperçu Obligations', parent: '/apercu', statut: 'interne', raison: 'maquette non indexée' },
  { chemin: '/apercu/portefeuille', libelle: 'Aperçu Portefeuille', parent: '/apercu', statut: 'interne', raison: 'maquette non indexée' },
  { chemin: '/apercu/signaux', libelle: 'Aperçu Signaux', parent: '/apercu', statut: 'interne', raison: 'maquette non indexée' },
  { chemin: '/apercu/societes', libelle: 'Aperçu Sociétés', parent: '/apercu', statut: 'interne', raison: 'maquette non indexée' },
];

/** Entrées du menu du compte (avatar), dans l'ordre d'affichage. */
export const MENU_COMPTE: { href: string; label: string }[] = [
  { href: '/account/plan', label: 'Mon abonnement' },
  { href: '/account/billing', label: 'Facturation' },
  { href: '/account/security', label: 'Sécurité' },
  { href: '/profil', label: 'Mon profil' },
  { href: '/account/achats', label: 'Mes achats' },
  { href: '/account/formations', label: 'Mes formations' },
  { href: '/parametres/compte', label: 'Données personnelles' },
  { href: '/pricing', label: 'Formules et tarifs' },
];

// ── Lecture du registre ──────────────────────────────────────────────────────

const PAR_CHEMIN = new Map(REGISTRE.map((e) => [e.chemin, e]));

export function entreeParChemin(chemin: string): EntreeNav | undefined {
  return PAR_CHEMIN.get(chemin);
}

export function estDynamique(chemin: string): boolean {
  return chemin.includes('[');
}

function segments(chemin: string): string[] {
  return chemin.split('/').filter(Boolean);
}

/** Retire la query, le fragment et la barre finale. */
export function normaliserChemin(pathname: string): string {
  const p = (pathname || '/').split(/[?#]/)[0];
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p || '/';
}

export interface Correspondance {
  entree: EntreeNav;
  /** Paramètres dynamiques lus dans l'adresse réelle. */
  params: Record<string, string>;
}

/**
 * Trouve l'entrée du registre qui sert `pathname`. Une route statique l'emporte
 * sur une route dynamique de même longueur (comme dans Next : /actions/compare
 * avant /actions/[code]). `null` si l'adresse ne correspond à aucune page.
 */
export function trouverEntree(pathname: string): Correspondance | null {
  const chemin = normaliserChemin(pathname);
  const exacte = PAR_CHEMIN.get(chemin);
  if (exacte) return { entree: exacte, params: {} };
  const reels = segments(chemin);
  let meilleure: { c: Correspondance; dyn: number } | null = null;
  for (const entree of REGISTRE) {
    if (!estDynamique(entree.chemin)) continue;
    const modele = segments(entree.chemin);
    if (modele.length !== reels.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    let dyn = 0;
    for (let i = 0; i < modele.length; i++) {
      const m = modele[i];
      if (m.startsWith('[') && m.endsWith(']')) {
        dyn++;
        params[m.slice(1, -1)] = reels[i];
      } else if (m !== reels[i]) {
        ok = false;
        break;
      }
    }
    if (ok && (!meilleure || dyn < meilleure.dyn)) meilleure = { c: { entree, params }, dyn };
  }
  return meilleure?.c ?? null;
}

/** Remplace les segments `[x]` d'un modèle par les paramètres connus. */
export function remplirChemin(modele: string, params: Record<string, string>): string | null {
  let manque = false;
  const rempli = modele.replace(/\[([^\]]+)\]/g, (_, nom: string) => {
    const v = params[nom];
    if (v == null) {
      manque = true;
      return '';
    }
    return v;
  });
  return manque ? null : rempli;
}

/** Chaîne des entrées de la racine jusqu'à la page (incluse). */
export function chaineParents(entree: EntreeNav): EntreeNav[] {
  const chaine: EntreeNav[] = [entree];
  const vus = new Set<string>([entree.chemin]);
  let courant = entree;
  while (courant.parent) {
    const p = PAR_CHEMIN.get(courant.parent);
    if (!p || vus.has(p.chemin)) break;
    chaine.unshift(p);
    vus.add(p.chemin);
    courant = p;
  }
  return chaine;
}

export function libelleRubrique(r: Rubrique | undefined): string | null {
  return RUBRIQUES.find((x) => x.id === r)?.libelle ?? null;
}

/** Pages indexées par la palette : menu, secondaire et public, hors pages dynamiques. */
export function entreesPalette(): EntreeNav[] {
  return REGISTRE.filter(
    (e) => (e.statut === 'menu' || e.statut === 'secondaire' || e.statut === 'public') && !estDynamique(e.chemin) && e.chemin !== '/',
  );
}
