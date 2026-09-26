// COPIE de frontend/lib/coherence/regles.ts — frontend et scraper sont deux
// paquets TS distincts (pas de module partagé dans ce repo). Toute correction
// doit être reportée des deux côtés.
/**
 * Détecteur de contradictions entre les blocs d'une fiche société : notation,
 * publications, signal quantitatif, comptes. Module PUR — aucune I/O, aucun
 * appel Supabase, aucun composant React : toutes les entrées arrivent en
 * paramètres. La fiche société et le balayage hebdomadaire (autres tâches)
 * l'appellent chacun avec leurs propres données.
 *
 * ── POURQUOI CE MODULE ──
 * Trois défauts constatés en production le 2026-09-24, chacun assez discret
 * pour survivre longtemps à l'écran parce que chaque bloc est correct PRIS
 * ISOLÉMENT — c'est leur JUXTAPOSITION qui trompe :
 *  1. PALC affichait une notation de juillet 2025 alors qu'un PDF de notation
 *     plus récent (26 août 2026) était déjà listé juste en dessous, sur la
 *     même page.
 *  2. SNTS : le moteur écrivait « RSI 70 (neutre) » dans son explication
 *     quand son propre sous-score RSI valait −0,9871 (fortement baissier) —
 *     l'étiquette et le chiffre qui est censé la fonder ne racontent pas la
 *     même histoire.
 *  3. Des publications rattachées à la mauvaise société : « Notation
 *     Financière - SAFCA CI » sur la fiche PALC (PALMCI), « Etats financiers
 *     - Exercice 2025 - TRACTAFRIC MOTORS CI » sur la fiche CFAC (CFAO
 *     MOTORS CI).
 *
 * ── LA RÈGLE LA PLUS IMPORTANTE : NE PAS REMPLACER UN DÉFAUT PAR UN AUTRE ──
 * Un premier détecteur d'attribution, écrit naïvement (toute correspondance
 * de mot entre un libellé et un nom de société), avait signalé 11 cas dont
 * 8 faux : « SOCIETE GENERALE CI » EST bien SGBCI, « BOA NG » EST bien BOA
 * Niger (voir aussi `scraper/src/dividends/sikafinance.ts`, qui a payé le
 * même défaut sur les dividendes). Le remède n'est pas un détecteur plus
 * intelligent mais un détecteur PLUS TIMIDE : mots génériques exclus
 * (SOCIETE, BANK, AFRICA, CI…), correspondance UNIQUE exigée, et renoncement
 * dès que deux sociétés pourraient également convenir. Un trou déclaré (on
 * ne dit rien) vaut mieux qu'une accusation fausse — voir `verifierAttribution`.
 *
 * Le même principe gouverne les trois autres règles : chaque anomalie porte
 * sa preuve datée ou chiffrée, et une donnée absente, illisible ou d'une
 * forme inattendue ne produit JAMAIS d'anomalie devinée — elle écarte
 * simplement la détection pour ce cas précis.
 */

/* ───────────────────────── Types exposés ───────────────────────── */

export type RegleCode =
  | 'notation_perimee'
  | 'etiquette_contredite'
  | 'publication_mal_attribuee'
  | 'comptes_perimes';

export interface Anomalie {
  regle: RegleCode;
  gravite: 'trompeuse' | 'a_surveiller';
  /** Phrase destinée au lecteur, portant la preuve datée ou chiffrée. */
  message: string;
  /** Champs déclencheurs, pour l'audit admin. */
  preuve: Record<string, string | number | null>;
}

/** Une ligne de `publications`, telle que lue en base. */
export interface Publication {
  date_publication: string;
  libelle: string;
}

/** Une société cotée, pour la comparaison de la règle d'attribution. */
export interface RefSociete {
  code: string;
  designation: string;
}

/** Les facteurs nommés du scoring §9 (voir `scraper/src/scoring/score.ts`). */
export type FacteurNom = 'rsi' | 'macd' | 'volume' | 'variation' | 'tendance';

/** Tout ce dont `collecterAnomalies` a besoin pour faire tourner les 4 règles. */
export interface EntreeAnomalies {
  code: string;
  designation: string;
  dateNotation: string | null;
  explication: string | null;
  sousScores: Partial<Record<FacteurNom, number | null>>;
  dernierExercice: number | null;
  /**
   * TOUTES les publications rattachées à cette fiche (notation, états
   * financiers, rapports d'activité…). Une seule liste : chaque règle qui en
   * a besoin (1, 3, 4) filtre elle-même celles qui la concernent, exactement
   * comme le fait chaque fonction ci-dessous prise séparément — il n'y a pas
   * trois listes différentes à tenir à jour côté appelant.
   */
  publications: Publication[];
  /** Les autres sociétés cotées, pour repérer une publication mal attribuée. */
  autresSocietes: RefSociete[];
}

/* ───────────────────────── Seuils et vocabulaire, tous nommés ───────────────────────── */

/** Au-delà, en valeur absolue, un sous-score contredit une étiquette « neutre ». */
const SEUIL_CONTRADICTION_ETIQUETTE = 0.6;

/** En dessous, un mot est trop court pour identifier une société à lui seul. */
const LONGUEUR_MIN_MOT_DISTINCTIF = 4;

/**
 * Mots trop communs pour identifier une société précise. C'est l'exacte
 * cause du détecteur naïf évoqué en tête de fichier : « SOCIETE » et
 * « GENERALE » ne désignent pas spécifiquement SGBCI, pas plus que « BANK »
 * ne désigne une banque en particulier.
 *
 * Les codes pays à deux lettres (CI, SN, NG…) y figurent pour mémoire, mais
 * ce n'est PAS cette liste qui les arrête : `LONGUEUR_MIN_MOT_DISTINCTIF = 4`
 * les écarte avant qu'elle soit consultée. Les y laisser documente
 * l'intention ; croire qu'ils y sont utiles serait se tromper sur le code.
 */
const TERMES_GENERIQUES = new Set([
  'SOCIETE', 'SOCIETES', 'BANK', 'BANQUE', 'AFRICA', 'AFRICAN', 'AFRIQUE',
  'NATIONALE', 'NATIONAL', 'GENERALE', 'IVOIRIENNE', 'INTERNATIONALE',
  'CREDIT', 'ASSURANCE', 'ASSURANCES', 'GROUPE', 'HOLDING', 'MOTORS',
  'ENERGY', 'FINANCE', 'CI', 'SN', 'BN', 'NG', 'BF', 'TG', 'ML', 'NE',
]);

/**
 * Motifs qualifiant un facteur de « neutre » dans `signals_daily.explication`.
 * Seuls RSI et volume sont couverts : ce sont les deux tournures effectivement
 * observées en production (le RSI porte l'étiquette entre parenthèses, le
 * volume la porte dans la formulation elle-même, sans le mot « neutre »).
 * MACD, variation et tendance n'ont pas de tournure neutre connue à ce jour :
 * en inventer une sans exemple réel reviendrait à deviner un motif, donc soit
 * à ne jamais matcher, soit à matcher à tort. Ajouter une ligne suffira le
 * jour où un cas réel se présente — la liste est faite pour ça.
 */
const DETECTEURS_NEUTRES: { facteur: FacteurNom; motif: RegExp }[] = [
  { facteur: 'rsi', motif: /RSI\s+\d+\s*\(neutre\)/i },
  { facteur: 'volume', motif: /volume\s+proche\s+de\s+la\s+moyenne/i },
];

/** Le nom du facteur tel qu'on le présente au lecteur, article inclus. */
const LIBELLE_FACTEUR: Partial<Record<FacteurNom, string>> = {
  rsi: 'le RSI',
  volume: 'le volume',
};

/** Le mot-clé qui introduit une période comptable dans un libellé de publication. */
const MOTIF_PERIODE_COMPTABLE = /(?:exercice|semestre|trimestre)\s+(20\d{2})/i;

/* ───────────────────────── Normalisation et mise en forme ───────────────────────── */

/**
 * Majuscules, accents retirés — même normalisation partout dans ce module.
 *
 * Tolère autre chose qu'une chaîne, et ce n'est pas de la défiance envers le
 * type : ces valeurs viennent de Supabase, où `libelle` peut être nul même si
 * l'interface le déclare `string`. Sans cette garde, UNE ligne corrompue
 * levait un `TypeError` et faisait perdre les QUATRE règles pour la fiche
 * entière — alors que l'en-tête promet d'écarter « ce cas précis ».
 */
function normaliser(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Une chaîne exploitable, ou `null` : un libellé vide n'accuse ni ne disculpe. */
function texteUtilisable(s: unknown): string | null {
  return typeof s === 'string' && s.trim().length > 0 ? s : null;
}

/** Suites de lettres normalisées — chiffres et ponctuation servent de séparateurs. */
function tokeniser(s: string): string[] {
  return normaliser(s).split(/[^A-Z]+/).filter(Boolean);
}

function estMotDistinctif(mot: string): boolean {
  return mot.length >= LONGUEUR_MIN_MOT_DISTINCTIF && !TERMES_GENERIQUES.has(mot);
}

/** Les mots d'un nom de société qui suffiraient, seuls, à l'identifier. */
function motsDistinctifsDe(designation: string): string[] {
  return tokeniser(designation).filter(estMotDistinctif);
}

/**
 * ISO -> `Date`, ou `null` si illisible. Point de validation unique des dates.
 *
 * La validation est STRICTE : `new Date('2026-02-30')` ne vaut pas `NaN`, il
 * glisse silencieusement au 2 mars. Une date corrompue paraîtrait alors plus
 * récente qu'elle ne l'est, et suffirait à déclencher une accusation. On exige
 * donc que la date reformatée redonne exactement la chaîne reçue.
 */
function dateValide(iso: unknown): Date | null {
  if (typeof iso !== 'string') return null;
  const jour = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return null;
  const d = new Date(jour);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === jour ? d : null;
}

/** « juillet 2025 » — mois et année seuls, pour une notation déjà « affichée ». */
const moisAnnee = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

/** « 26 août 2026 » — jour, mois, année, pour une date de publication précise. */
const jourMoisAnnee = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Deux décimales, séparateur français — pour rapporter un sous-score dans un message. */
const dec2 = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ───────────────────────── 1. Notation périmée ───────────────────────── */

/**
 * Une notation affichée est-elle démentie par une publication de notation
 * plus récente, déjà en base ? `null` dès que la comparaison n'est pas
 * fondée : pas de date affichée, date illisible, ou aucune publication de
 * notation postérieure.
 */
export function verifierNotation({ dateNotation, publications }: {
  dateNotation: string | null;
  publications: Publication[];
}): Anomalie | null {
  if (!dateNotation) return null;
  const dateAffichee = dateValide(dateNotation);
  if (!dateAffichee) return null;

  let plusRecente: { date: Date; date_publication: string; libelle: string } | null = null;
  for (const p of publications) {
    if (!normaliser(p.libelle).includes('NOTATION')) continue;
    const date = dateValide(p.date_publication);
    if (!date) continue;
    if (!plusRecente || date.getTime() > plusRecente.date.getTime()) {
      plusRecente = { date, date_publication: p.date_publication, libelle: p.libelle };
    }
  }
  if (!plusRecente || plusRecente.date.getTime() <= dateAffichee.getTime()) return null;

  return {
    regle: 'notation_perimee',
    gravite: 'trompeuse',
    // Le document est CITÉ. Une accusation dont on peut lire la pièce se
    // vérifie ; sans son titre, le lecteur doit nous croire sur parole — et
    // n'aurait aucun moyen de voir qu'elle s'appuie sur le mauvais document.
    message: `La notation affichée date de ${moisAnnee(dateAffichee)} ; une notation plus récente a été publiée le ${jourMoisAnnee(plusRecente.date)} (« ${plusRecente.libelle} ») et n'est pas encore reprise.`,
    preuve: {
      date_notation: dateNotation,
      date_publication: plusRecente.date_publication,
      libelle_publication: plusRecente.libelle,
    },
  };
}

/* ───────────────────────── 2. Étiquette contredite ───────────────────────── */

/**
 * L'explication du moteur qualifie-t-elle de « neutre » un facteur dont le
 * sous-score, lui, est tranché ? Ne traite QUE les facteurs effectivement
 * nommés dans la phrase (RSI, volume — voir `DETECTEURS_NEUTRES`) : si la
 * phrase ne suit pas la forme « Facteurs : … » produite par le moteur, on ne
 * devine rien et on rend `null`.
 */
export function verifierEtiquetteTechnique({ explication, sousScores }: {
  explication: string | null;
  sousScores: Partial<Record<FacteurNom, number | null>>;
}): Anomalie | null {
  if (!explication || !/Facteurs\s*:/i.test(explication)) return null;

  for (const { facteur, motif } of DETECTEURS_NEUTRES) {
    if (!motif.test(explication)) continue;
    const sousScore = sousScores[facteur];
    if (sousScore == null || !Number.isFinite(sousScore)) continue;
    if (Math.abs(sousScore) < SEUIL_CONTRADICTION_ETIQUETTE) continue;

    return {
      regle: 'etiquette_contredite',
      gravite: 'a_surveiller',
      message: `Le moteur qualifie ${LIBELLE_FACTEUR[facteur] ?? facteur} de « neutre » alors que son sous-score vaut ${dec2(sousScore)} : l'étiquette et le chiffre ne disent pas la même chose.`,
      preuve: { facteur, sous_score: sousScore, explication },
    };
  }
  return null;
}

/* ───────────────────────── 3. Publication mal attribuée ───────────────────────── */

/**
 * Un document nomme-t-il une AUTRE société cotée, sans jamais nommer celle
 * de la fiche ? Trois conditions, LES TROIS requises :
 *  1. le libellé ne contient aucun mot distinctif de `designation` (sinon le
 *     document parle bien, au moins en partie, de la bonne société) ;
 *  2. il contient un mot distinctif d'EXACTEMENT une autre société connue ;
 *  3. ce mot n'est pas générique — garanti par construction, `motsDistinctifsDe`
 *     exclut déjà `TERMES_GENERIQUES` ; la condition est reprise ici dans
 *     l'énoncé pour rester vérifiable sans relire l'implémentation.
 *
 * Zéro correspondance ou deux (ou plus) ⇒ `null` dans les deux cas : c'est le
 * point le plus important de la fonction. Un document qui ne nomme personne
 * de connu, ou qui nomme deux sociétés à la fois, ne permet pas de trancher —
 * et un trou déclaré vaut mieux qu'une accusation fausse (voir l'en-tête de
 * fichier).
 *
 * LIMITE ASSUMÉE : cette règle ne peut signaler qu'un document nommant une
 * autre société COTÉE, c'est-à-dire présente dans `autresSocietes`. Un
 * document mal attribué qui nomme une société NON cotée (ex. un sous-traitant,
 * un actionnaire non coté) ne peut pas être détecté par une comparaison entre
 * sociétés cotées — il n'y a alors rien à quoi comparer le libellé. Ce n'est
 * pas un oubli : ajouter une liste de tiers non cotés pour combler ce trou
 * réintroduirait exactement le risque de faux positif que cette règle a été
 * réécrite pour éliminer. Voir le test sur TRACTAFRIC MOTORS CI (non coté),
 * qui documente ce comportement.
 */
export function verifierAttribution({ code, designation, libelle, autresSocietes }: {
  code: string;
  designation: string;
  libelle: string;
  autresSocietes: RefSociete[];
}): Anomalie | null {
  // Un libellé vide ou nul n'accuse personne — il écarte ce cas, pas les autres.
  if (!texteUtilisable(libelle)) return null;
  const motsLibelle = new Set(tokeniser(libelle));

  // Condition 1 : le document ne doit nommer NULLE PART la société elle-même.
  const motsPropres = motsDistinctifsDe(designation);
  // Une désignation vide, ou entièrement générique, ne peut pas se reconnaître
  // dans un libellé : la garde d'auto-mention serait alors désactivée en
  // silence et la fonction accuserait une autre société sans filet. Sans
  // savoir reconnaître son propre nom, on n'accuse personne.
  if (motsPropres.length === 0) return null;
  if (motsPropres.some((m) => motsLibelle.has(m))) return null;

  // Conditions 2 et 3 : une correspondance UNIQUE avec une autre cotée.
  const correspondances: { code: string; designation: string; mot: string }[] = [];
  for (const autre of autresSocietes) {
    if (autre.code === code) continue;
    const mot = motsDistinctifsDe(autre.designation).find((m) => motsLibelle.has(m));
    if (mot) correspondances.push({ code: autre.code, designation: autre.designation, mot });
  }
  if (correspondances.length !== 1) return null;

  const seule = correspondances[0]!;
  return {
    regle: 'publication_mal_attribuee',
    gravite: 'trompeuse',
    message: `Ce document nomme ${seule.designation}, une autre société cotée (${seule.code}). Son rattachement à cette fiche est probablement erroné.`,
    preuve: {
      code,
      designation,
      libelle,
      code_autre_societe: seule.code,
      designation_autre_societe: seule.designation,
      mot_declencheur: seule.mot,
    },
  };
}

/* ───────────────────────── 4. Comptes périmés ───────────────────────── */

/**
 * Reprend, tel quel, le segment de texte qui a permis l'extraction — y
 * compris un éventuel ordinal (« 1er », « 2e ») juste avant le mot-clé —
 * plutôt que de reconstruire une formulation générique : le libellé source
 * dit déjà ce qu'il faut dire, et le recopier évite d'inventer un numéro de
 * semestre ou de trimestre que la donnée ne fournit pas.
 */
function extrairePeriode(libelle: string): { annee: number; motCle: string; ordinal: string | null } | null {
  // Même garde que partout ailleurs : un libellé nul écarte CE cas, pas les autres.
  if (!texteUtilisable(libelle)) return null;
  const m = libelle.match(MOTIF_PERIODE_COMPTABLE);
  if (!m || m.index == null) return null;
  const anneeTexte = m[1]!;
  // `m[0]!` (et non `m[0]` comme dans l'original frontend) : le tsconfig du
  // scraper active `noUncheckedIndexedAccess`, absent côté frontend. Seule
  // adaptation de typage de cette copie — le comportement est identique.
  const motCle0 = m[0]!;
  const motCle = motCle0.slice(0, motCle0.length - anneeTexte.length).trim();
  const avant = libelle.slice(0, m.index);
  const ordinal = avant.match(/(\d{1,2}(?:er|re|e|ème|eme))\s*$/i);
  return { annee: Number(anneeTexte), motCle, ordinal: ordinal ? ordinal[1]! : null };
}

/** « l'exercice 2026 », « le 1er semestre 2026 » — sans inventer l'ordinal absent. */
function phrasePeriode({ motCle, annee, ordinal }: { motCle: string; annee: number; ordinal: string | null }): string {
  const mot = motCle.toLowerCase();
  if (mot === 'exercice') return `l'exercice ${annee}`;
  return `le ${ordinal ? `${ordinal} ` : ''}${mot} ${annee}`;
}

/**
 * Les comptes en base sont-ils démentis par une publication portant sur une
 * période plus récente ? L'année se lit avec `/(?:exercice|semestre|trimestre)\s+(20\d{2})/i` ;
 * une publication dont le libellé ne contient aucune de ces trois formes est
 * IGNORÉE, jamais devinée — elle ne compte ni pour, ni contre.
 */
export function verifierFraicheurComptes({ dernierExercice, publicationsEtatsFinanciers }: {
  dernierExercice: number | null;
  publicationsEtatsFinanciers: Publication[];
}): Anomalie | null {
  if (dernierExercice == null) return null;

  let plusRecente: { annee: number; motCle: string; ordinal: string | null; date_publication: string; libelle: string } | null = null;
  for (const p of publicationsEtatsFinanciers) {
    const periode = extrairePeriode(p.libelle);
    if (!periode || periode.annee <= dernierExercice) continue;
    if (!plusRecente || periode.annee > plusRecente.annee) {
      plusRecente = { ...periode, date_publication: p.date_publication, libelle: p.libelle };
    }
  }
  if (!plusRecente) return null;

  return {
    regle: 'comptes_perimes',
    gravite: 'a_surveiller',
    message: `Les comptes en base s'arrêtent à l'exercice ${dernierExercice}, alors qu'une publication porte sur ${phrasePeriode(plusRecente)}.`,
    preuve: {
      dernier_exercice: dernierExercice,
      annee_publication: plusRecente.annee,
      libelle_publication: plusRecente.libelle,
      date_publication: plusRecente.date_publication,
    },
  };
}

/* ───────────────────────── 5. Collecte ───────────────────────── */

/**
 * Fait tourner les quatre règles et rend les anomalies trouvées, `trompeuse`
 * avant `a_surveiller` (tri stable : au sein d'une même gravité, l'ordre de
 * détection est conservé).
 *
 * Pour la règle d'attribution, chaque publication de `entree.publications`
 * est testée séparément — une publication mal attribuée n'est pas forcément
 * une notation ou des états financiers, ça peut être n'importe quel document
 * de la fiche. Le message de cette règle ne cite que la société usurpée (pas
 * la publication en cause) : deux publications mal attribuées à la même
 * société produiraient donc le même texte, d'où la déduplication explicite.
 */
export function collecterAnomalies(entree: EntreeAnomalies): Anomalie[] {
  const anomalies: Anomalie[] = [];

  // ── L'ORDRE COMPTE, et c'est la correction d'un défaut mesuré ────────────
  // L'attribution est vérifiée EN PREMIER, et les documents récusés sont
  // retirés des règles 1 et 4. Sans cela, le module se contredisait dans sa
  // propre sortie : sur une fiche PALC dont la notation était à jour, il
  // produisait à la fois
  //   « une notation plus récente a été publiée le 1 septembre 2026 »
  //   « Ce document nomme SAFCA CI, une autre société cotée »
  // — il accusait la fiche d'être périmée en s'appuyant sur le document qu'il
  // déclarait, la ligne suivante, ne pas lui appartenir.
  //
  // LIMITE QUI SUBSISTE, à ne pas masquer : `verifierAttribution` ne récuse
  // qu'un document nommant une autre société COTÉE. Un document appartenant à
  // une société non cotée (TRACTAFRIC, par exemple) passe au travers et peut
  // encore fausser les règles 1 et 4. Le filtre réduit le risque, il ne
  // l'annule pas.
  const messagesVus = new Set<string>();
  const publicationsRecusees = new Set<Publication>();
  for (const pub of entree.publications) {
    const attribution = verifierAttribution({
      code: entree.code,
      designation: entree.designation,
      libelle: pub.libelle,
      autresSocietes: entree.autresSocietes,
    });
    if (!attribution) continue;
    publicationsRecusees.add(pub);
    if (!messagesVus.has(attribution.message)) {
      messagesVus.add(attribution.message);
      anomalies.push(attribution);
    }
  }
  const publicationsRetenues = entree.publications.filter((p) => !publicationsRecusees.has(p));

  const notation = verifierNotation({ dateNotation: entree.dateNotation, publications: publicationsRetenues });
  if (notation) anomalies.push(notation);

  const etiquette = verifierEtiquetteTechnique({ explication: entree.explication, sousScores: entree.sousScores });
  if (etiquette) anomalies.push(etiquette);

  const comptes = verifierFraicheurComptes({
    dernierExercice: entree.dernierExercice,
    publicationsEtatsFinanciers: publicationsRetenues,
  });
  if (comptes) anomalies.push(comptes);

  const ordreGravite: Record<Anomalie['gravite'], number> = { trompeuse: 0, a_surveiller: 1 };
  return anomalies.sort((a, b) => ordreGravite[a.gravite] - ordreGravite[b.gravite]);
}
