/**
 * Calculs d'analyse fondamentale (purs, testables) + garde-fous qualité.
 * Toutes les valeurs monétaires sont en FCFA. Les fonctions retournent
 * `number | null` (null = donnée insuffisante).
 */

export interface FundamentalInputs {
  cours: number | null;       // dernier cours
  shares: number | null;      // nombre d'actions
  revenue: number | null;     // chiffre d'affaires
  net_income: number | null;  // résultat net
  equity: number | null;      // capitaux propres
  debt: number | null;        // dette financière
  dividende: number | null;   // dividende par action (dernier)
}

export interface Ratios {
  bpa: number | null;          // RN / shares
  per: number | null;          // cours / bpa
  pb: number | null;           // cours / (equity / shares)
  ps: number | null;           // (cours*shares) / revenue
  capitalisation: number | null; // cours * shares
  roe: number | null;          // RN / equity
  roa: number | null;          // RN / (equity + debt)  (proxy actif)
  margeNette: number | null;   // RN / revenue
  gearing: number | null;      // debt / equity
  rendementDiv: number | null; // dividende / cours
  payout: number | null;       // (dividende * shares) / RN
}

function div(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

export function computeRatios(i: FundamentalInputs): Ratios {
  const bpa = div(i.net_income, i.shares);
  const capitalisation = i.cours != null && i.shares != null ? i.cours * i.shares : null;
  return {
    bpa,
    per: div(i.cours, bpa),
    pb: div(i.cours, div(i.equity, i.shares)),
    ps: div(capitalisation, i.revenue),
    capitalisation,
    roe: div(i.net_income, i.equity),
    roa: div(i.net_income, i.equity != null && i.debt != null ? i.equity + i.debt : null),
    margeNette: div(i.net_income, i.revenue),
    gearing: div(i.debt, i.equity),
    rendementDiv: div(i.dividende, i.cours),
    payout: i.dividende != null && i.shares != null ? div(i.dividende * i.shares, i.net_income) : null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPLÉMENTS D'ANALYSE — ajoutés le 2026-09-10.

   `computeRatios` ci-dessus couvre la valorisation (BPA, PER, P/B, ROE,
   payout…). Il lui manquait trois dérivations qu'une note d'analyste ne peut
   pas omettre, et qu'un modèle de langage ne pense pas à faire seul :

     1. la QUALITÉ du bénéfice — quelle part vient de l'exploitation ;
     2. la TRAJECTOIRE du chiffre d'affaires sur plusieurs exercices ;
     3. la DÉCOMPOSITION d'une chute un jour de détachement.

   Elles vivent ici, et non dans un nouveau module, pour qu'il n'existe qu'une
   seule source de vérité sur les ratios de ce projet.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Lignes de compte de résultat, telles que stockées (une par exercice). */
export interface LigneResultat {
  periode: string;
  revenu_total: number | null;
  resultat_exploitation: number | null;
  resultat_avant_impots: number | null;
  resultat_net: number | null;
}

export interface QualiteResultat {
  periode: string;
  resultat_exploitation: number | null;
  resultat_avant_impots: number | null;
  resultat_net: number | null;
  marge_exploitation: number | null;
  /**
   * Part du résultat AVANT IMPÔTS qui ne provient PAS de l'exploitation,
   * en fraction de 1. Proche de 0 : le profit est opérationnel, donc
   * reproductible. Au-delà de 0,5 : il tient majoritairement à des éléments
   * financiers ou exceptionnels, et rien ne garantit qu'il se répète.
   *
   * Motif de cet ajout : une note qualifiait 2025 de « retour aux bénéfices »
   * pour NEIC. Or résultat d'exploitation 1,213 Md contre résultat avant
   * impôts 2,467 Md — la moitié du profit ne venait pas de l'activité. La
   * donnée était en base ; personne ne la calculait.
   */
  part_non_operationnelle: number | null;
}

/**
 * Fusionne les lignes d'un même exercice.
 *
 * `income_statements` porte souvent DEUX lignes par période : l'extraction
 * résumée (CA, résultat net) et le détail complet (exploitation, impôts).
 * Aucune n'est complète seule. On retient, champ par champ, la première
 * valeur non nulle.
 */
export function fusionnerExercices(lignes: LigneResultat[]): LigneResultat[] {
  const parPeriode = new Map<string, LigneResultat>();
  for (const l of lignes) {
    const acc = parPeriode.get(l.periode);
    if (!acc) {
      parPeriode.set(l.periode, { ...l });
      continue;
    }
    if (acc.revenu_total == null) acc.revenu_total = l.revenu_total;
    if (acc.resultat_exploitation == null) acc.resultat_exploitation = l.resultat_exploitation;
    if (acc.resultat_avant_impots == null) acc.resultat_avant_impots = l.resultat_avant_impots;
    if (acc.resultat_net == null) acc.resultat_net = l.resultat_net;
  }
  return [...parPeriode.values()].sort((a, b) => b.periode.localeCompare(a.periode));
}

export function qualiteResultat(ligne: LigneResultat | null | undefined): QualiteResultat | null {
  if (!ligne) return null;
  const rexp = ligne.resultat_exploitation;
  const rai = ligne.resultat_avant_impots;
  return {
    periode: ligne.periode,
    resultat_exploitation: rexp,
    resultat_avant_impots: rai,
    resultat_net: ligne.resultat_net,
    marge_exploitation: div(rexp, ligne.revenu_total),
    // Exige les DEUX termes : sans le résultat d'exploitation la question n'a
    // pas de réponse, et une approximation serait pire que le silence.
    part_non_operationnelle:
      rexp != null && rai != null && rai !== 0 ? (rai - rexp) / Math.abs(rai) : null,
  };
}

/**
 * Croissance du chiffre d'affaires sur `nAnnees` exercices, en fraction de 1.
 * `lignes` doit être trié du plus récent au plus ancien.
 */
export function croissanceCA(lignes: LigneResultat[], nAnnees: number): number | null {
  const recent = lignes[0]?.revenu_total ?? null;
  const ancien = lignes[nAnnees]?.revenu_total ?? null;
  if (recent == null || ancien == null || ancien === 0) return null;
  return (recent - ancien) / ancien;
}

export interface Detachement {
  ex_date: string;
  dividende: number;
  cours_veille: number;
  cours_ex: number;
  baisse_fcfa: number;
  /** Part de la baisse expliquée par le seul détachement, en fraction de 1. */
  part_expliquee: number | null;
  /** Recul subsistant une fois la référence ajustée du dividende. */
  recul_hors_dividende: number | null;
}

/**
 * Décompose la chute d'un jour de détachement.
 *
 * Motif : une note écrivait « probable ajustement post-dividende » devant un
 * −11,74 % alors que le dividende n'en expliquait que 4,7 points. Attribuer
 * toute la baisse au détachement est une erreur d'analyse — et la
 * décomposition n'est qu'une soustraction, elle n'a pas à être confiée au
 * modèle.
 */
export function expliqueDetachement(
  exDate: string,
  dividende: number | null,
  coursVeille: number | null,
  coursEx: number | null,
): Detachement | null {
  if (dividende == null || coursVeille == null || coursEx == null) return null;
  if (dividende <= 0 || coursVeille <= 0) return null;
  const baisse = coursVeille - coursEx;
  const reference = coursVeille - dividende;
  return {
    ex_date: exDate,
    dividende,
    cours_veille: coursVeille,
    cours_ex: coursEx,
    baisse_fcfa: baisse,
    part_expliquee: baisse > 0 ? Math.min(dividende / baisse, 1) : null,
    recul_hors_dividende: reference > 0 ? (coursEx - reference) / reference : null,
  };
}

export interface FundamentalRow {
  year: number | null;
  revenue: number | null;
  net_income: number | null;
  equity: number | null;
  debt?: number | null;
  cash?: number | null;
  bfr?: number | null;
  is_manual?: boolean | null;
  source_file?: string | null;
}

/**
 * Sélectionne la « meilleure » ligne de fondamentaux à afficher.
 * Règle (best practice — fraîcheur + fiabilité) :
 *  1. On préfère l'exercice le PLUS RÉCENT dont les données sont plausibles
 *     (CA, RN, capitaux propres non aberrants — cf. assessQuality).
 *  2. À plausibilité et année égales, une ligne corrigée manuellement l'emporte.
 *  3. Si aucune ligne plausible, on retombe sur la plus récente disponible.
 */
export function pickBestFundamental<T extends FundamentalRow>(rows: T[]): T | null {
  if (!rows.length) return null;

  const isPlausible = (r: FundamentalRow): boolean =>
    assessQuality('revenue', r.revenue) === 'ok' &&
    assessQuality('net_income', r.net_income) === 'ok' &&
    (r.equity == null || assessQuality('equity', r.equity) === 'ok');

  const score = (r: T): [number, number, number] => [
    isPlausible(r) ? 1 : 0,        // plausible d'abord
    r.year ?? 0,                    // puis année récente
    r.is_manual ? 1 : 0,            // puis manuel
  ];

  return [...rows].sort((a, b) => {
    const sa = score(a), sb = score(b);
    return sb[0] - sa[0] || sb[1] - sa[1] || sb[2] - sa[2];
  })[0]!;
}

/**
 * `ns` = non significatif : le calcul est juste mais le ratio n'a pas de sens
 * financier. Un PER negatif ne trahit AUCUNE erreur d'extraction — il dit que la
 * societe perd de l'argent (SCRC : -10,3 Md FCFA en 2023, chiffre verifie). Le
 * confondre avec `suspect` envoyait l'utilisateur verifier des etats financiers
 * parfaitement corrects, et surtout laissait ces valeurs etre CLASSEES : au tri
 * par PER croissant, les plus grosses pertes remontaient en tete, presentees
 * comme les titres les moins chers.
 */
export type Quality = 'ok' | 'suspect' | 'ns' | 'missing';

/**
 * Évalue la plausibilité d'une métrique. Best practice : ne jamais afficher un
 * chiffre faux comme vrai. Les plages sont volontairement larges.
 */
export function assessQuality(metric: string, value: number | null): Quality {
  if (value == null || Number.isNaN(value)) return 'missing';
  switch (metric) {
    case 'revenue':
    case 'net_income':
    case 'equity':
    case 'capitalisation':
      // Une société cotée BRVM a un CA/RN/equity/capi > 1M FCFA (sinon extraction ratée).
      return Math.abs(value) < 1_000_000 ? 'suspect' : 'ok';
    case 'per':
      // Benefice negatif -> PER non significatif (convention financiere), pas
      // une donnee douteuse. Au-dela de 1000 en revanche, l'extraction est en cause.
      if (value < 0) return 'ns';
      return value > 1000 ? 'suspect' : 'ok';
    case 'pb':
    case 'ps':
      // Capitaux propres negatifs -> multiple non significatif.
      if (value < 0) return 'ns';
      return value > 100 ? 'suspect' : 'ok';
    case 'margeNette':
      return Math.abs(value) > 1 ? 'suspect' : 'ok';   // |marge| > 100%
    case 'roe':
    case 'roa':
      return Math.abs(value) > 2 ? 'suspect' : 'ok';   // |ROE| > 200%
    case 'gearing':
      return value < 0 || value > 20 ? 'suspect' : 'ok';
    case 'rendementDiv':
      return value < 0 || value > 0.5 ? 'suspect' : 'ok'; // rdt > 50%
    case 'payout':
      return value < 0 || value > 3 ? 'suspect' : 'ok';
    default:
      return 'ok';
  }
}
