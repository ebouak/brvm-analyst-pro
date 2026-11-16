/**
 * Affichage de l'indice de nervosité BRVM-V. PUR : aucune lecture de base.
 *
 * Les lignes viennent de `brvm_nervosite_daily`, écrites par le scraper
 * (`scraper/src/nervosite/`) avec le module `./nervosite.ts`. Rien ici ne
 * recalcule l'indice : on met en forme ce que la table contient, et une
 * donnée absente reste absente.
 */
import type { Regime } from './nervosite';

export interface LigneNervosite {
  date_marche: string;
  valeur: number | null;
  rapide: number | null;
  lente: number | null;
  rang: number | null;
  regime: Regime | null;
  n_titres: number;
}

export const LIBELLE_REGIME: Record<Regime, string> = {
  calme: 'Calme',
  normal: 'Normal',
  agité: 'Agité',
  tendu: 'Tendu',
};

/** Bornes de rang de chaque régime, reprises de `regime()` (nervosite.ts). */
export const BORNES_REGIME: Record<Regime, string> = {
  calme: 'rang inférieur à 25',
  normal: 'rang de 25 à 75',
  agité: 'rang de 75 à 90',
  tendu: 'rang de 90 et plus',
};

/** Classe de couleur du régime (jetons du design system, pas de verdict d'achat). */
export const TON_REGIME: Record<Regime, string> = {
  calme: 'border-border-strong bg-elevated text-muted',
  normal: 'border-accent/30 bg-accent/10 text-accent-ink',
  agité: 'border-warn/30 bg-warn/10 text-warn',
  tendu: 'border-down/30 bg-down/5 text-down',
};

const nombre = (x: unknown): number | null => {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

const REGIMES = new Set<string>(['calme', 'normal', 'agité', 'tendu']);

/** Normalise une ligne PostgREST (les `numeric` arrivent parfois en chaîne). */
export function versLigne(r: Record<string, unknown>): LigneNervosite {
  const regime = typeof r.regime === 'string' && REGIMES.has(r.regime) ? (r.regime as Regime) : null;
  const rang = nombre(r.rang);
  return {
    date_marche: String(r.date_marche).slice(0, 10),
    valeur: nombre(r.valeur),
    rapide: nombre(r.rapide),
    lente: nombre(r.lente),
    // Un régime sans rang (ou l'inverse) serait incohérent : les deux tombent ensemble.
    rang: regime === null ? null : rang,
    regime: rang === null ? null : regime,
    n_titres: nombre(r.n_titres) ?? 0,
  };
}

/** Phrase de rang, dérivée du seul chiffre stocké. */
export function phraseRang(rang: number, depuis: string): string {
  const annee = depuis.slice(0, 4);
  return `Au niveau ou au-dessus de ${Math.round(rang)} % des valeurs observées depuis ${annee}, ce jour compris.`;
}

/** Format « 12,3 % » d'une valeur annualisée. */
export function fmtNervosite(v: number): string {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/**
 * Une ligne par semaine (la dernière séance de chaque semaine, du lundi au dimanche), plus la
 * toute dernière séance : la courbe longue reste légère sans inventer de
 * point. Les lignes sans valeur sont écartées.
 */
export function echantillonHebdo(lignes: readonly LigneNervosite[]): LigneNervosite[] {
  const avecValeur = lignes.filter((l) => l.valeur !== null);
  const out: LigneNervosite[] = [];
  let semainePrec: string | null = null;
  for (const l of avecValeur) {
    const s = semaineIso(l.date_marche);
    if (s === semainePrec) out[out.length - 1] = l;
    else out.push(l);
    semainePrec = s;
  }
  return out;
}

/** Lundi de la semaine de la séance, comme clé de regroupement. */
function semaineIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Bornes min/max d'une série (lignes sans valeur ignorées), `null` si vide. */
export function etendue(lignes: readonly LigneNervosite[], cles: ('valeur' | 'rapide' | 'lente')[] = ['valeur']): { min: number; max: number } | null {
  let min = Infinity, max = -Infinity;
  for (const l of lignes) for (const k of cles) {
    const v = l[k];
    if (v === null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return Number.isFinite(min) ? { min, max } : null;
}

export interface SyntheseSerie {
  /** Première séance dotée d'une valeur. */
  debut: string;
  derniere: LigneNervosite;
  plusHaut: { valeur: number; date: string };
  plusBas: { valeur: number; date: string };
  /** Plus petit nombre de titres entrant dans une moyenne de séance. */
  minTitres: number;
  /** Séances classées dans chaque régime (rang disponible). */
  parRegime: Record<Regime, number>;
  seancesAvecValeur: number;
}

/** Faits de la série, tous lus dans les lignes ; `null` si aucune valeur. */
export function syntheseSerie(lignes: readonly LigneNervosite[]): SyntheseSerie | null {
  const avec = lignes.filter((l): l is LigneNervosite & { valeur: number } => l.valeur !== null);
  if (avec.length === 0) return null;
  let haut = avec[0]!, bas = avec[0]!;
  const parRegime: Record<Regime, number> = { calme: 0, normal: 0, agité: 0, tendu: 0 };
  let minTitres = Infinity;
  for (const l of avec) {
    if (l.valeur > haut.valeur) haut = l;
    if (l.valeur < bas.valeur) bas = l;
    if (l.regime) parRegime[l.regime]++;
    if (l.n_titres < minTitres) minTitres = l.n_titres;
  }
  return {
    debut: avec[0]!.date_marche,
    derniere: lignes.at(-1)!,
    plusHaut: { valeur: haut.valeur, date: haut.date_marche },
    plusBas: { valeur: bas.valeur, date: bas.date_marche },
    minTitres,
    parRegime,
    seancesAvecValeur: avec.length,
  };
}
