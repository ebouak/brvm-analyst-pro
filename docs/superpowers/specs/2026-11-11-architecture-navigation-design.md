# Architecture de l'information et navigation : diagnostic et proposition

Date : 2026-11-11. Statut : **proposition, en attente de validation**. Aucun fichier du site n'a été modifié.

Base examinée : `main` au commit `b7e076bc` (Next 15.5.29), build de production local.

## 0. Méthode, et ce que valent les chiffres

- **Inventaire statique** : liste récursive des `page.tsx` de `frontend/app` (**190**, dont 141 hors administration et 49 sous `/admin`), puis graphe des liens tiré du code (`Link`, `href`, `router.push`, `redirect`), en suivant les imports de composants jusqu'à six niveaux.
- **Relevé dans un vrai navigateur** : serveur de production local (`next build` puis `next start`, celui qu'utilise déjà la suite Playwright), base Supabase de production en lecture.
  - Trois profils : **visiteur** sans session, **qa-e2e-actif@** (Premium, 2 positions) et **qa-e2e-debutant@** (gratuit, aucune position). Les sessions viennent de `scripts/qa-sessions-locales.mjs`, qui a fonctionné sans réparation et a été fermé par `--fermer` à la fin.
  - Deux largeurs : 1366 px et 390 px. **846 chargements de page.**
  - Pour chaque page : titre rendu (`innerText`), élément de menu actif (sidebar, tiroir mobile ouvert, barre du bas), fil d'Ariane et JSON-LD, lien de retour, bouton Précédent après une arrivée depuis le tableau de bord, liens réellement affichés dans le contenu, état vide, valeur cassée, débordement horizontal.
- **Admin** : les comptes de test ne sont pas administrateurs. Les 49 pages `/admin` sont **analysées dans le code seulement**.
- **Usage** : la seule mesure existante est PostHog (hôte UE), **chargé seulement après consentement**. Sur 30 jours : **1 045 vues** de page. C'est un échantillon biaisé (consentants seulement), qui indique des tendances, jamais des volumes.
- **Fable** consulté une fois (politique d'URL et suppressions) ; verdict repris en §7 et §9.

## 1. Inventaire des 190 pages

Colonnes : h1 et `<title>` rendus (compte actif ; « aucun h1 rendu » = vérifié dans le navigateur), public (middleware et `canAccess`), shell (`ConditionalShell`), place dans la nav (`lib/nav.ts`), liens entrants (pages qui affichent un lien vers celle-ci) et sortants (liens présents dans le code de la page et de ses composants), moyen de revenir (relevé dans le navigateur), arrivées externes (URL construites dans `scraper/`, `video/`, `frontend/lib`, `app/sitemap.ts`). Pages dynamiques relevées avec un exemple réel (voir §11). Admin : code seulement.

| URL | h1 rendu | `<title>` | Objet | Question | Public | Shell | Nav | Liens entrants / sortants | Moyen de revenir | Arrivées externes |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Les 48 valeurs de la BRVM, chiffre par chiffre,… | WESTBOURSE — Décidez sur la BRVM avec d… | Landing publique : séance du jour, méthode, offres | Qu'est-ce que WESTBOURSE et que montre le marché aujourd'hui ? | visiteur | plein écran | hors menu | 36 / 29 | rien | sitemap, e-mails (logo) |
| `/account/achats` | Mes achats | Mes achats | Niveaux Academy et pass achetés (Chariow) | Qu'ai-je acheté et à quoi ai-je accès ? | connecté + canAccess(formations) | sidebar | hors menu | 2 / 2 | sidebar, aucun élément actif |  |
| `/account/billing` | Facturation | Facturation | Historique des transactions | Combien ai-je payé, et quand ? | connecté | sidebar | menu › Compte › Facturation | 0 / 1 | menu actif |  |
| `/account/formations` | Mes formations | Mes formations | Inscriptions aux sessions en direct | À quelles sessions suis-je inscrit ? | connecté | sidebar | hors menu | 0 / 2 | sidebar, aucun élément actif |  |
| `/account/newsletters` | Préférences newsletter | Préférences newsletter | Préférences d'abonnement aux lettres | Quelles lettres est-ce que je reçois ? | connecté | sidebar | hors menu | 1 / 2 | lien retour |  |
| `/account/plan` | Mon abonnement | Mon abonnement | Formule, options Premium, souscription | Quelle est ma formule et comment passer Premium ? | connecté + canAccess(formations) | sidebar | menu › Compte › Mon abonnement | 13 / 4 | menu actif | e-mail Pass, CRM |
| `/account/security` | Sécurité | Sécurité du compte | Double authentification, connexions récentes | Mon compte est-il protégé ? | connecté | sidebar | menu › Compte › Sécurité | 0 / 4 | lien retour, menu actif |  |
| `/account/security/verify` | Sécurité | Sécurité du compte | Saisie du code de double authentification | (étape technique) | connecté | sidebar | hors menu | 0 / 2 | lien retour, menu actif |  |
| `/actions` | Marché actions | Marché actions | Tableau de toute la cote : cours, variation, volume | Comment se porte chaque action aujourd'hui ? | visiteur + canAccess(actions_metrics) | sidebar | menu › Marché › Actions | 9 / 3 | menu actif | WhatsApp (commandes) |
| `/actions/[code]` | PRSC | TRACTAFRIC MOTORS CI (PRSC) · cours, di… | Fiche valeur complète (synthèse, technique, fondamentaux, liquidité, … | Que vaut cette action, et que se passe-t-il dessus ? | visiteur + canAccess(indicateurs_techniques,signaux,fondamentaux,dcf,lecture_seance) | sidebar | hors menu | 26 / 25 | menu actif | WhatsApp (COURS) |
| `/actions/[code]/financials` | SNTS | WESTBOURSE — Cours BRVM, Notes A–F & An… | États financiers et publications d'une valeur | Que disent les comptes de cette société ? | visiteur + canAccess(fondamentaux,dcf) | sidebar | hors menu | 5 / 7 | fil d'Ariane, lien retour, menu actif |  |
| `/actions/[code]/print` | SNTS — SONATEL | WESTBOURSE — Cours BRVM, Notes A–F & An… | Version imprimable des états financiers | (sortie d'impression) | visiteur | sidebar | hors menu | 0 / 0 | menu actif |  |
| `/actions/[code]/quant` | SNTS · SONATEL | WESTBOURSE — Cours BRVM, Notes A–F & An… | Fiche Quant : score Combined Alpha et piliers | Où se place cette valeur sur le score quantitatif ? | visiteur | sidebar | hors menu | 4 / 6 | fil d'Ariane, lien retour, menu actif |  |
| `/actions/[code]/rapport` | Note d'analyse · SONATEL | WESTBOURSE — Cours BRVM, Notes A–F & An… | Rapport analyste imprimable (h1 « Note d'analyse ») | Quelle synthèse écrite garder sur cette valeur ? | visiteur | sidebar | hors menu | 0 / 0 | menu actif |  |
| `/actions/[code]/revue` | Revue de résultats · SONATEL | Revue de résultats | Revue de résultats : résultats, cours, dividendes | Comment la société a-t-elle publié, et le marché a-t-il réagi ? | visiteur | sidebar | hors menu | 3 / 4 | fil d'Ariane, lien retour, menu actif |  |
| `/actions/compare` | Comparateur multi-titres | WESTBOURSE — Cours BRVM, Notes A–F & An… | Comparateur multi-titres | Laquelle de ces actions choisir ? | visiteur | sidebar | palette seule | 1 / 1 | lien retour, menu actif |  |
| `/actualites` | Actualités | Actualités BRVM | Fil d'actualités (communiqués, presse, articles maison) | Que s'est-il passé sur le marché et les sociétés ? | visiteur | sidebar | menu › Intelligence › Actualités et vei… | 12 / 10 | lien retour, menu actif | sitemap, brief vidéo |
| `/actualites/[slug]` | Sonatel : 6 piliers tenus sur 6, mais avec des … | Sonatel : 6 piliers tenus sur 6, mais a… | Article (dont « Décryptage valeur ») | Que dit cet article ? | visiteur | sidebar | hors menu | 2 / 2 | menu actif | sitemap, WhatsApp/Telegram, LinkedIn/TikTok, e-mail article |
| `/admin` | Poste de pilotage | Administration | Console d'administration | (exploitation) | admin | plein écran | menu › | 50 / 10 | menu admin (AdminShell) |  |
| `/admin/academy` | Cours générés par IA | Academy (IA) — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 6 | menu admin (AdminShell) |  |
| `/admin/academy/[slug]/edit` | Éditer le cours | Éditer un cours — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/agent-reach-experimental` | Agent Reach — Experimental |  | Console d'administration | (exploitation) | admin | plein écran | hors menu | 0 / 4 | menu admin (AdminShell) |  |
| `/admin/analyses` | Analyses citables | Analyses citables — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 2 / 6 | menu admin (AdminShell) |  |
| `/admin/analyses/[slug]` | (composant) {…} | Éditer l’analyse — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 6 | menu admin (AdminShell) |  |
| `/admin/analyses/nouvelle` | Nouvelle analyse | Nouvelle analyse — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/api-clients` | Clients de l'API | Clients API — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 1 / 4 | menu admin (AdminShell) |  |
| `/admin/articles` | Articles de presse |  | Console d'administration | (exploitation) | admin | plein écran | menu admin | 1 / 6 | menu admin (AdminShell) |  |
| `/admin/articles/[id]` | {…} |  | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/audience` | Audience du site | Audience — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 1 / 6 | menu admin (AdminShell) |  |
| `/admin/audience/rapport` | Rapport d'audience — {…} | Rapport d | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/audit-logs` | Journal d'audit | Journal d | Console d'administration | (exploitation) | admin | plein écran | menu admin | 1 / 4 | menu admin (AdminShell) |  |
| `/admin/cles-api` | Clés API | Clés API | Console d'administration | (exploitation) | admin | plein écran | menu › Admin › Clés API | 2 / 5 | menu admin (AdminShell) |  |
| `/admin/coherence` | Cohérence des fiches société | Cohérence des fiches — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 0 / 5 | menu admin (AdminShell) |  |
| `/admin/contact` | Messages de contact | Messages de contact — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 2 / 5 | menu admin (AdminShell) |  |
| `/admin/contact/[id]` | (composant) {…} | Message de contact — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/content` | Contenu | Contenu — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 4 | menu admin (AdminShell) |  |
| `/admin/controle` | Tour de contrôle | Tour de contrôle — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 10 | menu admin (AdminShell) |  |
| `/admin/crm` | CRM · proches du Premium | CRM — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 3 / 6 | menu admin (AdminShell) |  |
| `/admin/crm/[cle]` | (composant) {…} | Fiche CRM — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/features` | Fonctionnalités | Fonctionnalités — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 1 / 4 | menu admin (AdminShell) |  |
| `/admin/formations` | Formations & conférences | Formations — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/formations/modules` | Modules vidéo interactifs | Modules vidéo — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/formations/sessions` | Formations en direct | Sessions live — administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 4 | menu admin (AdminShell) |  |
| `/admin/forum` | Modération du forum | Modération forum — Admin | Console d'administration | (exploitation) | admin | plein écran | menu › Admin › Modération forum | 0 / 4 | menu admin (AdminShell) |  |
| `/admin/hebdo` | Analyses hebdomadaires |  | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 5 | menu admin (AdminShell) |  |
| `/admin/import-fondamentaux` | Import fondamentaux |  | Console d'administration | (exploitation) | admin | plein écran | menu › Admin › Import IA | 2 / 4 | menu admin (AdminShell) |  |
| `/admin/import-sgi-tarifs` | Import tarifs SGI |  | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 4 | menu admin (AdminShell) |  |
| `/admin/landing` | Landing — À la une | Landing — À la une — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 4 | menu admin (AdminShell) |  |
| `/admin/leads` | Leads débutants | Leads débutants — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 4 | menu admin (AdminShell) |  |
| `/admin/newsletter` | Newsletter | Newsletter — Administration | Console d'administration | (exploitation) | admin | plein écran | menu › Admin › Newsletter | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/organizations` | Organisations | Organisations — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/organizations/[id]` | (composant) {…} | Organisation — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 6 | menu admin (AdminShell) |  |
| `/admin/payments` | Paiements | Paiements — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 2 / 4 | menu admin (AdminShell) |  |
| `/admin/qualite` | Qualité & Tests | Qualité & Tests — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 2 / 5 | menu admin (AdminShell) |  |
| `/admin/qualite/[run]` | Passage du ${fmtDate(run.debut_at)} | Exécution de tests — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 2 / 6 | menu admin (AdminShell) |  |
| `/admin/qualite/scenario/[id]` | (composant) {…} | Scénario de test — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/reports` | Rapports IA | Rapports IA — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 5 | menu admin (AdminShell) |  |
| `/admin/reseaux` | Réseaux sociaux | Réseaux sociaux — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 2 / 5 | menu admin (AdminShell) |  |
| `/admin/reseaux/tiktok` | Publier sur TikTok | Publier sur TikTok — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/scraping` | Monitoring | Monitoring — Scraping & tâches planifié… | Console d'administration | (exploitation) | admin | plein écran | menu admin | 2 / 4 | menu admin (AdminShell) |  |
| `/admin/settings` | (composant) {…} |  | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 4 | menu admin (AdminShell) |  |
| `/admin/subscriptions` | Abonnements | Abonnements — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 1 / 4 | menu admin (AdminShell) |  |
| `/admin/users` | Utilisateurs | Utilisateurs — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/users/[id]` | (composant) {…} | Utilisateur — Administration | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 5 | menu admin (AdminShell) |  |
| `/admin/veille-brvm` | BRVM Veille Intelligente |  | Console d'administration | (exploitation) | admin | plein écran | menu admin | 0 / 4 | menu admin (AdminShell) |  |
| `/admin/weekly` | Rapports hebdomadaires | Rapports hebdo — Administration | Console d'administration | (exploitation) | admin | plein écran | menu admin | 1 / 6 | menu admin (AdminShell) |  |
| `/admin/weekly/[id]` | (composant) {…} |  | Console d'administration | (exploitation) | admin | plein écran | hors menu | 1 / 6 | menu admin (AdminShell) |  |
| `/analyse/combined-alpha` | Westbourse Combined Alpha | Combined Alpha — classement quant BRVM | Méthode et classement du score Combined Alpha | Comment le score est-il construit, et qui est en tête ? | visiteur | sidebar | menu › Analyse › Combined Alpha | 2 / 1 | menu actif |  |
| `/analyses` | Analyses BRVM | Analyses BRVM — rendement, fiscalité, c… | Index des analyses éditoriales citables | Quelles analyses de fond sont disponibles ? | visiteur | plein écran | palette seule | 20 / 3 | lien retour |  |
| `/analyses/[slug]` | Value traps du PER à la BRVM : quelles actions … | Value traps du PER à la BRVM : quelles … | Analyse éditoriale (méthode, sources, FAQ) | Que dit cette analyse ? | visiteur | plein écran | hors menu | 1 / 5 | lien retour | sitemap |
| `/analyses/hebdo` | Analyses hebdomadaires | Analyses hebdomadaires BRVM — valeurs e… | Index des valeurs de la semaine (technique, actions) | Quelles valeurs ont bougé cette semaine ? | visiteur | plein écran | menu › Intelligence › Analyse hebdo (ac… | 4 / 1 | rien | brief vidéo |
| `/analyses/hebdo/[date]` | Les valeurs en vue, semaine du 6 nov. 2026 | Analyse hebdo BRVM du 2026-11-06 — SCRC… | Analyse hebdo d'une semaine (cours, RSI, niveaux) | Quels niveaux surveiller sur ces valeurs ? | visiteur | plein écran | hors menu | 1 / 2 | rien | alerte hebdo |
| `/apercu` | De la donnée à la décision | WESTBOURSE — Décidez sur la BRVM avec d… | Aperçu non indexé de la landing (variante) | (maquette interne) | visiteur | plein écran | hors menu | 7 / 27 | rien |  |
| `/apercu/actions` | Aperçu — Actions | Aperçu — Actions (hybride) | Aperçu statique de la page Actions | (maquette interne) | visiteur | plein écran | hors menu | 6 / 12 | fil d'Ariane, lien retour |  |
| `/apercu/dashboard` | Apercu — Marche en direct | Apercu — Marche en direct (hybride) | Aperçu statique du tableau de bord | (maquette interne) | visiteur | plein écran | hors menu | 6 / 26 | fil d'Ariane, lien retour |  |
| `/apercu/heatmap` | Aperçu — Heatmap | Aperçu — Heatmap (hybride) | Aperçu statique de la heatmap | (maquette interne) | visiteur | plein écran | hors menu | 6 / 11 | fil d'Ariane, lien retour |  |
| `/apercu/obligations` | Aperçu — Obligations | Aperçu — Obligations (hybride) | Aperçu statique des obligations | (maquette interne) | visiteur | plein écran | hors menu | 6 / 10 | fil d'Ariane, lien retour |  |
| `/apercu/portefeuille` | Aperçu — Portefeuille | Aperçu — Portefeuille (hybride) | Aperçu statique du portefeuille | (maquette interne) | visiteur | plein écran | hors menu | 6 / 10 | fil d'Ariane, lien retour |  |
| `/apercu/signaux` | Aperçu — Signaux | Aperçu — Signaux (hybride) | Aperçu statique des signaux | (maquette interne) | visiteur | plein écran | hors menu | 6 / 11 | fil d'Ariane, lien retour |  |
| `/apercu/societes` | Aperçu — Sociétés | Aperçu — Sociétés (hybride) | Aperçu statique de l'annuaire | (maquette interne) | visiteur | plein écran | hors menu | 6 / 11 | fil d'Ariane, lien retour |  |
| `/assistant` | Poser une question | Poser une question | Assistant IA : question libre sur une valeur | Que pense l'outil de cette action, en clair ? | connecté | sidebar | menu › Premium › Poser une question | 0 / 1 | menu actif |  |
| `/backtest` | Backtest | Backtest | Backtest d'une règle momentum sur une valeur | Cette règle aurait-elle gagné de l'argent ? | connecté + canAccess(backtest) | sidebar | menu › Analyse › Backtest | 20 / 1 | menu actif |  |
| `/backtests/demo` | Infographie de backtest | Infographie de backtest · démo | Démonstration d'infographies de backtest | (démonstration interne, aucune question utilisateur) | connecté | sidebar | hors menu | 0 / 0 | menu actif |  |
| `/bienvenue` | Votre compte est prêt. Voyons une action ensemb… | Bienvenue | Accueil post-inscription : choisir une action | Par où commencer ? | connecté | sidebar | hors menu | 0 / 3 | sidebar, aucun élément actif |  |
| `/bienvenue/whatsapp` | Tableau de bord | Dashboard | Proposition d'appairage WhatsApp aux nouveaux comptes | Puis-je recevoir WESTBOURSE sur WhatsApp ? | connecté (verrou Premium) | sidebar | hors menu | 0 / 1 | menu actif |  |
| `/brief` | Le résumé de séance, chaque jour | Brief quotidien BRVM — Résumé de séance | Brief quotidien de la dernière séance | Que s'est-il passé à la dernière séance ? | visiteur | plein écran | menu › Intelligence › Brief quotidien | 7 / 16 | rien | sitemap, Telegram clôture |
| `/brief/[date]` | Note de conjoncture BRVM · séance du 10 nov. 20… | Note de conjoncture BRVM — séance du 10… | Brief d'une séance datée (h1 « Note de conjoncture ») | Que s'est-il passé ce jour-là ? | visiteur | plein écran | hors menu | 1 / 17 | fil d'Ariane | sitemap, brief composé |
| `/calendrier` | Calendrier | Calendrier | Agenda : dividendes, AG, publications à N jours | Qu'est-ce qui arrive dans les prochains jours ? | connecté | sidebar | menu › Revenus › Calendrier | 3 / 3 | menu actif |  |
| `/certificat/[id]` | Cette page n'existe pas. | Certificat introuvable | Vérification publique d'un certificat Academy | Ce certificat est-il authentique ? | visiteur | sidebar | hors menu | 0 / 0 | sidebar, aucun élément actif | partage LinkedIn |
| `/cgu` | Conditions générales d'utilisation | Conditions générales d'utilisation | Conditions générales d'utilisation | Quelles règles s'appliquent ? | visiteur | plein écran | hors menu | 78 / 1 | rien | sitemap |
| `/classement` | Qui lit le mieux le marché BRVM ? | Classement paper trading BRVM | Classement des portefeuilles virtuels | Qui lit le mieux le marché ? | connecté | sidebar | palette seule | 1 / 1 | sidebar, aucun élément actif |  |
| `/comparateur-sgi` | Comparateur de SGI | Comparateur des SGI BRVM — choisir son … | Hub du comparateur de SGI | Quelle SGI choisir pour ouvrir un compte ? | visiteur | plein écran | menu › Découverte › Choisir sa SGI | 20 / 20 | rien | sitemap, e-mail de bienvenue, réponses contact |
| `/comparateur-sgi/annuaire` | Annuaire des SGI | Annuaire des SGI de la BRVM — coordonné… | Annuaire des SGI agréées par pays | Quelles SGI existent dans mon pays ? | visiteur | plein écran | hors menu | 7 / 20 | rien | sitemap |
| `/comparateur-sgi/annuaire/[slug]` | Images Finances Internationales | Images Finances Internationales — frais… | Fiche d'une SGI | Que propose cette SGI, et à quel prix ? | visiteur | plein écran | hors menu | 3 / 20 | lien retour | sitemap |
| `/comparateur-sgi/comparer` | Comparer les SGI | Comparer les SGI de la BRVM côte à côte | Comparaison de SGI côte à côte | Laquelle de ces SGI est la moins chère pour moi ? | visiteur | plein écran | hors menu | 6 / 20 | rien | sitemap |
| `/comparateur-sgi/methodologie` | Méthodologie | Méthodologie du comparateur de SGI | Méthode et sources du comparateur SGI | D'où viennent ces frais ? | visiteur | plein écran | hors menu | 6 / 19 | rien | sitemap |
| `/comparateur-sgi/simuler` | Simuler mes frais | Simuler mes frais de SGI — courtage, ga… | Simulation des frais d'une SGI | Combien me coûtera ma SGI ? | visiteur | plein écran | hors menu | 6 / 19 | rien | sitemap |
| `/comparateur-sgi/trouver` | Trouver ma SGI | Trouver ma SGI — questionnaire BRVM | Questionnaire de classement des SGI | Quelle SGI correspond à mon profil ? | visiteur | plein écran | hors menu | 6 / 20 | rien | sitemap |
| `/confidentialite` | Politique de confidentialité | Politique de confidentialité | Politique de confidentialité | Que faites-vous de mes données ? | visiteur | plein écran | hors menu | 79 / 0 | rien | sitemap, WhatsApp |
| `/conseiller` | Conseiller | Conseiller BRVM | Position de chaque valeur, famille par famille | Où se situe chaque valeur de la cote ? | connecté + canAccess(conseiller,fondamentaux,conseiller_signal) (verrou Premium) | sidebar | menu › Analyse › Conseiller | 1 / 7 | menu actif |  |
| `/conseiller/track-record` | Comment nous avons mesuré le Conseiller | Comment nous avons mesuré le Conseiller | Bilan du conseiller et raison de l'abstention | Le conseiller a-t-il eu raison par le passé ? | connecté | sidebar | palette seule | 1 / 1 | sidebar, aucun élément actif |  |
| `/crm/opposition` | Ne plus recevoir de proposition | Ne plus recevoir de proposition | Opposition aux propositions commerciales (lien d'e-mail) | Comment ne plus recevoir de propositions ? | visiteur | plein écran | hors menu | 0 / 0 | rien | e-mail de relance CRM |
| `/dashboard` | Tableau de bord | Dashboard | Tableau de bord : séance, portefeuille, signaux, alertes | Où en sont le marché et mes positions aujourd'hui ? | connecté + canAccess(lecture_seance) (verrou Premium) | sidebar | menu › Marché › Tableau de bord | 31 / 22 | menu actif |  |
| `/dashboard/personnaliser` | Personnaliser | Personnaliser le tableau de bord | Ordre et choix des widgets du tableau de bord | Comment adapter mon tableau de bord ? | connecté | sidebar | hors menu | 2 / 2 | lien retour |  |
| `/dashboard/reports` | Rapports et événements | WESTBOURSE — Cours BRVM, Notes A–F & An… | Rapports sauvegardés et événements | Quels rapports et événements sont disponibles ? | connecté | sidebar | palette seule | 7 / 8 | sidebar, aucun élément actif |  |
| `/dashboard/reports/events` | Événements de marché | WESTBOURSE — Cours BRVM, Notes A–F & An… | Liste des événements de marché | Quels événements ont marqué le marché ? | connecté | sidebar | palette seule | 2 / 2 | lien retour |  |
| `/dashboard/reports/events/[id]` | Attestation des Commissaires Aux Comptes sur le… | WESTBOURSE — Cours BRVM, Notes A–F & An… | Étude d'événement (avant / après) | Comment le cours a-t-il réagi à cet événement ? | connecté | sidebar | hors menu | 5 / 1 | lien retour |  |
| `/dashboard/reports/instrument/[code]` | PRSC TRACTAFRIC MOTORS CI | WESTBOURSE — Cours BRVM, Notes A–F & An… | Rapport généré sur une valeur | Que dit le rapport sur cette valeur ? | connecté | sidebar | hors menu | 1 / 2 | lien retour |  |
| `/dashboard/reports/market/daily` | Rapport marché — 2026-11-10 | WESTBOURSE — Cours BRVM, Notes A–F & An… | Rapport de marché d'une séance | Que dit le rapport de séance ? | connecté | sidebar | hors menu | 1 / 3 | lien retour |  |
| `/dashboard/reports/sector/[sector]` | Secteur · Consommation de base | WESTBOURSE — Cours BRVM, Notes A–F & An… | Rapport sectoriel | Comment se porte ce secteur ? | connecté | sidebar | hors menu | 1 / 2 | lien retour |  |
| `/dashboard/v2` | Tableau de bord v2 | Tableau de bord v2 | Seconde version du tableau de bord (essai) | Même question que /dashboard (doublon assumé) | connecté | sidebar | hors menu | 2 / 3 | sidebar, aucun élément actif |  |
| `/debutant` | Vous débutez sur la BRVM ? Commencez simplement. | Investir à la BRVM quand on débute | Guide pour débuter à la BRVM | Par où commencer quand on n'y connaît rien ? | visiteur | plein écran | palette seule | 1 / 20 | rien | sitemap, réponses contact |
| `/developers` | API BRVM | API Développeurs | API et widgets embarquables | Comment intégrer ces données à mon site ? | visiteur | plein écran | palette seule | 1 / 2 | lien retour | sitemap |
| `/dividendes` | Dividendes | Dividendes | Dividendes à venir, rendements, historique | Combien vais-je toucher, et quand ? | connecté | sidebar | menu › Revenus › Dividendes | 4 / 10 | menu actif |  |
| `/dividendes/calendrier` | Calendrier des dividendes | Calendrier des dividendes | Calendrier mensuel des dividendes | Quels dividendes tombent chaque mois ? | connecté | sidebar | palette seule | 3 / 3 | menu actif |  |
| `/embed/heatmap` | (aucun h1 rendu) | Heatmap BRVM du jour | Widget heatmap pour sites tiers | (widget dans un site tiers) | visiteur | plein écran | hors menu | 0 / 0 | rien | iframe tierce |
| `/embed/ticker` | (aucun h1 rendu) | Cours BRVM en direct | Widget bandeau de cours pour sites tiers | (widget) | visiteur | plein écran | hors menu | 0 / 0 | rien | iframe tierce |
| `/embed/valeur/[code]` | (aucun h1 rendu) | SNTS · 4 000 FCFA -3.61% | Widget cours d'une valeur pour sites tiers | (widget) | visiteur | plein écran | hors menu | 0 / 0 | rien | iframe tierce |
| `/fiscalite` | Fiscalité des dividendes et obligations | Fiscalité des dividendes et obligations… | Retenue à la source sur dividendes, par pays | Combien me restera-t-il après impôt ? | visiteur | plein écran | menu › Revenus › Fiscalité des dividend… | 3 / 4 | rien | sitemap |
| `/fondamentaux` | Analyse fondamentale | Analyse fondamentale | Tableau des ratios (PER, P/B, ROE, rendement) | Quelles sociétés sont bon marché ou rentables ? | connecté + canAccess(fondamentaux) | sidebar | menu › Analyse › Fondamentaux | 6 / 10 | menu actif |  |
| `/formations` | Formations et conférences | Formations et conférences | Hub formations : parcours, Academy, sessions, replays | Comment me former à la Bourse ? | visiteur + canAccess(formations) (verrou Premium) | sidebar | menu › Découverte › Formations | 28 / 8 | menu actif | sitemap |
| `/formations/academy` | WestBourse Academy | WestBourse Academy · Formation complète… | Hub de l'Academy : niveaux, progression, examen | Où en suis-je dans l'Academy ? | visiteur + canAccess(formations) (verrou Premium) | plein écran | hors menu | 6 / 6 | lien retour | e-mails CRM et contact |
| `/formations/academy/[slug]` | Qu’est-ce que la BRVM et comment ça marche ? | Niveau 1 — Initiation à la BRVM | Leçon de l'Academy | (contenu de la leçon) | visiteur + canAccess(formations) (verrou Premium) | plein écran | hors menu | 4 / 11 | lien retour | assistant WhatsApp (notions) |
| `/formations/academy/certificat` | WestBourse Academy | WestBourse Academy · Formation complète… | Génération du certificat après l'examen | Comment obtenir mon certificat ? | visiteur (verrou Premium) | plein écran | hors menu | 0 / 2 | lien retour |  |
| `/formations/academy/examen/[niveau]` | WestBourse Academy | WestBourse Academy · Formation complète… | Examen d'un niveau | Ai-je acquis ce niveau ? | visiteur + canAccess(formations) (verrou Premium) | plein écran | hors menu | 0 / 3 | lien retour |  |
| `/formations/academy/integrale` | (aucun h1 rendu) | Édition Intégrale | Version classique, toutes leçons sur une page | (doublon de lecture de l'Academy) | visiteur | plein écran | hors menu | 3 / 0 | rien |  |
| `/formations/academy/lecon-0` | Qui fait quoi sur le marché financier de l’UMOA | Leçon 0 · Qui fait quoi sur le marché f… | Leçon 0 gratuite (vidéo) | Comment fonctionne l'écosystème boursier de l'UMOA ? | visiteur | plein écran | hors menu | 4 / 4 | lien retour | sitemap, e-mail de bienvenue |
| `/formations/modules` | Modules vidéo interactifs | Modules vidéo · Formations | Modules vidéo chapitrés | Quels cours vidéo puis-je suivre ? | visiteur | sidebar | hors menu | 2 / 1 | menu actif |  |
| `/formations/modules/[course]` | Bien débuter à la BRVM | Bien débuter à la BRVM — Formations | Lecteur d'un module vidéo | (contenu du module) | visiteur | sidebar | hors menu | 1 / 2 | menu actif |  |
| `/formations/sessions` | Se former en direct, avec un formateur | Formations en direct · Bourse et BRVM | Sessions en direct : dates, places, prix | Quand est la prochaine session ? | visiteur | sidebar | hors menu | 2 / 17 | menu actif |  |
| `/formations/sessions/[id]` | Cette page n'existe pas. | WESTBOURSE — Cours BRVM, Notes A–F & An… | Fiche d'une session et réservation | Puis-je m'inscrire à cette session ? | visiteur | sidebar | hors menu | 0 / 15 | menu actif |  |
| `/forum` | Forum | Forum | Forum de discussion | Qu'en pensent les autres investisseurs ? | connecté | sidebar | menu › Découverte › Forum | 0 / 2 | menu actif |  |
| `/forum/[id]` | Test bnbc action | WESTBOURSE — Cours BRVM, Notes A–F & An… | Sujet du forum | (discussion) | connecté | sidebar | hors menu | 1 / 0 | menu actif |  |
| `/forum/nouveau` | Nouveau sujet | Nouveau sujet | Créer un sujet | (formulaire) | connecté | sidebar | hors menu | 1 / 2 | menu actif |  |
| `/heatmap` | Heatmap marché | Heatmap marché | Carte du marché : capitalisation et variation | Où le marché monte-t-il et baisse-t-il ? | connecté | sidebar | menu › Marché › Heatmap | 5 / 3 | menu actif |  |
| `/journal` | Journal de décision | Journal de décision | Journal de décision : thèses actives et historique | Pourquoi ai-je acheté, et ma thèse tient-elle ? | connecté | sidebar | menu › Gestion › Journal de décision | 0 / 1 | menu actif | alerte de thèse |
| `/liquidite` | Liquidité du marché | Liquidité du marché BRVM — scores par t… | Score de liquidité par valeur, méthode | Pourrai-je acheter ou vendre ce titre facilement ? | connecté | sidebar | menu › Analyse › Liquidité | 2 / 1 | menu actif |  |
| `/login` | WESTBOURSE | WESTBOURSE — Cours BRVM, Notes A–F & An… | Connexion | (accès) | visiteur | plein écran | hors menu | 26 / 2 | rien | sitemap |
| `/mentions-legales` | Mentions légales | Mentions légales | Mentions légales | Qui édite le site ? | visiteur | plein écran | hors menu | 18 / 0 | rien | sitemap |
| `/methodologie` | Méthodologie et sources | Méthodologie | Provenance des données, calcul des signaux | D'où viennent les chiffres ? | visiteur | sidebar | palette seule | 20 / 0 | sidebar, aucun élément actif | sitemap |
| `/notations` | Notations financières | WESTBOURSE — Cours BRVM, Notes A–F & An… | Notations financières (Bloomfield, GCR) | Quelle note les agences donnent-elles ? | connecté | sidebar | palette seule | 1 / 9 | sidebar, aucun élément actif |  |
| `/obligations` | Marché obligataire | Obligations | Obligations cotées : rendement, duration, courbe | Quelle obligation rapporte le plus pour son risque ? | connecté | sidebar | menu › Marché › Obligations | 7 / 1 | menu actif |  |
| `/offre/dossier` | Lien introuvable | Votre dossier offert | Dossier PDF offert par jeton (lien d'e-mail) | Quel dossier gratuit puis-je choisir ? | visiteur | plein écran | hors menu | 0 / 1 | rien | e-mail de relance CRM |
| `/paiement/annule` | Paiement annulé | Paiement annulé | Retour Chariow après paiement annulé | Que faire après un paiement annulé ? | connecté | sidebar | hors menu | 0 / 2 | lien retour | retour Chariow |
| `/paiement/succes` | Merci pour votre achat | Paiement | Retour Chariow après paiement | Ma commande est-elle validée ? | connecté | sidebar | hors menu | 0 / 3 | sidebar, aucun élément actif | retour Chariow |
| `/parametres/alertes` | Mes alertes | Mes alertes | Alertes de cours et canaux de notification | Comment être prévenu ? | connecté + canAccess(alertes) | sidebar | menu › Gestion › Mes alertes | 5 / 3 | menu actif | brief vidéo, appairage WhatsApp, récap |
| `/parametres/compte` | Mon compte | WESTBOURSE — Cours BRVM, Notes A–F & An… | Données personnelles, export, préférences | Que sait le site de moi, et comment le changer ? | connecté | sidebar | hors menu | 2 / 0 | sidebar, aucun élément actif |  |
| `/portefeuille` | Mon portefeuille | Portefeuille | Positions, valorisation, plus-values latentes | Combien vaut mon portefeuille ? | connecté | sidebar | menu › Gestion › Portefeuille | 8 / 6 | menu actif | e-mail des dossiers, récap |
| `/portefeuille/import` | Importer mon relevé SGI | WESTBOURSE — Cours BRVM, Notes A–F & An… | Import d'un relevé SGI en PDF | Comment saisir mes positions sans tout taper ? | connecté | sidebar | palette seule | 3 / 1 | menu actif |  |
| `/premium/anomalies` | Anomalies de marché | WESTBOURSE — Cours BRVM, Notes A–F & An… | Quatre vues de valeurs atypiques | Quelles valeurs sortent du lot ? | Premium | sidebar | palette seule | 1 / 0 | sidebar, aucun élément actif |  |
| `/premium/backtesting` | Backtest | Backtest | Code mort (redirigé vers /backtest par next.config.js) | (jamais servie) | Premium | sidebar | hors menu | 0 / 1 | menu actif |  |
| `/premium/calendrier` | Dates clés | WESTBOURSE — Cours BRVM, Notes A–F & An… | Dates clés par société | Quand cette société publie-t-elle ? | Premium | sidebar | palette seule | 2 / 3 | sidebar, aucun élément actif |  |
| `/premium/classements` | Classements des actions BRVM | WESTBOURSE — Cours BRVM, Notes A–F & An… | Palmarès des actions (9 critères) | Quelles actions sont en tête sur tel critère ? | Premium | sidebar | palette seule | 1 / 1 | sidebar, aucun élément actif |  |
| `/premium/comparateur` | Comparateur multi-actifs | Comparateur multi-actifs | Rendement et risque des classes d'actifs | Actions, obligations ou placement sans risque ? | Premium | sidebar | palette seule | 1 / 0 | sidebar, aucun élément actif |  |
| `/premium/correlations` | Corrélations avec les matières premières | WESTBOURSE — Cours BRVM, Notes A–F & An… | Corrélation actions et matières premières | Cette action suit-elle le cacao ou le pétrole ? | Premium | sidebar | palette seule | 1 / 1 | sidebar, aucun élément actif |  |
| `/premium/dcf` | Valorisation DCF — classement du marché | Valorisation DCF | Classement par valorisation DCF | Quelles sociétés sont sous-évaluées selon les flux ? | Premium | sidebar | palette seule | 1 / 10 | sidebar, aucun élément actif |  |
| `/premium/dcf/[code]` | ETIT — ETI TG | Valorisation DCF | DCF détaillé d'une société | Quelle juste valeur, et avec quelles hypothèses ? | Premium | sidebar | hors menu | 1 / 4 | sidebar, aucun élément actif |  |
| `/premium/diagnostic` | Dossier d’analyse | WESTBOURSE — Cours BRVM, Notes A–F & An… | Choix d'une société pour le diagnostic IA (h1 « Dossier d'analyse ») | Sur quelle société lancer un diagnostic ? | Premium | sidebar | menu › Premium › Diagnostic financier | 19 / 2 | menu actif |  |
| `/premium/diagnostic/[code]` | Diagnostic ABJC | WESTBOURSE — Cours BRVM, Notes A–F & An… | Diagnostic IA d'une société | Que révèle une lecture complète de cette société ? | Premium | sidebar | hors menu | 3 / 2 | menu actif |  |
| `/premium/formations/[id]` | 5 étapes Investir à la BRVM westbourse | Formation | Replay ou support d'une formation Premium | (contenu de formation) | Premium | sidebar | hors menu | 1 / 1 | lien retour |  |
| `/premium/outils` | Outils Premium | WESTBOURSE — Cours BRVM, Notes A–F & An… | Hub des outils Premium | Quels outils avancés ai-je ? | Premium | sidebar | menu › Premium › Outils Pro | 1 / 6 | menu actif |  |
| `/premium/paper-trading` | Paper Trading | WESTBOURSE — Cours BRVM, Notes A–F & An… | Portefeuille virtuel | Ma stratégie marcherait-elle sans risquer d'argent ? | Premium | sidebar | menu › Gestion › Portefeuille virtuel | 20 / 0 | menu actif |  |
| `/premium/reports` | Archive des rapports | Archive Rapports | Archive des rapports mensuels | Comment s'est passé chaque mois ? | Premium | sidebar | palette seule | 2 / 4 | sidebar, aucun élément actif |  |
| `/premium/reports/[month]` | Cette page n'existe pas. | Rapport Mensuel | Rapport mensuel | Comment s'est passé ce mois ? | Premium | sidebar | hors menu | 0 / 1 | sidebar, aucun élément actif |  |
| `/premium/upgrade` | Accès Premium BRVM | WESTBOURSE — Cours BRVM, Notes A–F & An… | Page d'accès Premium (ancienne, mailto) | Comment devenir Premium ? | connecté (verrou Premium) | sidebar | hors menu | 0 / 0 | sidebar, aucun élément actif |  |
| `/premium/valorisation` | Valorisation BRVM | Valorisation | Juste valeur par multiples et DDM | Quelles actions sont bon marché selon les multiples ? | Premium | sidebar | menu › Premium › Valorisation | 1 / 9 | menu actif |  |
| `/pricing` | Formules et tarifs | Tarifs | Formules et tarifs | Combien ça coûte, et que contient chaque formule ? | visiteur | plein écran | palette seule | 3 / 17 | rien | sitemap, WhatsApp, réponses contact |
| `/profil` | Mon profil | Mon profil | Identité publique (photo, bio) | Comment les autres me voient-ils ? | connecté | sidebar | hors menu | 2 / 1 | sidebar, aucun élément actif |  |
| `/rapports/builder` | Composer un rapport | Constructeur de rapport | Composer un rapport PDF | Comment produire mon propre rapport ? | connecté | sidebar | palette seule | 4 / 0 | sidebar, aucun élément actif |  |
| `/rapports/dossier/[code]` | SONATEL | Dossier SNTS | Dossier valeur A4 (12 panneaux) | Quel document complet garder sur cette valeur ? | connecté | sidebar | hors menu | 5 / 0 | sidebar, aucun élément actif | impression PDF (dossiers.mjs) |
| `/rapports/print` | WESTBOURSE | Rapport | Sortie d'impression du constructeur | (sortie d'impression) | connecté | sidebar | hors menu | 0 / 1 | lien retour |  |
| `/rendement-vrai` | Le rendement vrai | Rendement réel & vrai BRVM : cours + di… | Rendement réel : cours, dividendes, inflation | Combien cette action m'a-t-elle vraiment rapporté ? | visiteur | plein écran | menu › Revenus › Rendement réel (après … | 0 / 4 | rien | sitemap |
| `/reports` | Rapports interactifs | WESTBOURSE — Cours BRVM, Notes A–F & An… | Générer un rapport interactif | (question floue : recoupe /rapports/builder et /dashboard/reports) | connecté | sidebar | menu › Gestion › Rapports | 2 / 3 | menu actif |  |
| `/saisonnalite` | Saisonnalité | Saisonnalité | Saisonnalité d'une valeur et du marché | Ce mois est-il habituellement bon pour cette valeur ? | connecté + canAccess(saisonnalite) | sidebar | menu › Revenus › Saisonnalité | 2 / 4 | menu actif |  |
| `/saisonnalite/ce-mois-ci` | Ce mois-ci | Saisonnalité : ce mois-ci | Chaque valeur face à son habitude du mois | Qui sort de son habitude ce mois-ci ? | connecté + canAccess(saisonnalite) | sidebar | hors menu | 1 / 2 | menu actif |  |
| `/scanner` | Scanner technique | Scanner technique | Filtres techniques combinables | Quelles valeurs remplissent ces conditions techniques ? | connecté | sidebar | menu › Analyse › Scanner technique | 1 / 2 | menu actif |  |
| `/screener` | Screener multi-critères | Screener multi-critères | Filtres multicritères | Quelles valeurs remplissent mes critères ? | connecté + canAccess(screener) (verrou Premium) | sidebar | menu › Analyse › Screener multi-critères | 4 / 3 | menu actif |  |
| `/screener/intraday` | Screener Intraday | Screener Intraday | Variations et volumes inhabituels de la séance | Qu'est-ce qui bouge en ce moment ? | connecté + canAccess(screener_intraday) | sidebar | palette seule | 0 / 1 | menu actif |  |
| `/secteurs` | Performance sectorielle | Secteurs BRVM — performance, PER, PBR e… | Performance et valorisation par secteur | Quel secteur va bien ? | visiteur | sidebar | menu › Marché › Secteurs | 3 / 5 | menu actif | sitemap |
| `/signaux` | Signaux d'opportunité | Signaux | Signaux techniques et leurs facteurs | Le moteur voit-il un signal sur une valeur ? | connecté + canAccess(signaux) | sidebar | menu › Analyse › Signaux | 7 / 2 | menu actif |  |
| `/signup` | WESTBOURSE | WESTBOURSE — Cours BRVM, Notes A–F & An… | Inscription | (accès) | visiteur | plein écran | hors menu | 26 / 2 | rien | sitemap, e-mails, WhatsApp |
| `/simulateur` | Et si vous aviez investi ? | Simulateur BRVM — Et si vous aviez inve… | Et si vous aviez investi ? (choix d'une valeur) | Combien aurais-je gagné en investissant hier ? | visiteur | plein écran | menu › Découverte › Simulateur | 19 / 15 | rien | sitemap |
| `/simulateur-budget` | Que faire de votre budget ? | Simulateur de budget BRVM — que faire d… | Trois portefeuilles pour un budget | Que faire de mon argent ? | visiteur | plein écran | palette seule | 18 / 19 | rien | sitemap, réponses contact |
| `/simulateur/[code]` | Et si vous aviez investi dans SONATEL ? | Et si vous aviez investi dans SONATEL (… | Simulation historique sur une valeur | Combien aurais-je gagné avec cette action ? | visiteur | plein écran | hors menu | 1 / 16 | rien |  |
| `/societes` | Les sociétés cotées à la BRVM | Les 48 sociétés cotées à la BRVM : cour… | Annuaire public des sociétés cotées | Quelles sociétés sont cotées à la BRVM ? | visiteur | plein écran | menu › Découverte › Sociétés cotées | 24 / 15 | rien | sitemap, brief vidéo, WhatsApp |
| `/societes/[code]` | PRSC TRACTAFRIC MOTORS CI | Action TRACTAFRIC MOTORS CI (PRSC) · Co… | Fiche publique légère d'une société (SEO) | Que vaut cette action ? (même question que /actions/[code]) | visiteur | plein écran | hors menu | 9 / 17 | rien | sitemap, WhatsApp, assistant |
| `/veille` | Veille BRVM | Veille Intelligence BRVM | Veille automatisée de l'actualité | Que s'est-il dit sur le marché aujourd'hui ? | connecté | sidebar | palette seule | 2 / 8 | lien retour |  |
| `/weekly` | Matières premières : analyse hebdomadaire | Matières premières : analyse hebdomadai… | Matières premières : analyse hebdomadaire | Comment les matières premières ont-elles bougé ? | connecté | sidebar | palette seule | 6 / 10 | sidebar, aucun élément actif |  |
| `/weekly/[slug]` | WESTBOURSE | Matières premières BRVM – Semaine 45/20… | Une édition hebdomadaire matières premières | Que dit l'édition de cette semaine ? | connecté | sidebar | hors menu | 4 / 2 | sidebar, aucun élément actif | newsletter |
| `/weekly/thesis` | Exposition BRVM aux matières premières | Référentiel d'exposition matières premi… | Exposition des valeurs aux matières premières | Quelles valeurs dépendent du cacao, du pétrole ? | connecté | sidebar | palette seule | 1 / 1 | lien retour |  |


## 2. Défauts classés

P0 = bloqué (l'utilisateur ne peut pas faire ce qu'il venait faire). P1 = perdu (il le peut, mais se perd ou perd quelque chose). P2 = confort. Chaque ligne a été vue dans le navigateur, sauf mention « code ».

### P0 : bloqué

| # | Défaut | Où | Constat |
|---|---|---|---|
| P0-1 | La porte Premium mène à une impasse | `app/premium/upgrade/page.tsx:37`, cible de `components/Sidebar.tsx:90`, `components/MobileNav.tsx:102`, `lib/supabase/middleware.ts:133` | Toute entrée Premium verrouillée du menu et tout accès à `/premium/*` d'un compte gratuit (17 pages vérifiées avec qa-e2e-debutant@) arrivent sur une page qui ne propose qu'un `mailto:` vers l'adresse **personnelle** de l'exploitant. Aucun lien vers `/account/plan` (où l'abonnement se fait seul, par Chariow) ni vers `/pricing`, aucun retour, aucun lien dans le contenu. La page décrit trois outils sur une quinzaine. |
| P0-2 | La page demandée est perdue en partie après connexion | `lib/supabase/middleware.ts:109` | `next` ne reçoit que le chemin : `/dividendes/calendrier?annee=2025&code=SNTS` devient `/login?annee=2025&code=SNTS&next=%2Fdividendes%2Fcalendrier` (mesuré). Les paramètres partent sur `/login` et sont perdus après connexion. Touche tout lien filtré venu d'un e-mail ou d'un message. |

### P1 : perdu

| # | Défaut | Où | Constat |
|---|---|---|---|
| P1-1 | Six entrées du menu sortent l'utilisateur connecté de l'application | `components/ConditionalShell.tsx:15-35` (BARE_PREFIXES) ; entrées `lib/nav.ts` : Brief quotidien, Rendement réel, Fiscalité, Sociétés cotées, Choisir sa SGI, Simulateur | Ces pages sont rendues en plein écran public (`PublicShell`) : la sidebar disparaît. Sur `/fiscalite`, `/rendement-vrai` et `/analyses`, **aucun lien vers le tableau de bord** (vérifié, compte actif) ; le logo mène à la landing `/`. |
| P1-2 | Sous-pages atteintes par onglet : aucun élément de menu actif | `lib/nav.ts:155-157` (`isNavItemActive` ne connaît que les URL du menu) | `/veille`, `/weekly`, `/notations`, `/premium/dcf`, `/premium/calendrier`, `/premium/reports`, `/dashboard/reports` : la sidebar n'indique rien. L'utilisateur ne sait plus dans quelle rubrique il est. |
| P1-3 | « Choisir sa SGI » n'est jamais actif | `ConditionalShell.tsx` (préfixe `/comparateur-sgi`) | Les 7 pages du comparateur SGI s'affichent sans la sidebar ; l'entrée du menu ne peut pas s'allumer. |
| P1-4 | Une page publique du sitemap s'affiche comme un mur | `app/formations/page.tsx:82`, `app/formations/academy/page.tsx:42`, `components/premium/AccessGate.tsx` | Pour un visiteur et un compte gratuit, `/formations` et `/formations/academy` (sitemap, menu « Formations ») montrent « réservé au plan Premium » **sans h1**. La leçon 0 gratuite et les offres sont présentes au-dessus, mais le titre de la page ne l'est pas, ni pour l'humain ni pour le moteur. |
| P1-5 | Le pied de page public envoie vers des pages protégées sans le dire | `components/Footer.tsx:15-38` | 9 liens (Marché obligataire, Notes A–F, Screener, Signaux, Dossier d'analyse, Paper trading, Watchlist & alertes, Liquidité, Classement papier) renvoient un visiteur vers `/login` sans explication. |
| P1-6 | Culs-de-sac : aucun lien dans le contenu | voir tableau §1 (colonne sortants) | 28 pages vérifiées, dont `/rapports/dossier/[code]`, `/actions/[code]/rapport`, `/journal`, `/portefeuille/import`, `/backtest`, `/premium/paper-trading`, `/premium/anomalies`, `/premium/comparateur`, `/rapports/builder`, `/simulateur`, `/simulateur/[code]`, `/screener/intraday`, `/forum/[id]`, `/profil`, `/parametres/compte`, `/methodologie`, `/weekly/[slug]`. Sur les pages du shell, la sidebar reste un recours ; sur `/simulateur` et `/rapports/dossier/[code]` (impression), rien ne mène à la suite logique. |
| P1-7 | Pages orphelines réelles | — | `/account/formations` (les sessions réservées : **aucun lien** nulle part, seule une revalidation dans `app/formations/sessions/actions.ts:66`). `/backtests/demo` (aucun lien ; sert de support au test `e2e/animated.spec.ts`). Les autres « orphelines » du graphe sont des cibles de parcours légitimes (retours Chariow, `/offre/dossier`, `/crm/opposition`, widgets, impressions). |
| P1-8 | Code mort servi par une redirection | `app/premium/backtesting/page.tsx` (+ `components/premium/BacktestingTables.tsx`), `next.config.js:29`, lien `components/landing/PlatformUniverses.tsx:69` | La page n'est jamais servie (308 vers `/backtest`) mais son code reste, et la landing pointe encore vers l'ancienne URL. |
| P1-9 | Liens morts | `components/landing/apercu/BentoFacons.tsx:16` (`/fonds`), `app/saisonnalite/page.tsx:150` (`/outils`), `lib/forum/email.ts:74-537` (`/forum/post/…`, `/forum/my-activity`, `/forum/my-posts`, `/account/preferences`, `/privacy`, `/terms`) | Les deux premiers sont rendus. `lib/forum/email.ts` n'est **importé nulle part** : code mort, à supprimer plutôt qu'à corriger. |
| P1-10 | Précédent piégé sur les lecteurs vidéo | `app/formations/modules/[course]` (`components/formations/CoursePlayer.tsx:129`, iframe Vimeo), `/premium/formations/[id]` | Après arrivée depuis le tableau de bord, Précédent reste sur la page (mesuré, deux profils). Cause probable : changer l'adresse d'une iframe ajoute une entrée d'historique. À confirmer pendant la correction. |
| P1-11 | Le certificat perd sa destination | `app/formations/academy/certificat/page.tsx:14` | Sans session, renvoi vers `/login?next=/formations/academy` (et non vers le certificat) ; vérifié : on arrive sur le hub. |
| P1-12 | L'examen n'est pas relié aux leçons | `app/formations/academy/page.tsx:155` | Le seul accès à `/formations/academy/examen/[niveau]` est sur le hub, une fois 100 % atteints. Une leçon terminée ne propose pas l'examen. Pour un gratuit, la page d'examen n'a **pas de h1**, un seul lien (`/account/plan`). |
| P1-13 | Même libellé, deux destinations | `lib/viewTabsPresets.ts:13` | « Analyses hebdo » désigne `/weekly` (matières premières) dans les onglets d'Actualités, alors que le menu appelle `/analyses/hebdo` (actions) « Analyse hebdo (actions) ». |
| P1-14 | Libellé faux | `lib/nav.ts:137` | « Comparateur de titres » mène à `/premium/comparateur`, intitulée « Comparateur multi-actifs » : elle compare des **classes d'actifs**. Le comparateur de titres est `/actions/compare`. |
| P1-15 | Débordement horizontal sur mobile | `components/auth/LoginMarketBar.tsx` (bandeau défilant), tableaux de `/conseiller` et `/screener`, bandeau de `/comparateur-sgi` | À 390 px : `/login` et `/signup` font **9 000 px de large** ; `/comparateur-sgi` 594, `/screener` 574, `/conseiller` 522, `/obligations` 392 (mesuré, élément fautif identifié). |
| P1-16 | Le paiement annulé ne ramène pas au point de départ | `app/paiement/annule/page.tsx:16-27` | Deux liens fixes (Academy, abonnement). Rien ne garde l'endroit d'où l'achat est parti. |

### P2 : confort

| # | Défaut | Où | Constat |
|---|---|---|---|
| P2-1 | Recherche introuvable sur ordinateur | `components/Sidebar.tsx` (aucun déclencheur), `components/CommandPalette.tsx:124` | La palette existe (Ctrl+K, valeurs, secteurs, pages, « Copilote » en langage naturel) mais aucun bouton ne l'ouvre sur ordinateur. Sur mobile, la barre du bas l'ouvre. Les 28 pages « secondaires » de `lib/nav.ts` ne sont donc trouvables que par qui connaît le raccourci. |
| P2-2 | Déclarations en double | `lib/nav.ts:62-63` et `:144-146` | `/fiscalite` et `/rendement-vrai` figurent dans le menu **et** dans la liste secondaire, sous deux libellés différents chacun. |
| P2-3 | Libellé du menu ≠ titre de page | voir glossaire §3 | « Diagnostic financier » → h1 « Dossier d'analyse » ; « Fondamentaux » → « Analyse fondamentale » ; « Brief quotidien » → « Note de conjoncture » (`/brief/[date]`) ; « Rapport PDF analyste » → « Note d'analyse » ; « Poser une question » → « Analyse… » (`/assistant`). |
| P2-4 | Deux portes d'abonnement | `AccessGate.tsx:45` → `/account/plan` ; menu → `/premium/upgrade` | Selon l'endroit, le même besoin mène à deux pages différentes. `OffresNiveaux` sait déjà recevoir un `retour` (`app/formations/page.tsx`). |
| P2-5 | Bienvenue sort de l'application | `components/onboarding/BienvenuePicker.tsx:118` | Le premier choix d'un nouvel inscrit l'envoie sur la fiche publique `/societes/[code]` plutôt que sur la fiche complète `/actions/[code]`. |
| P2-6 | Barre du bas et menu disent deux choses | `components/BottomNav.tsx` | « Actus » couvre Actualités, Veille, Hebdo matières premières **et** Brief ; le menu les répartit en trois entrées. |
| P2-7 | Pages Premium hors menu peu reliées | `/premium/classements`, `/premium/comparateur`, `/premium/correlations`, `/premium/anomalies`, `/classement` | Un seul lien entrant chacune (le hub `/premium/outils`). |
| P2-8 | Écran d'une adresse inexistante peu utile | `app/not-found.tsx` | Quatre liens (accueil, sociétés, brief, actualités), pas de recherche. Le statut 404 est correct (soft-404 corrigé, test `e2e/not-found.spec.ts`). |
| P2-9 | Version v2 du tableau de bord en parallèle | `app/dashboard/page.tsx:529` | Deux tableaux de bord cohabitent ; « Version v2 → » sur le premier. Décision produit (§7). |

### Ce qui n'est pas un défaut (vérifié)

- **`router.back()` n'est utilisé nulle part** (0 occurrence).
- **Liens morts dans le menu, la palette, le pied de page, la console admin** : aucun.
- **Fiche valeur et SEO** : `/actions/[code]` déclare déjà `canonical` vers `/societes/[code]` (`app/actions/[code]/page.tsx:165`).
- **Sous-pages de la fiche** (financials, revue, quant) : fil « ‹ Retour à la fiche » et rangée de documents (`components/sousPage/SousPageNav.tsx`).
- **Admin** : chaque page a la console `AdminShell` avec son menu et un libellé de section (`adminBreadcrumb`). Deux pages hors menu admin : `/admin/coherence`, `/admin/agent-reach-experimental` (code).
- **Sidebar et tiroir mobile** lisent la même liste et la même règle d'élément actif : aucun écart réel. Les écarts relevés venaient des onglets de page.

### Profondeur

Depuis le tableau de bord, avec le menu (1 clic sur ordinateur ; 2 par le tiroir, 1 par la barre du bas sur mobile), **toutes les pages courantes sont à 3 clics ou moins**. Au-delà : `/dashboard/reports/instrument/[code]` (4) ; sur mobile seulement, `/formations/modules/[course]`, `/formations/academy/integrale`, `/premium/dcf/[code]` (4). Les pages inatteignables par un lien sont celles de P1-7 et les cibles de parcours.

## 3. Glossaire : un mot, un sens

Aujourd'hui (relevé dans les titres, le menu, les onglets, le pied de page) :

| Mot | Désigne aujourd'hui | Problème |
|---|---|---|
| Rapport | `/reports` (générer), `/dashboard/reports` (sauvegardés + événements), `/rapports/builder` (PDF), `/premium/reports` (mensuels), `/dashboard/reports/market/daily` (séance), `/actions/[code]/rapport` (« Note d'analyse ») | Six objets |
| Analyse | `/analyses` (articles), `/analyses/hebdo` (technique hebdo), `/fondamentaux` (« Analyse fondamentale »), `/assistant` (« Analyse… »), `/analyse/combined-alpha` (score), « Dossier d'analyse » | Outil et article confondus |
| Dossier | `/rapports/dossier/[code]` (PDF A4), `/offre/dossier` (le même, offert), `/premium/diagnostic` (« Dossier d'analyse ») | Deux objets |
| Diagnostic | `/premium/diagnostic/[code]` (rapport IA) | Le menu dit « Diagnostic financier », la page « Dossier d'analyse » |
| Brief | `/brief` ; h1 de `/brief/[date]` : « Note de conjoncture » | Deux noms pour un objet |
| Note | Note A–F ; « Note d'analyse » ; « Note de conjoncture » | Trois sens |
| Classement | `/classement` (portefeuilles virtuels), `/premium/classements` (palmarès des actions) | Deux objets |
| Comparateur | `/actions/compare` (titres), `/premium/comparateur` (classes d'actifs), `/comparateur-sgi` (SGI) | Libellé « de titres » posé sur le mauvais |
| Hebdo | `/analyses/hebdo` (actions), `/weekly` (matières premières) | Même libellé |
| Calendrier | `/calendrier` (agenda), `/dividendes/calendrier` (mois par mois), `/premium/calendrier` (« Dates clés ») | Cohérent grâce aux onglets |
| Simulateur | `/simulateur` (passé), `/simulateur-budget` (budget), `/comparateur-sgi/simuler` (frais) | Trois questions différentes sous un mot |

Proposé :

| Mot | Un seul sens | Conséquences |
|---|---|---|
| **Fiche** | La page d'une valeur, `/actions/[code]` (et sa version publique `/societes/[code]`) | — |
| **Note** | La note A–F, rien d'autre | « Note d'analyse » → « Rapport analyste » ; « Note de conjoncture » → « Brief de séance » |
| **Brief** | Le résumé d'une séance | — |
| **Analyse** | Un texte éditorial publié (`/analyses`, `/analyses/hebdo`) | « Analyse fondamentale » → « Fondamentaux » ; `/assistant` → « Poser une question » |
| **Dossier** | Le PDF A4 d'une valeur (`/rapports/dossier/[code]`, offert par `/offre/dossier`) | « Dossier d'analyse » → « Diagnostic » |
| **Diagnostic** | La lecture IA d'une société (`/premium/diagnostic`) | Menu et h1 alignés |
| **Rapport** | Un document généré : de séance, mensuel, sur mesure (constructeur), analyste | Un seul hub « Rapports » (onglets existants) |
| **Palmarès** | Classement des actions (`/premium/classements`) | « Classement » reste aux portefeuilles virtuels |
| **Valeurs de la semaine** | `/analyses/hebdo` | Libellé déjà prévu dans CLAUDE.md |
| **Matières premières** | `/weekly`, `/weekly/thesis` | Plus de « hebdo » ambigu |
| **Agenda** | Les dates à venir (`/calendrier` et ses onglets) | — |
| **Simulateur** | Toujours suivi de sa question : « Et si j'avais investi ? », « Que faire de mon budget ? », « Combien coûte ma SGI ? » | — |

## 4. Arborescence actuelle et arborescence proposée

Recommandation de Fable, retenue : **aucune URL ne change**. La nouvelle organisation est portée par le registre de navigation (parent, rubrique, libellé), le menu et le fil d'Ariane. Seules exceptions : les deux suppressions de §7.

Légende du sort : **reste** (même place), **déplacée** (autre rubrique), **regroupée** (onglet d'une famille, sans changement d'URL), **renommée** (libellé seulement), **sortie du menu**, **à supprimer**.

| Actuel (rubrique du menu) | Page | Proposé (rubrique · parent) | Sort |
|---|---|---|---|
| Marché | `/dashboard` | Aujourd'hui · racine | reste |
| — | `/dashboard/v2` | hors menu, statut « essai » | décision produit (§7) |
| — | `/dashboard/personnaliser` | Aujourd'hui · `/dashboard` | reste |
| Intelligence | `/brief` (+ `/brief/[date]`) | Aujourd'hui · racine | déplacée, renommée « Brief de séance » |
| Intelligence | `/actualites` (+ `[slug]`) | Aujourd'hui · racine | déplacée |
| palette | `/veille` | Aujourd'hui · `/actualites` (onglet) | regroupée |
| palette | `/weekly`, `/weekly/[slug]`, `/weekly/thesis` | Aujourd'hui · `/actualites` (onglet « Matières premières ») | regroupée, renommée |
| Revenus | `/calendrier` | Aujourd'hui · racine (« Agenda ») | déplacée, renommée |
| palette | `/premium/calendrier` | Aujourd'hui · `/calendrier` (onglet) | regroupée |
| Marché | `/heatmap` | Le marché · racine | reste |
| Marché | `/actions` | Le marché · racine | reste |
| — | `/actions/[code]` et sous-pages | Le marché · `/actions` | reste ; fil d'Ariane |
| Découverte | `/societes` (+ `[code]`) | Le marché · public | déplacée |
| Marché | `/obligations`, `/secteurs` | Le marché · racine | reste |
| Analyse | `/liquidite` | Le marché · racine | déplacée |
| Analyse | `/fondamentaux` ; palette `/notations` | Le marché · racine (onglets) | renommée « Fondamentaux » |
| palette | `/premium/classements` | Le marché · racine (« Palmarès ») | sort du secondaire, renommée |
| palette | `/actions/compare` | Le marché · `/actions` | reste |
| Analyse | `/screener`, `/scanner` ; palette `/screener/intraday` | Trouver une idée · « Filtrer » (onglets) | regroupée |
| Analyse | `/signaux`, `/conseiller` (+ track-record) | Trouver une idée | déplacée |
| Premium | `/premium/valorisation` ; palette `/premium/dcf` (+ `[code]`) | Trouver une idée · « Valorisation » (onglets) | déplacée |
| Premium | `/premium/diagnostic` (+ `[code]`) | Trouver une idée | renommée « Diagnostic » |
| Revenus | `/saisonnalite` (+ ce-mois-ci) | Trouver une idée | déplacée |
| Analyse | `/analyse/combined-alpha` | Trouver une idée | reste |
| Premium | `/premium/outils` ; palette anomalies, corrélations, comparateur | Trouver une idée · « Outils Pro » | reste ; `/premium/comparateur` renommée « Classes d'actifs » |
| Analyse | `/backtest` | Trouver une idée | reste |
| — | `/premium/backtesting` | — | à supprimer (fichier ; la redirection reste) |
| — | `/backtests/demo` | hors menu, statut « interne », `noindex` | sortie (déjà hors menu) |
| Revenus | `/dividendes` ; palette `/dividendes/calendrier` | Mes revenus · racine (onglets) | reste |
| Revenus | `/fiscalite`, `/rendement-vrai` | Mes revenus · `/dividendes` (onglets) | reste ; doublons de palette retirés |
| Découverte | `/simulateur` ; palette `/simulateur-budget` ; `/comparateur-sgi/simuler` | Mes revenus · « Simulateurs » | regroupée, renommée par question |
| Gestion | `/portefeuille` (+ import) | Mon portefeuille · racine | reste |
| Gestion | `/journal`, `/parametres/alertes` | Mon portefeuille | reste |
| Gestion | `/premium/paper-trading` ; palette `/classement` | Mon portefeuille · « Portefeuille virtuel » | reste ; classement en sous-page |
| Gestion | `/reports` ; palette `/dashboard/reports`, `/rapports/builder`, `/premium/reports` | Mon portefeuille · « Rapports » (onglets existants) | regroupée |
| — | `/rapports/dossier/[code]` | Le marché · `/actions/[code]` | rattachée à la fiche |
| Premium | `/assistant` | barre de recherche (« Poser une question ») + Trouver une idée | déplacée |
| Découverte | `/formations` et tout `/formations/*` | Apprendre | reste |
| palette | `/debutant`, `/methodologie` | Apprendre | entrées du menu |
| Découverte | `/comparateur-sgi` (+ 6 sous-pages) | Apprendre · « Choisir sa SGI » | reste |
| Découverte | `/forum` | Apprendre | reste |
| palette | `/developers`, `/pricing` | pied de page et menu du compte | sortie du secondaire |
| Compte | `/account/*`, `/profil`, `/parametres/compte` | menu du compte (avatar) | déplacée ; `/account/formations` enfin reliée |
| — | `/premium/upgrade` | porte Premium, réécrite (§7) | reste, réécrite |
| — | `/analyses` (+ `[slug]`, hebdo) | Aujourd'hui · « Analyses » | entrée du menu |
| — | `/apercu/*`, `/embed/*`, `/crm/*`, `/offre/*`, `/paiement/*`, `/bienvenue/*`, `/certificat/*`, `/login`, `/signup`, légal | hors menu, statut déclaré avec sa raison | reste |
| Admin | `/admin/*` | console propre, inchangée | reste |

## 5. Deux variantes de menu

### Variante prudente : même ossature, défauts corrigés

Les 8 rubriques actuelles restent : Marché, Intelligence, Analyse, Revenus, Gestion, Premium, Découverte, Compte.

- Libellés alignés sur les titres et le glossaire.
- Doublons de palette retirés.
- Les sous-pages d'onglets allument leur parent.
- Les pages publiques gardent l'application autour d'elles pour un connecté.
- Un bouton de recherche visible.

Environ 37 entrées, comme aujourd'hui. **Coût faible, gain limité** : la liste reste une liste d'outils, et « Premium » reste une rubrique fourre-tout définie par le prix plutôt que par l'usage.

### Variante ambitieuse : six intentions

| Rubrique | Entrées |
|---|---|
| **Aujourd'hui** | Tableau de bord · Brief de séance · Actualités (onglets Veille, Matières premières) · Agenda · Analyses |
| **Le marché** | Actions · Sociétés · Obligations · Secteurs · Heatmap · Fondamentaux · Liquidité · Palmarès |
| **Trouver une idée** | Filtrer (screener, scanner, intraday) · Signaux · Conseiller · Valorisation · Diagnostic · Saisonnalité · Combined Alpha · Outils Pro · Backtest |
| **Mes revenus** | Dividendes (onglets calendrier, fiscalité, rendement réel) · Simulateurs |
| **Mon portefeuille** | Portefeuille · Journal · Alertes · Portefeuille virtuel · Rapports |
| **Apprendre** | Débuter · Academy et formations · Choisir sa SGI · Forum · Méthodologie |

Le compte (abonnement, facturation, sécurité, profil, données) passe dans le menu de l'avatar. Le cadenas Premium devient une marque sur l'entrée, plus une rubrique.

**Recommandation : la variante ambitieuse, sans changer d'URL.** Le coût est presque entièrement dans `lib/nav.ts` et dans le registre (lot 3), qu'il faut faire de toute façon. Le risque d'URL est nul, puisque rien ne bouge. Le gain est de passer de huit rubriques nommées par outil ou par prix à six nommées par ce qu'on vient faire. Le seul risque est l'habitude des utilisateurs actuels, faible au volume mesuré.

## 6. Schéma du menu proposé

Ordinateur (sidebar) :

```
┌──────────────────────────────────┐
│ WESTBOURSE    [Rechercher  Ctrl K]│
├──────────────────────────────────┤
│ Aujourd'hui                      │
│   Tableau de bord                │
│   Brief de séance                │
│   Actualités                     │
│   Agenda                         │
│   Analyses                       │
│ Le marché                        │
│   Actions · Sociétés             │
│   Obligations · Secteurs         │
│   Heatmap · Fondamentaux         │
│   Liquidité · Palmarès PRO       │
│ Trouver une idée                 │
│   Filtrer · Signaux              │
│   Conseiller · Saisonnalité      │
│   Valorisation PRO               │
│   Diagnostic PRO                 │
│   Combined Alpha · Backtest      │
│   Outils Pro PRO                 │
│ Mes revenus                      │
│   Dividendes · Simulateurs       │
│ Mon portefeuille                 │
│   Portefeuille · Journal         │
│   Alertes · Virtuel PRO          │
│   Rapports                       │
│ Apprendre                        │
│   Débuter · Academy              │
│   Choisir sa SGI · Forum         │
│   Méthodologie                   │
├──────────────────────────────────┤
│ (avatar) Compte ▾                │
└──────────────────────────────────┘
En tête de chaque page de niveau 2 ou plus :
Rubrique › Parent › Page   (fil d'Ariane)
```

Mobile :

```
┌ WESTBOURSE ──────────────── [☰] ┐   ☰ ouvre le même menu (6 rubriques)
│ Rubrique › Parent › Page        │
│                                 │
│            contenu              │
│                                 │
├─────────────────────────────────┤
│ Aujourd'hui │ Marché │ Recherche │ Portefeuille │ Apprendre │
└─────────────────────────────────┘
```

La barre du bas garde cinq cases. « Actus » devient « Aujourd'hui » (tableau de bord, brief, actualités), et « Apprendre » prend la place libérée.

## 7. Redirections, suppressions, renommages

**Aucune URL ne change.** Avis de Fable (une consultation) : renommer n'apporte rien au volume mesuré, alors que chaque URL diffusée (e-mails, WhatsApp, Telegram, LinkedIn, TikTok, PDF) deviendrait une redirection à tenir indéfiniment. Les défauts relevés sont tous des défauts de présentation et de registre.

| URL | Proposition | Statut | Prérequis vérifiés |
|---|---|---|---|
| `/premium/backtesting` | Supprimer `app/premium/backtesting/page.tsx` et `components/premium/BacktestingTables.tsx` (si `lib/premium/backtesting` n'a pas d'autre usage). **Garder** la redirection 308 de `next.config.js:29`. Corriger le lien de `PlatformUniverses.tsx:69` vers `/backtest`. | **accord écrit requis** | Aucune référence dans `scraper/`, `video/`, gabarits d'e-mail (grep). |
| `/backtests/demo` | **Ne pas supprimer** : support du test `e2e/animated.spec.ts`. La déclarer « interne » dans le registre et ajouter `noindex`. | proposition | — |
| `lib/forum/email.ts` | Supprimer (jamais importé, liens morts). | **accord écrit requis** | Aucun import, ni statique ni dynamique (grep). |
| `/premium/upgrade` | **Garder l'URL** (cible du middleware) et réécrire la page : aperçu de ce que contient la page demandée, `?from=` porté par le middleware et le menu, appels vers `/account/plan?from=` et `/pricing`, contact `support@westbourse.com` au lieu de l'adresse personnelle. **Pas de redirection** : `/account/plan` exige une session et la redirection s'enchaînerait avec P0-2. | proposition | — |
| `/dashboard/v2` | **Décision produit** : garder les deux, ou choisir une version (l'autre redirigée en 308). En attendant : statut « essai » dans le registre. | **à trancher par toi** | Lien « Version v2 → » sur `/dashboard`. 2 vues sur 30 jours. |
| `/actions/[code]` et `/societes/[code]` | **Garder les deux**. Le canonique est déjà posé vers `/societes/[code]`. Relier la fiche publique à la fiche complète et inversement. Fusion différée : à rouvrir si Search Console montre une cannibalisation. | proposition | `canonical` vérifié dans le code. |

## 8. Nombre de clics, avant et après

Compte « actif ». Le graphe est celui des liens **réellement affichés**, menu compris. Les cases marquées « code » n'ont pas pu être cliquées.

| Parcours | Avant (ordinateur / mobile) | Après (proposé) | Ce qui change |
|---|---|---|---|
| Landing → inscription → bienvenue → tableau de bord | 4 actions + saisie et code e-mail (code) | 4 | Bienvenue mène à la fiche complète (P2-5) |
| Tableau de bord → fiche → états financiers | 2 / 3 | 2 / 2 | Rangée de documents en tête de fiche aussi sur mobile |
| États financiers → dossier valeur | 1 / 1 | 1 / 1 | — |
| Dossier valeur → retour à la fiche | Précédent seulement (aucun lien) | 1 | Fil d'Ariane et `SousPageNav` sur le dossier |
| Dividendes → calendrier → fiscalité | 2 / 3 | 2 / 2 | Onglet Fiscalité dans la famille Dividendes |
| Fiscalité → retour à l'application (connecté) | aucun lien (logo → landing) | 1 | Fil d'Ariane et shell pour un connecté (P1-1) |
| Portefeuille → import → journal → alertes | 3 / 5 | 3 / 3 | « Et maintenant ? » en bas de l'import et du journal |
| Academy → leçon → examen → certificat | 1 + inatteignable depuis la leçon (code) | 3 | Lien vers l'examen en fin de leçon (P1-12) |
| Compte → abonnement → paiement annulé → retour | 3, puis retour fixe | 3, puis retour au départ | `?from=` conservé jusqu'au retour Chariow (P1-16) |
| Lien d'e-mail filtré, sans session, puis connexion | page atteinte, **filtres perdus** | page et filtres atteints | P0-2 |
| Compte gratuit sur une entrée Premium | impasse (mailto) | 1 vers l'offre, 1 pour revenir | P0-1 |

## 9. Avis sur les idées

| Idée | Avis | Gain | Coût, risque | Existant à réutiliser |
|---|---|---|---|---|
| a. Organisation par intention | **À faire** (lot 4) | Six rubriques au lieu de huit, nommées par l'usage | Faible, aucune URL | `lib/nav.ts`, `Sidebar`, `MobileNav` |
| b. Fiche valeur, plaque tournante | **À faire en partie** (lot 5) : rangée de documents sur toutes les sous-pages, dossier et rapport compris ; liens « voir la fiche » depuis classements et listes. Onglets dans une seule URL : **plus tard** | L'utilisateur pense « SNTS » | Moyen ; la fiche fait 1 900 lignes | `SousPageNav`, `documentsFiche`, `FicheStickyNav`, `ActionMenu` |
| c. Fusion par onglets | **Déjà fait** pour six familles (rapports, calendriers, valorisation, filtres, actualités, revenus). À faire : parent déclaré et libellés du glossaire. Fusion d'URL : **écartée** (Fable) | Clarté | Faible | `ViewTabs`, `*_TABS` |
| d. Recherche universelle | **À faire** (lot 4) : bouton visible sur ordinateur, notions de l'Academy indexées. Actions (« alerte sur SNTS ») : **plus tard** | Les pages secondaires deviennent trouvables | Faible | `CommandPalette`, `/api/copilot`, `lib/search-index.ts` |
| e. « Et maintenant ? » | **À faire** après le registre (lot 5), en commençant par les 28 culs-de-sac | Supprime les culs-de-sac par construction | Moyen ; texte à écrire sans invention | Registre (suites déclarées) |
| f. Fil d'Ariane unique | **À faire** (lot 3), JSON-LD sur les pages publiques | Retour partout | Faible | `SousPageNav`, `adminBreadcrumb`, `Cadre` du comparateur SGI |
| g. Registre unique et testé | **À faire** (lot 3) — statut en énumération fermée (`menu`, `secondaire`, `parcours`, `interne`, `essai`, `public`) et parent obligatoire, pour éviter le statut « fourre-tout » (risque signalé par Fable) | Une page orpheline ne peut plus naître en silence | Moyen | `lib/nav.ts`, `search-index.ts` |
| h. Deux niveaux de lecture | **Plus tard** | Débutants mieux guidés | Deux menus à tenir ; volume faible | `/debutant`, `BeginnerHint` |
| i. Raccourcis personnels | **Plus tard** (après la mesure) | Accès direct | Faible ; `localStorage` sans donnée serveur | — |
| j. Barre d'onglets mobile | **Existe déjà** (`BottomNav`) : à réaligner sur les rubriques | — | Faible | `BottomNav` |
| k. Premium lisible | **À faire** (lot 1, P0-1) : une seule porte, aperçu, retour | Le chemin d'achat cesse d'être une impasse | Faible | `AccessGate`, `SectionLock`, `OffresNiveaux` (paramètre `retour`) |
| l. Arrivées externes soignées | **À faire** (lots 1 et 3) : `next` complet, fil d'Ariane sur les cibles d'e-mail et de messages | Plus de filtre perdu | Faible | `nextSur` |
| m. Page 404 utile | **À faire** (lot 5) : recherche et valeurs proches de l'adresse ; statut 404 inchangé | Moins d'abandons | Faible ; le test de statut existe | `app/not-found.tsx`, `e2e/not-found.spec.ts` |
| n. Plan du site humain | **Plus tard**, gratuit une fois le registre fait | Lisibilité, SEO | Faible | Registre |
| o. Tableau de bord, point de départ | **À faire en partie** : chaque carte mène à sa page détaillée (à vérifier carte par carte au lot 5) | — | Faible | Widgets du tableau de bord |
| p. Mesure avant/après | **Utiliser PostHog tel quel**, en le disant biaisé. Aucun outil ajouté. Un compteur interne sans traceur est possible mais **à proposer à part**, avec la checklist RGPD de CLAUDE.md §12 | — | — | PostHog (consentement requis) |

Idées issues du diagnostic :

- **Garder l'application autour des pages publiques pour un connecté** (P1-1) : pour une session ouverte, `ConditionalShell` rend le shell applicatif sur les préfixes publics, ou au minimum `SiteHeader` affiche « Mon tableau de bord ». **À faire, lot 3.**
- **Une seule porte d'abonnement**, `?from=` partout : menu, middleware, `AccessGate`, `SectionLock`, retours Chariow. **Lot 1.**

## 10. Découpage en lots, du moins risqué au plus risqué

| Lot | Contenu | Risque |
|---|---|---|
| 1. P0 et P1 de correction | P0-1 (porte Premium, `?from=`, support@), P0-2 (`next` avec ses paramètres) ; liens morts (P1-9) ; lien de la landing (P1-8) ; doublons de palette (P2-2) ; libellés faux (P1-13, P1-14) ; `/account/formations` reliée (P1-7) ; certificat (P1-11) ; examen en fin de leçon (P1-12) ; débordements mobiles (P1-15) ; h1 des verrous (P1-4) ; pied de page public (P1-5) ; Précédent des lecteurs vidéo (P1-10) | Faible ; touche le middleware → test de statut 404 et alignement sitemap relancés |
| 2. Suppressions validées | `app/premium/backtesting` et son composant, `lib/forum/email.ts` ; `noindex` de `/backtests/demo` | Faible, **après accord écrit** |
| 3. Registre et fil d'Ariane | Registre typé, test (toute page déclarée, tout lien du menu existe), fil d'Ariane et JSON-LD, élément actif par parent (P1-2, P1-3), shell pour les connectés sur les pages publiques (P1-1) | Moyen : touche toutes les pages |
| 4. Nouveau menu | Variante retenue, menu du compte, bouton de recherche, barre du bas | Moyen : habitudes |
| 5. Familles et idées | Libellés du glossaire dans les onglets, « Et maintenant ? », fiche plaque tournante, 404 utile, cartes du tableau de bord | Moyen |

Tests livrés avec le code (phase 6) : registre, parcours Playwright par page (arrivée directe puis retour par l'interface, ordinateur et mobile), redirections (statut et destination réels), liens internes.

## 11. Ce que je n'ai pas pu vérifier, et pourquoi

- **Console admin** : comptes de test non administrateurs. Analyse du code seulement.
- **Inscription réelle** : créer un compte était exclu. Parcours compté dans le code (`SignInClient.tsx:158-170`, `lib/bienvenue/redirection.ts`).
- **Retour après connexion** : la connexion exige Turnstile. La conservation de `next` est lue dans le code. La perte des paramètres est, elle, mesurée sur la redirection.
- **Examen réussi puis certificat** : il faudrait réussir un examen avec un compte de test, ce qui écrit en base. Non fait.
- **Session de formation et certificat réels** : aucune session publique ni aucun certificat en base. Seules les adresses inexistantes ont été vérifiées (404 correct).
- **Paiement Chariow** : non déclenché. Les pages de retour ont été vues directement.
- **E-mails, WhatsApp, Telegram, LinkedIn** : URL relevées dans le code, aucun envoi.
- **Pages dynamiques** : une valeur d'exemple chacune (SNTS, PRSC, un article, un brief…). Un comportement propre à une autre valeur reste possible.
- **Cause du Précédent piégé (P1-10)** : l'iframe est la cause probable, pas encore prouvée.
- **Usage réel** : PostHog ne voit que les visiteurs consentants (1 045 vues sur 30 jours). Les décisions ne reposent pas sur ces chiffres.
- **Recherche Google** : pas d'accès à Search Console. La cannibalisation entre les deux fiches n'est pas mesurée.
