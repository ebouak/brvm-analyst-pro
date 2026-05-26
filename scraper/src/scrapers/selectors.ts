/**
 * Registre central de tous les sélecteurs CSS et noms de champs ASP.NET
 * utilisés pour scraper bfin.brvm.org.
 *
 * PROCÉDURE DE CALIBRAGE (docs/SCRAPER.md §4) :
 *
 *   1. Connectez-vous manuellement à bfin.brvm.org dans Chrome.
 *   2. Ouvrez DevTools → Elements. Relevez les attributs `name=` / `id=`
 *      des champs de login, du sélecteur de date et des GridView.
 *   3. Mettez à jour les valeurs ci-dessous et relancez :
 *        LOG_LEVEL=debug DRY_RUN=true tsx src/index.ts daily
 *   4. Vérifiez les comptages dans les logs (actions/obligations/indices).
 *   5. Commitez une fixture HTML dans tests/fixtures/ pour la régression.
 *
 * Chaque section est annotée avec le fichier d'origine, pour traçabilité.
 */

// ---------------------------------------------------------------------------
// AUTH — page de login (client/auth.ts : LOGIN_FIELDS)
// ---------------------------------------------------------------------------

/**
 * Noms exacts des contrôles du formulaire de connexion.
 * Valeur par défaut basée sur les conventions ASP.NET WebForms.
 * À confirmer sur le markup réel (inspecteur Chrome).
 */
export const LOGIN = {
  /** Champ identifiant (name= du <input type="text">). */
  username: 'ctl00$ContentPlaceHolder1$txtLogin',
  /** Champ mot de passe (name= du <input type="password">). */
  password: 'ctl00$ContentPlaceHolder1$txtPassword',
  /** UniqueID du bouton de soumission (utilisé dans __EVENTTARGET). */
  submit: 'ctl00$ContentPlaceHolder1$btnConnexion',
  /** Valeur affichée sur le bouton (input[type="submit"].value). */
  submitValue: 'Connexion',
} as const;

// ---------------------------------------------------------------------------
// MARKET PAGE — Activites_marche.aspx (scrapers/activitesMarche.ts)
// ---------------------------------------------------------------------------

/**
 * Contrôles du formulaire de sélection de date.
 * BDFIN permet de consulter une séance précise via postback sur ce formulaire.
 */
export const MARKET_DATE = {
  /** name= du champ date (format attendu : jj/mm/aaaa). */
  dateInput: 'ctl00$ContentPlaceHolder1$txtDate',
  /** UniqueID du bouton "Afficher". */
  submit: 'ctl00$ContentPlaceHolder1$btnAfficher',
  submitValue: 'Afficher',
} as const;

// ---------------------------------------------------------------------------
// ACTIONS TABLE (parsers/actions.ts : ACTIONS_TABLE_SELECTORS)
// ---------------------------------------------------------------------------

/**
 * Candidats de sélecteur CSS pour le GridView des actions.
 * Le parser tente chaque sélecteur dans l'ordre jusqu'à trouver une table
 * non vide. Ajoutez le sélecteur réel en tête de liste après calibrage.
 *
 * Candidat le plus probable : id du GridView ASP.NET, ex :
 *   #ContentPlaceHolder1_GridView1  ou  #ContentPlaceHolder1_gvCotations
 */
export const ACTIONS_TABLE = [
  '#ContentPlaceHolder1_GridViewActions',
  '#ContentPlaceHolder1_gvActions',
  '#ContentPlaceHolder1_GridView1',
  '#ContentPlaceHolder1_gvCotations',
  'table[id*="Action"]',
  'table[id*="Cotation"]',
  'table.gridActions',
] as const;

/**
 * Alias d'en-tête → champ logique pour les actions.
 * Étendre avec les libellés réels si le matching échoue en production.
 * Le matching est insensible à la casse et aux accents (buildColumnIndex).
 */
export const ACTIONS_COLUMNS: Record<string, string[]> = {
  code:            ['code', 'symbole', 'ticker'],
  designation:     ['designation', 'libelle', 'titre', 'societe', 'valeur'],
  pays:            ['pays'],
  secteur:         ['secteur', 'activite'],
  cours_precedent: ['cours precedent', 'cours veille', 'precedent', 'cloture veille', 'cloture precedente'],
  cours_jour:      ['cours jour', 'cours du jour', 'cloture', 'dernier cours', 'cours'],
  // Pas de colonne variation% sur BDFIN — calculé post-parse depuis cours_jour/cours_precedent.
  variation_pct:   ['variation %', 'var %', 'var. %', 'variation pct'],
  volume:          ['volume', 'volume echange', 'titres echanges', 'quantite echangee', 'quantite'],
  nb_transactions: ['nombre transactions', 'nb transactions', 'transactions', 'nombre de transactions'],
  valeur_echangee: ['valeur echangee', 'valeur echange', 'montant', 'capitaux'],
};

// ---------------------------------------------------------------------------
// OBLIGATIONS TABLE (parsers/obligations.ts)
// ---------------------------------------------------------------------------

export const OBLIGATIONS_TABLE = [
  '#ContentPlaceHolder1_GridViewObligations',
  '#ContentPlaceHolder1_gvObligations',
  '#ContentPlaceHolder1_GridView2',
  'table[id*="Obligation"]',
  'table.gridObligations',
] as const;

export const OBLIGATIONS_COLUMNS: Record<string, string[]> = {
  code:            ['isin', 'code isin', 'code'],
  designation:     ['designation', 'libelle', 'titre', 'obligation'],
  // emetteur/taux/maturite absents de la page activités — enrichis via référentiel séparé.
  emetteur:        ['emetteur', 'emmetteur', 'issuer', 'etat emetteur'],
  taux_pct:        ['taux', 'coupon', 'taux nominal', 'taux %'],
  maturite:        ['maturite', 'echeance', 'date echeance', 'date maturite'],
  cours_precedent: ['cours precedent', 'precedent', 'prix precedent', 'cloture veille'],
  cours_jour:      ['cours jour', 'cours', 'cloture', 'prix'],
  volume:          ['volume', 'volume echange', 'quantite', 'titres echanges'],
  nb_transactions: ['nombre transactions', 'nb transactions', 'transactions'],
  valeur_echangee: ['valeur echangee', 'valeur echange', 'montant', 'capitaux'],
};

// ---------------------------------------------------------------------------
// INDICES TABLE (parsers/indices.ts)
// ---------------------------------------------------------------------------

export const INDICES_TABLE = [
  '#ContentPlaceHolder1_GridViewIndices',
  '#ContentPlaceHolder1_gvIndices',
  'table[id*="Indice"]',
  'table[id*="Index"]',
  'table.gridIndices',
] as const;

export const INDICES_COLUMNS: Record<string, string[]> = {
  libelle:           ['indice', 'libelle', 'designation', 'nom'],
  // BDFIN affiche "Fermeture" (pas "Valeur") pour les indices.
  valeur:            ['fermeture', 'valeur', 'cours', 'niveau', 'valeur jour', 'cloture'],
  valeur_precedente: ['precedent', 'valeur precedente', 'veille', 'ouverture'],
  // "Variation en valeur" est la var. absolue ; "Variation en %" est le pourcentage.
  variation_abs:     ['variation en valeur', 'var. valeur', 'variation valeur'],
  variation_pct:     ['variation en %', 'variation %', 'var. %', 'var %', 'variation pct'],
};

// ---------------------------------------------------------------------------
// EVENTS / COMMUNIQUÉS (events/parser.ts)
// ---------------------------------------------------------------------------

/**
 * Sélecteurs pour la page de communiqués brvm.org (hors BDFIN).
 * À calibrer séparément — le site brvm.org a une structure différente.
 */
export const EVENTS = {
  /** Conteneur de la liste des communiqués. */
  list: '.communiques-list, .avis-list, #communiques',
  /** Chaque item de communiqué. */
  item: '.communique-item, .avis-item, article',
  /** Titre du communiqué dans l'item. */
  title: 'h2, h3, .title, .titre',
  /** Date de publication. */
  date: '.date, time, .published',
  /** Lien vers le détail. */
  link: 'a[href]',
} as const;

// ---------------------------------------------------------------------------
// TYPE utilitaire
// ---------------------------------------------------------------------------

/** Toutes les constantes de sélection exportées en un seul objet. */
export const SELECTORS = {
  login:       LOGIN,
  marketDate:  MARKET_DATE,
  actions:     { table: ACTIONS_TABLE,     columns: ACTIONS_COLUMNS },
  obligations: { table: OBLIGATIONS_TABLE, columns: OBLIGATIONS_COLUMNS },
  indices:     { table: INDICES_TABLE,     columns: INDICES_COLUMNS },
  events:      EVENTS,
} as const;
