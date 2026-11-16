// Graphique avancé : séances, agrégation par intervalle, périodes.
//
// Fonctions PURES, sans accès réseau : elles reçoivent des lignes de
// `brvm_actions_daily` et produisent les barres affichées et exportées.
//
// Règle d'honnêteté : une barre n'a d'ouverture / plus haut / plus bas que si
// TOUTES ses séances les portent et qu'ils sont cohérents. Sinon ces champs
// restent `null` et la barre n'est dessinée qu'en clôture — jamais de mèche
// fabriquée à partir de la clôture.

export type Intervalle = 'jour' | 'semaine' | 'mois';
export type Periode = '1M' | '3M' | '6M' | '1A' | '3A' | '5A' | '10A' | 'MAX';

export const PERIODES: { cle: Periode; libelle: string; mois: number | null }[] = [
  { cle: '1M', libelle: '1M', mois: 1 },
  { cle: '3M', libelle: '3M', mois: 3 },
  { cle: '6M', libelle: '6M', mois: 6 },
  { cle: '1A', libelle: '1A', mois: 12 },
  { cle: '3A', libelle: '3A', mois: 36 },
  { cle: '5A', libelle: '5A', mois: 60 },
  { cle: '10A', libelle: '10A', mois: 120 },
  { cle: 'MAX', libelle: 'Max', mois: null },
];

export const INTERVALLES: { cle: Intervalle; libelle: string }[] = [
  { cle: 'jour', libelle: 'Jour' },
  { cle: 'semaine', libelle: 'Semaine' },
  { cle: 'mois', libelle: 'Mois' },
];

/** Ligne brute telle que lue dans `brvm_actions_daily`. */
export interface LigneCours {
  date_marche: string;
  cours_jour: number | string | null;
  ouverture?: number | string | null;
  plus_haut?: number | string | null;
  plus_bas?: number | string | null;
  variation_pct?: number | string | null;
  volume?: number | string | null;
  valeur_echangee?: number | string | null;
}

/** Une séance validée. `cloture` est toujours un prix strictement positif. */
export interface Seance {
  date: string; // AAAA-MM-JJ
  ouverture: number | null;
  haut: number | null;
  bas: number | null;
  cloture: number;
  variationPct: number | null; // publiée en base (séance)
  volume: number | null;
  valeur: number | null;
}

/** Une barre affichée (séance, semaine ou mois). `date` = dernière séance. */
export interface Barre {
  date: string;
  debut: string; // première séance de la barre
  ouverture: number | null;
  haut: number | null;
  bas: number | null;
  cloture: number;
  variationPct: number | null;
  volume: number | null;
  valeur: number | null;
  nbSeances: number;
}

function nombre(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Un prix nul ou négatif est un trou de collecte, pas un cours. */
function prix(v: unknown): number | null {
  const n = nombre(v);
  return n != null && n > 0 ? n : null;
}

/**
 * Valide les lignes : écarte les séances sans clôture, trie par date,
 * dédoublonne (la dernière ligne d'une date l'emporte), et ne garde
 * l'OHLC que s'il est complet ET cohérent (bas ≤ min(o,c) ≤ max(o,c) ≤ haut).
 */
export function normaliserSeances(lignes: readonly LigneCours[]): Seance[] {
  const parDate = new Map<string, Seance>();
  for (const l of lignes) {
    const date = String(l.date_marche ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const cloture = prix(l.cours_jour);
    if (cloture == null) continue;
    let o = prix(l.ouverture);
    let h = prix(l.plus_haut);
    let b = prix(l.plus_bas);
    const complet = o != null && h != null && b != null;
    const coherent =
      complet && b! <= Math.min(o!, cloture) && Math.max(o!, cloture) <= h! && b! <= h!;
    if (!coherent) {
      o = null;
      h = null;
      b = null;
    }
    const volume = nombre(l.volume);
    const valeur = nombre(l.valeur_echangee);
    parDate.set(date, {
      date,
      ouverture: o,
      haut: h,
      bas: b,
      cloture,
      variationPct: nombre(l.variation_pct),
      volume: volume != null && volume >= 0 ? volume : null,
      valeur: valeur != null && valeur >= 0 ? valeur : null,
    });
  }
  return [...parDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Clé de regroupement : semaine ISO (lundi) ou mois calendaire. */
export function cleIntervalle(date: string, intervalle: Intervalle): string {
  if (intervalle === 'jour') return date;
  if (intervalle === 'mois') return date.slice(0, 7);
  const d = new Date(`${date}T00:00:00Z`);
  const jour = d.getUTCDay() || 7; // lundi = 1 … dimanche = 7
  d.setUTCDate(d.getUTCDate() - jour + 1);
  return d.toISOString().slice(0, 10);
}

function somme(valeurs: (number | null)[]): number | null {
  if (valeurs.length === 0 || valeurs.some((v) => v == null)) return null;
  return (valeurs as number[]).reduce((a, b) => a + b, 0);
}

/**
 * Agrège les séances en barres de l'intervalle demandé.
 * - jour : une barre par séance, variation = celle publiée en base ;
 * - semaine / mois : ouverture de la première séance, plus haut / plus bas
 *   extrêmes, clôture de la dernière ; variation calculée de clôture à
 *   clôture (barre précédente) ; volume et valeur sommés seulement si chaque
 *   séance les porte (sinon `null`, jamais une somme partielle).
 */
export function agreger(seances: readonly Seance[], intervalle: Intervalle): Barre[] {
  if (intervalle === 'jour') {
    return seances.map((s) => ({
      date: s.date,
      debut: s.date,
      ouverture: s.ouverture,
      haut: s.haut,
      bas: s.bas,
      cloture: s.cloture,
      variationPct: s.variationPct,
      volume: s.volume,
      valeur: s.valeur,
      nbSeances: 1,
    }));
  }
  const groupes: Seance[][] = [];
  let cle: string | null = null;
  for (const s of seances) {
    const k = cleIntervalle(s.date, intervalle);
    if (k !== cle) {
      groupes.push([]);
      cle = k;
    }
    groupes[groupes.length - 1]!.push(s);
  }
  const barres: Barre[] = [];
  for (const g of groupes) {
    const premiere = g[0]!;
    const derniere = g[g.length - 1]!;
    const ohlcComplet = g.every((s) => s.ouverture != null && s.haut != null && s.bas != null);
    const prec = barres[barres.length - 1];
    barres.push({
      date: derniere.date,
      debut: premiere.date,
      ouverture: ohlcComplet ? premiere.ouverture : null,
      haut: ohlcComplet ? Math.max(...g.map((s) => s.haut!)) : null,
      bas: ohlcComplet ? Math.min(...g.map((s) => s.bas!)) : null,
      cloture: derniere.cloture,
      variationPct: prec ? ((derniere.cloture - prec.cloture) / prec.cloture) * 100 : null,
      volume: somme(g.map((s) => s.volume)),
      valeur: somme(g.map((s) => s.valeur)),
      nbSeances: g.length,
    });
  }
  return barres;
}

/** Barre dessinable en chandelier (OHLC complet). */
export function aOhlc(b: Pick<Barre, 'ouverture' | 'haut' | 'bas'>): boolean {
  return b.ouverture != null && b.haut != null && b.bas != null;
}

/** Part des barres portant un OHLC complet (0 à 1). */
export function partOhlc(barres: readonly Barre[]): number {
  if (barres.length === 0) return 0;
  return barres.filter(aOhlc).length / barres.length;
}

/** Date de début d'une période, comptée depuis la dernière séance. `null` = tout. */
export function debutPeriode(derniereDate: string, periode: Periode): string | null {
  const def = PERIODES.find((p) => p.cle === periode);
  if (!def || def.mois == null) return null;
  const d = new Date(`${derniereDate}T00:00:00Z`);
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - def.mois);
  const dernierJourDuMois = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernierJourDuMois));
  return d.toISOString().slice(0, 10);
}

/**
 * Une période est « couverte » si l'historique remonte au moins jusqu'à son
 * début. Sinon le bouton est désactivé : afficher « 10A » sur quatre ans
 * d'historique ferait croire à une profondeur qui n'existe pas.
 */
export function periodeCouverte(premiereDate: string, derniereDate: string, periode: Periode): boolean {
  const debut = debutPeriode(derniereDate, periode);
  return debut == null || premiereDate <= debut;
}

/** Indices [debut, fin] (inclus) des barres d'une période ; `null` si vide. */
export function bornesPeriode(barres: readonly Barre[], periode: Periode): [number, number] | null {
  if (barres.length === 0) return null;
  const fin = barres.length - 1;
  const debut = debutPeriode(barres[fin]!.date, periode);
  if (debut == null) return [0, fin];
  const i = barres.findIndex((b) => b.date >= debut);
  return i < 0 ? [fin, fin] : [i, fin];
}

export interface VariationPeriode {
  debut: string;
  fin: string;
  coursDebut: number;
  coursFin: number;
  ecart: number;
  ecartPct: number;
}

/** Variation de clôture à clôture entre la première et la dernière barre visibles. */
export function variationPeriode(barres: readonly Barre[], i0: number, i1: number): VariationPeriode | null {
  const a = Math.max(0, Math.min(i0, i1));
  const b = Math.min(barres.length - 1, Math.max(i0, i1));
  if (barres.length === 0 || a >= b) return null;
  const x = barres[a]!;
  const y = barres[b]!;
  return {
    debut: x.date,
    fin: y.date,
    coursDebut: x.cloture,
    coursFin: y.cloture,
    ecart: y.cloture - x.cloture,
    ecartPct: ((y.cloture - x.cloture) / x.cloture) * 100,
  };
}
