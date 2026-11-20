// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts
// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.
// Régénérer avec `node scripts/sync-hebdo-pure.mjs` (vérifié par tests/hebdoCopies.test.ts).
/**
 * Analyse hebdomadaire enrichie — fonctions PURES, testées. Elles reçoivent des
 * lignes déjà lues en base et rendent le bloc `HebdoAnalyse` figé dans le
 * snapshot. Aucune estimation : une donnée absente ou douteuse rend `null`, et
 * la phrase correspondante disparaît du narratif.
 */
import { MARGE_SORTIE_PCT, pasDeCotation } from './levels.js';
import { lireDividende } from './rendementDividende.js';
import type { CarnetFige, EvenementFige, HebdoAnalyse } from './types.js';

/** Indices sectoriels BRVM, par libellé de secteur de `brvm_instruments`. */
export const INDICE_SECTEUR: Record<string, string> = {
  'Consommation de base': 'BRVMCBASE',
  'Consommation discrétionnaire': 'BRVMCDISC',
  'Services financiers': 'BRVMFINS',
  'Télécommunications': 'BRVMTELE',
  'Industriels': 'BRVMINDU',
  'Énergie': 'BRVMENER',
  'Services publics': 'BRVMSPUB',
};
export const INDICE_MARCHE = 'BRVMC';

/** Même seuils que `lib/agent/chatbotPur.ts` (BPA à 5 % de résultat ÷ titres, comptes de 2 ans au plus). */
export const ECART_BPA_MAX = 0.05;
export const AGE_COMPTES_MAX = 2;
/** Sous ce nombre de pairs, une médiane sectorielle ne dit rien : on ne l'écrit pas. */
export const PAIRS_MIN = 3;
/** Fenêtre des détachements / paiements « à venir ». */
export const HORIZON_A_VENIR_JOURS = 30;

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

export interface PointSerie { date: string; close: number; volume: number | null; valeur: number | null }
export interface PointIndice { date: string; valeur: number }

export interface IncomeAnnuel {
  periode: string;
  resultat_net: number | null;
  resultat_exploitation: number | null;
  resultat_avant_impots: number | null;
  benefice_par_action: number | null;
}

export interface DividendeLigne {
  exercice: number | null;
  montant: number | null;
  base_fiscale: string | null;
  ex_date: string | null;
  payment_date: string | null;
}

export interface CarnetLigne {
  date_marche: string;
  cours_achat: number | null;
  cours_vente: number | null;
  achat_au_marche: boolean | null;
  vente_au_marche: boolean | null;
}

export interface Pair {
  code: string;
  cours: number | null;
  titres: number | null;
  income: IncomeAnnuel[];
  dividendes: DividendeLigne[];
}

export interface EntreeAnalyse {
  dateEdition: string;
  /** Clôtures de la valeur, chronologiques, jusqu'à la date d'édition incluse. */
  serie: PointSerie[];
  /** Dernière clôture de l'année précédente (pour la variation depuis janvier). */
  clotureFinAnnee: { date: string; close: number } | null;
  /** Opérations sur titres de la valeur (fractionnement, regroupement…). */
  operations: { date_effet: string; type: string }[];
  bornes52: { haut: number | null; bas: number | null };
  /** Points des indices (BRVM Composite et indice sectoriel), toutes dates. */
  indices: Record<string, { points: PointIndice[] }>;
  secteur: string | null;
  /** Valeur échangée sur toute la cote pendant la semaine. */
  valeurMarcheSemaine: number | null;
  liquidite: { classe: string | null; valeur_moyenne_30j: number | null } | null;
  carnet: CarnetLigne | null;
  titres: number | null;
  income: IncomeAnnuel[];
  dividendes: DividendeLigne[];
  /** AUTRES valeurs du même secteur. */
  pairs: Pair[];
  publications: { date_publication: string; libelle: string }[];
  actualites: { event_date: string; title: string }[];
}

const LIBELLE_CLASSE: Record<string, string> = {
  A: 'négociable sans friction',
  B: 'négociable avec précaution',
  C: 'peu négociable',
  D: 'très illiquide',
};

/** Lundi de la semaine calendaire d'une date ISO. */
export function lundiDe(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const jour = (d.getUTCDay() + 6) % 7; // 0 = lundi
  d.setUTCDate(d.getUTCDate() - jour);
  return d.toISOString().slice(0, 10);
}

function ajouterJours(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Variation de la semaine : dernière clôture rapportée à la clôture de la
 * séance qui PRÉCÈDE la semaine. L'ancien calcul partait de la clôture du
 * lundi et oubliait donc le mouvement du lundi (SLBC, 13/11/2026 : +7,38 %
 * affiché pour +9,79 % réels).
 */
export function variationHebdomadaire(
  serie: { date: string; close: number }[],
  dateEdition: string,
): { variation: number | null; dateReference: string | null; seances: number } {
  const lundi = lundiDe(dateEdition);
  const avant = serie.filter((p) => p.date < lundi && p.close > 0);
  const semaine = serie.filter((p) => p.date >= lundi && p.date <= dateEdition);
  const ref = avant[avant.length - 1];
  const fin = semaine[semaine.length - 1];
  if (!ref || !fin) return { variation: null, dateReference: ref?.date ?? null, seances: semaine.length };
  return { variation: ((fin.close - ref.close) / ref.close) * 100, dateReference: ref.date, seances: semaine.length };
}

function variationIndice(points: PointIndice[], dateEdition: string): number | null {
  const lundi = lundiDe(dateEdition);
  const tri = [...points].filter((p) => p.valeur > 0).sort((a, b) => a.date.localeCompare(b.date));
  const ref = tri.filter((p) => p.date < lundi).at(-1);
  const fin = tri.filter((p) => p.date >= lundi && p.date <= dateEdition).at(-1);
  if (!ref || !fin) return null;
  return r2(((fin.valeur - ref.valeur) / ref.valeur) * 100);
}

export function mediane(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

function annee(periode: string | number | null | undefined): number {
  return Number(String(periode ?? '').slice(0, 4)) || 0;
}

function dernierExercice(rows: IncomeAnnuel[]): IncomeAnnuel | null {
  return [...rows].filter((r) => r.periode && r.resultat_net != null)
    .sort((a, b) => b.periode.localeCompare(a.periode))[0] ?? null;
}

/**
 * PER fiable ou null. Même garde-fou que l'agent : BPA publié cohérent avec
 * résultat ÷ titres (un écart trahit un nombre de titres d'avant
 * fractionnement), comptes de moins de deux ans, bénéfice positif.
 */
export function perFiable(
  rows: IncomeAnnuel[], titres: number | null, cours: number | null, anneeSeance: number,
): { exercice: string; bpa: number; per: number } | null {
  const d = dernierExercice(rows);
  if (!d || !titres || !cours || cours <= 0) return null;
  const rn = d.resultat_net!;
  const bpa = d.benefice_par_action;
  if (rn <= 0 || bpa == null || bpa <= 0) return null;
  const a = annee(d.periode);
  if (!a || anneeSeance - a > AGE_COMPTES_MAX) return null;
  if (Math.abs(rn / titres / bpa - 1) > ECART_BPA_MAX) return null;
  return { exercice: String(a), bpa, per: r1((cours * titres) / rn) };
}

/**
 * Dernier dividende NET exploitable : base fiscale déclarée « net » (calendrier
 * officiel de la BRVM), montant positif et distinct de l'exercice (lignes
 * `montant = exercice` de l'ancien import), exercice de deux ans au plus.
 */
export function dividendeNet(rows: DividendeLigne[], anneeSeance: number): { exercice: number; montant: number } | null {
  const ok = dividendesNets(rows)
    .filter((r) => anneeSeance - (r.exercice ?? 0) <= AGE_COMPTES_MAX)
    .sort((a, b) => (b.exercice ?? 0) - (a.exercice ?? 0));
  const d = ok[0];
  return d ? { exercice: d.exercice!, montant: d.montant! } : null;
}

/** Lignes nettes exploitables (sans filtre d'âge) : l'historique dont la règle du rendement a besoin. */
function dividendesNets(rows: DividendeLigne[]): DividendeLigne[] {
  return rows.filter((r) => r.base_fiscale === 'net' && r.montant != null && r.montant > 0 && r.exercice != null && r.montant !== r.exercice);
}

/**
 * Ce que le texte peut dire du dernier dividende net : un rendement au cours,
 * ou seulement le montant versé s'il est ancien ou anormal (règle unique,
 * ./rendementDividende). null : aucun dividende net exploitable.
 */
export function lectureDividendeNet(rows: DividendeLigne[], anneeSeance: number, cours: number | null, dateSeance: string) {
  if (!dividendeNet(rows, anneeSeance)) return null;
  return lireDividende(dividendesNets(rows), cours, dateSeance);
}

export function qualiteBenefice(rows: IncomeAnnuel[], anneeSeance: number): HebdoAnalyse['benefice'] {
  const d = dernierExercice(rows);
  if (!d) return null;
  const a = annee(d.periode);
  if (!a || anneeSeance - a > AGE_COMPTES_MAX) return null;
  const prec = rows.find((r) => annee(r.periode) === a - 1) ?? null;
  const varPos = (x: number | null | undefined, y: number | null | undefined) =>
    x != null && y != null && x > 0 && y > 0 ? r1(((x - y) / y) * 100) : null;
  const rex = d.resultat_exploitation;
  const rai = d.resultat_avant_impots;
  return {
    exercice: String(a),
    resultatNet: d.resultat_net!,
    variationNetPct: varPos(d.resultat_net, prec?.resultat_net),
    resultatExploitation: rex,
    variationExploitationPct: varPos(rex, prec?.resultat_exploitation),
    resultatAvantImpots: rai,
    partHorsExploitationPct: rex != null && rai != null && rai > 0 ? r1(((rai - rex) / rai) * 100) : null,
  };
}

export function carnetFige(c: CarnetLigne | null): CarnetFige | null {
  if (!c) return null;
  const achat = c.achat_au_marche ? null : c.cours_achat;
  const vente = c.vente_au_marche ? null : c.cours_vente;
  const fourchette =
    achat != null && vente != null && achat > 0 && vente >= achat
      ? r2(((vente - achat) / ((vente + achat) / 2)) * 100)
      : null;
  return {
    date: c.date_marche,
    coursAchat: c.cours_achat,
    coursVente: c.cours_vente,
    achatAuMarche: !!c.achat_au_marche,
    venteAuMarche: !!c.vente_au_marche,
    fourchettePct: fourchette,
  };
}

export function evenementsSemaine(e: EntreeAnalyse): EvenementFige[] {
  const lundi = lundiDe(e.dateEdition);
  const fin = e.dateEdition;
  const horizon = ajouterJours(fin, HORIZON_A_VENIR_JOURS);
  const dans = (d: string | null | undefined) => !!d && d >= lundi && d <= fin;
  const bientot = (d: string | null | undefined) => !!d && d > fin && d <= horizon;
  const out: EvenementFige[] = [];
  for (const p of e.publications) if (dans(p.date_publication)) out.push({ date: p.date_publication, nature: 'publication', libelle: p.libelle, aVenir: false });
  const titresPub = new Set(out.map((x) => x.libelle.toLowerCase()));
  for (const a of e.actualites) {
    if (dans(a.event_date) && !titresPub.has(a.title.toLowerCase())) out.push({ date: a.event_date, nature: 'actualite', libelle: a.title, aVenir: false });
  }
  for (const o of e.operations) if (dans(o.date_effet)) out.push({ date: o.date_effet, nature: 'operation', libelle: o.type, aVenir: false });
  for (const d of e.dividendes) {
    if (d.montant == null || d.montant <= 0 || d.exercice == null) continue;
    const lib = `dividende de l’exercice ${d.exercice}`;
    if (dans(d.ex_date) || bientot(d.ex_date)) out.push({ date: d.ex_date!, nature: 'detachement', libelle: lib, aVenir: bientot(d.ex_date) });
    if (dans(d.payment_date) || bientot(d.payment_date)) out.push({ date: d.payment_date!, nature: 'paiement', libelle: lib, aVenir: bientot(d.payment_date) });
  }
  const vus = new Set<string>();
  return out
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((x) => { const k = `${x.date}|${x.nature}|${x.libelle}`; if (vus.has(k)) return false; vus.add(k); return true; })
    .slice(0, 6);
}

export function construireAnalyse(e: EntreeAnalyse): HebdoAnalyse {
  const anneeSeance = annee(e.dateEdition);
  const closes = e.serie.map((p) => p.close);
  const dernier = e.serie.at(-1)?.close ?? null;
  const lundi = lundiDe(e.dateEdition);
  const vh = variationHebdomadaire(e.serie, e.dateEdition);
  const semaine = e.serie.filter((p) => p.date >= lundi && p.date <= e.dateEdition);

  const marchePts = e.indices[INDICE_MARCHE];
  const vMarche = marchePts ? variationIndice(marchePts.points, e.dateEdition) : null;
  const codeIndiceSecteur = e.secteur ? INDICE_SECTEUR[e.secteur] : undefined;
  const secPts = codeIndiceSecteur ? e.indices[codeIndiceSecteur] : undefined;
  const vSecteur = secPts ? variationIndice(secPts.points, e.dateEdition) : null;

  // Position sur un an : bornes tenues par range52 ; écartées si incohérentes.
  const { haut, bas } = e.bornes52;
  const bornesOk = dernier != null && haut != null && bas != null && bas > 0 && bas <= dernier && dernier <= haut;
  // Depuis janvier : refusé si une opération sur titres sépare les deux cours
  // (un fractionnement non ajusté fabriquerait une chute de 90 %).
  const ref = e.clotureFinAnnee;
  const opEntre = ref != null && e.operations.some((o) => o.date_effet > ref.date && o.date_effet <= e.dateEdition);
  const depuisJanvier = ref && dernier != null && ref.close > 0 && !opEntre ? r2(((dernier - ref.close) / ref.close) * 100) : null;

  const somme = (xs: (number | null)[]) => (xs.some((x) => x != null) ? xs.reduce<number>((a, x) => a + (x ?? 0), 0) : null);
  const titresSemaine = somme(semaine.map((p) => p.volume));
  const valeurSemaine = somme(semaine.map((p) => p.valeur));
  const classe = e.liquidite?.classe && ['A', 'B', 'C', 'D'].includes(e.liquidite.classe)
    ? (e.liquidite.classe as 'A' | 'B' | 'C' | 'D') : null;

  const per = perFiable(e.income, e.titres, dernier, anneeSeance);
  const perPairs = e.pairs.map((p) => perFiable(p.income, p.titres, p.cours, anneeSeance)?.per).filter((x): x is number => x != null);
  const div = lectureDividendeNet(e.dividendes, anneeSeance, dernier ?? null, e.dateEdition);
  // Médiane du secteur : seulement les rendements que la règle laisse écrire
  // (un dividende ancien ou anormal d'un pair fausserait la comparaison).
  const rdtPairs = e.pairs
    .map((p) => { const d = lectureDividendeNet(p.dividendes, anneeSeance, p.cours, e.dateEdition); return d?.mode === 'rendement' ? d.rendementPct : null; })
    .filter((x): x is number => x != null);
  const med = (xs: number[], arr: (x: number) => number) => (xs.length >= PAIRS_MIN ? arr(mediane(xs)!) : null);

  return {
    version: 2,
    pas: pasDeCotation(closes),
    margePct: MARGE_SORTIE_PCT,
    semaine: { debut: lundi, fin: e.dateEdition, seances: vh.seances, dateReference: vh.dateReference },
    marche: vMarche != null ? { libelle: 'BRVM Composite', variation: vMarche } : null,
    secteur: e.secteur
      ? { nom: e.secteur, indice: vSecteur != null ? { libelle: `indice sectoriel ${e.secteur}`, variation: vSecteur } : null }
      : null,
    annee: {
      haut52: bornesOk ? haut : null,
      bas52: bornesOk ? bas : null,
      depuisJanvier,
      dateRefJanvier: depuisJanvier != null ? ref!.date : null,
    },
    liquidite: {
      titresSeance: e.serie.at(-1)?.volume ?? null,
      valeurSeance: e.serie.at(-1)?.valeur ?? null,
      titresSemaine,
      valeurSemaine,
      partMarchePct: valeurSemaine != null && e.valeurMarcheSemaine && e.valeurMarcheSemaine > 0
        ? r2((valeurSemaine / e.valeurMarcheSemaine) * 100) : null,
      valeurMoyenne30j: e.liquidite?.valeur_moyenne_30j ?? null,
      classe,
      libelleClasse: classe ? LIBELLE_CLASSE[classe]! : null,
      carnet: carnetFige(e.carnet),
    },
    valorisation: per
      ? { ...per, perMedianeSecteur: med(perPairs, r1), nbPairsPer: perPairs.length }
      : null,
    dividende: div
      ? div.mode === 'rendement'
        ? {
            exercice: div.exercice,
            montant: div.montant,
            rendementPct: r2(div.rendementPct),
            payeLe: div.payment_date,
            rendementMedianeSecteur: med(rdtPairs, r2),
            nbPairs: rdtPairs.length,
          }
        : { exercice: div.exercice, montant: div.montant, rendementPct: null, payeLe: div.payment_date, rendementMedianeSecteur: null, nbPairs: 0 }
      : null,
    benefice: qualiteBenefice(e.income, anneeSeance),
    evenements: evenementsSemaine(e),
  };
}
