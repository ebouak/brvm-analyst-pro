import { computeRatios } from '../fundamentals';

/**
 * Parties PURES des outils de l'assistant WhatsApp (lib/agent/outilsChatbot.ts).
 */

export interface LeconIndex {
  cours: string;
  slug: string;
  titre: string;
}

const MOTS_VIDES = new Set([
  'les', 'des', 'une', 'que', 'qui', 'quoi', 'est', 'comment', 'pour', 'sur', 'dans', 'avec', 'par', 'mon', 'mes',
  'son', 'ses', 'aux', 'faire', 'fait', 'cest', 'quest', 'brvm', 'bourse', 'action', 'actions', 'expliquer',
  'explique', 'expliquez', 'moi', 'svp', 'veut', 'dire', 'signifie', 'lecon', 'niveau',
]);

const normaliser = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Racine grossière : « dividendes » et « dividende » se rejoignent. */
const racine = (t: string) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);

function termes(s: string): string[] {
  return [...new Set(normaliser(s).split(' '))]
    .filter((t) => (t.length >= 3 || t === 'pe') && !MOTS_VIDES.has(t))
    .map(racine);
}

/** Leçons dont le titre partage le plus de termes avec le sujet (3 au plus, score > 0). */
export function classerNotions(sujet: string, lecons: LeconIndex[]): LeconIndex[] {
  const q = termes(sujet);
  if (q.length === 0) return [];
  return lecons
    .map((l) => {
      const t = new Set(termes(l.titre));
      const score = q.filter((m) => t.has(m)).length;
      return { l, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.l.titre.localeCompare(b.l.titre))
    .slice(0, 3)
    .map((x) => x.l);
}

/** Sur WhatsApp, ni signal ni confiance : ce serait une recommandation (spec §3). */
export function sansSignal(r: unknown): unknown {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return r;
  const { signal: _s, confiance: _c, ...reste } = r as Record<string, unknown>;
  return reste;
}

/** « SNTS, ORAC ; SGBC » ou « Sonatel et Orange CI » → 2 à 3 saisies distinctes, sinon null. */
export function lireListeValeurs(saisie: string): string[] | null {
  const liste = [...new Set(saisie.split(/[,;/]+|\s+et\s+/i).map((s) => s.trim()).filter(Boolean))].slice(0, 3);
  return liste.length >= 2 ? liste : null;
}

export interface EntreeParAction {
  /** Exercice des comptes (« 2025 »). */
  exercice: string | number | null;
  resultatNet: number | null;
  /** BPA publié, en base. */
  bpa: number | null;
  /** Dividende par action en base. Zéro = inconnu : ces zéros sont souvent des trous de collecte. */
  dpa: number | null;
  titres: number | null;
  cours: number | null;
  /** Année de la séance, pour écarter des comptes trop anciens. */
  anneeSeance: number;
}

export interface ChiffresParAction {
  exercice: string;
  bpa_fcfa: number;
  dividende_par_action_fcfa: number | null;
  /** null en cas de perte : un PER négatif ne signifie rien. */
  per: number | null;
  base_per: string;
}

/** Écart toléré entre le BPA publié et résultat net ÷ titres. */
export const ECART_BPA_MAX = 0.05;
/** Au-delà, un PER compare un cours d'aujourd'hui à des comptes dépassés (STAC : 2021). */
export const AGE_COMPTES_MAX = 2;

/**
 * BPA, dividende par action et PER, ou null si on ne peut pas s'y fier. Le PER
 * sort de computeRatios, le calcul de la fiche société : l'assistant et le site
 * donnent le même chiffre.
 *
 * Le contrôle : le BPA publié doit coller à résultat net ÷ titres. Mesuré le
 * 2026-11-06 sur 30 sociétés, BOAC (0,67), SAFC (0,68), SEMC (0,56), ORGT (1,18)
 * et ETIT (1,30) s'en écartent, sans qu'on sache encore pourquoi : un chiffre non
 * recoupé ne part pas. SNTS passe (1 000 000 000 de titres depuis le
 * fractionnement du 26/10/2026) : son BPA de 413,6 est juste.
 */
export function chiffresParAction(e: EntreeParAction): ChiffresParAction | null {
  const { resultatNet, bpa, titres, cours } = e;
  if (resultatNet == null || bpa == null || bpa === 0 || !titres || !cours) return null;
  const annee = Number(String(e.exercice ?? '').slice(0, 4));
  if (!annee || e.anneeSeance - annee > AGE_COMPTES_MAX) return null;
  if (Math.abs(resultatNet / titres / bpa - 1) > ECART_BPA_MAX) return null;
  const { per } = computeRatios({ cours, shares: titres, net_income: resultatNet, revenue: null, equity: null, debt: null, dividende: null });
  return {
    exercice: String(annee),
    bpa_fcfa: bpa,
    dividende_par_action_fcfa: e.dpa != null && e.dpa > 0 ? e.dpa : null,
    per: per != null && per > 0 ? Math.round(per * 10) / 10 : null,
    base_per: 'résultat net consolidé, intérêts minoritaires inclus',
  };
}
