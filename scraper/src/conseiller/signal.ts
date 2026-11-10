import { rangTransversal } from './stats.js';
import type { Donnees } from './types.js';

/**
 * Signal « tendance longue » du Conseiller Premium. Module PUR, aucune I/O.
 * Règle figée par docs/conseiller/PREREG-signal-tendance-longue.md : ne rien
 * changer ici sans changer SIGNAL_VERSION et rouvrir le protocole.
 *
 * Toutes les fenêtres se comptent en séances du CALENDRIER du marché, cours
 * reportés les jours sans échange. Les familles de facteurs existantes
 * (facteurs.ts) ne sont pas touchées.
 */
export const SIGNAL = {
  /** Fenêtres de performance, en séances du calendrier. */
  fenetres: [120, 250] as const,
  /** Ancienneté minimale de cotation, en séances du calendrier. */
  ancienneteMin: 250,
  /** Part minimale de séances échangées, sur 60 séances (éligibilité) et sur chaque fenêtre. */
  fenetrePresence: 60,
  presenceMin: 0.6,
  /** Bornes des états sur le score [−1, +1]. */
  seuil: 1 / 3,
  /** Moins de 6 valeurs classées : pas de rang. */
  effectifMin: 6,
} as const;

export const SIGNAL_VERSION = 'tendance-longue-v1-2026-11-10';

export type EtatSignal = 'a_eviter' | 'favorable' | 'neutre' | 'pas_de_signal';

/** Une valeur sur la grille du calendrier. Les cumuls sont inclusifs (jusqu'à i compris). */
export interface ColonneGrille {
  /** Indice de la première cotation ; avant, `cours` vaut NaN. */
  premier: number;
  /** Cours reporté : dernier cours connu à la séance i. */
  cours: Float64Array;
  /** Nombre cumulé de séances échangées. */
  echangees: Int32Array;
  /** Nombre cumulé de ruptures non expliquées. */
  ruptures: Int32Array;
  /** Dividendes cumulés détachés (ex-date connue), en FCFA par action. */
  dividendes: Float64Array;
  /** Dividendes sans ex-date : fenêtre de détachement possible et date de connaissance. */
  sansExDate: { du: string; au: string; connuLe: string }[];
}

export interface Grille {
  calendrier: string[];
  colonnes: Map<string, ColonneGrille>;
}

/** Projette les séries (une ligne par séance échangée) sur le calendrier du marché. */
export function construireGrille(d: Donnees): Grille {
  const cal = d.calendrier;
  const n = cal.length;
  const index = new Map(cal.map((x, i) => [x, i]));
  /** Première séance du calendrier de date ≥ `date`, ou n. */
  const premiereSeanceDepuis = (date: string) => {
    let a = 0, b = n;
    while (a < b) { const m = (a + b) >> 1; if (cal[m]! < date) a = m + 1; else b = m; }
    return a;
  };
  const colonnes = new Map<string, ColonneGrille>();
  for (const [code, s] of d.series) {
    if (s.dates.length === 0) continue;
    const cours = new Float64Array(n).fill(NaN);
    const echangee = new Uint8Array(n);
    const rupture = new Uint8Array(n);
    const detache = new Float64Array(n);
    let premier = n;
    for (let k = 0; k < s.dates.length; k++) {
      const i = index.get(s.dates[k]!);
      if (i == null || !(s.cours[k]! > 0)) continue;
      cours[i] = s.cours[k]!;
      if (s.volumes[k]! > 0) echangee[i] = 1;
      if (i < premier) premier = i;
    }
    if (premier === n) continue;
    for (const r of d.ruptures.get(code) ?? []) { const i = index.get(r); if (i != null) rupture[i] = 1; }
    const sansExDate: ColonneGrille['sansExDate'] = [];
    for (const dv of d.dividendes) {
      if (dv.code !== code || !(dv.montant > 0)) continue;
      if (dv.exDate == null) {
        sansExDate.push({ du: `${dv.exercice + 1}-05-01`, au: `${dv.exercice + 1}-08-31`, connuLe: dv.disponibleLe });
        continue;
      }
      const i = premiereSeanceDepuis(dv.exDate);
      if (i < n) detache[i]! += dv.montant;
    }
    const col: ColonneGrille = { premier, cours, echangees: new Int32Array(n), ruptures: new Int32Array(n), dividendes: new Float64Array(n), sansExDate };
    let e = 0, r = 0, dv = 0;
    for (let i = 0; i < n; i++) {
      if (i > premier && Number.isNaN(cours[i]!)) cours[i] = cours[i - 1]!;
      e += echangee[i]!; r += rupture[i]!; dv += detache[i]!;
      col.echangees[i] = e; col.ruptures[i] = r; col.dividendes[i] = dv;
    }
    colonnes.set(code, col);
  }
  return { calendrier: cal, colonnes };
}

/** Part de séances échangées sur les `l` séances finissant à i ; null si le calendrier est trop court. */
export function presence(c: ColonneGrille, i: number, l: number): number | null {
  if (i < l - 1) return null;
  return (c.echangees[i]! - (i - l >= 0 ? c.echangees[i - l]! : 0)) / l;
}

/** Une rupture non expliquée tombe-t-elle dans ]a ; b] ? */
export const ruptureDans = (c: ColonneGrille, a: number, b: number) => c.ruptures[b]! - c.ruptures[a]! > 0;

/**
 * Performance de cours sur `l` séances du calendrier finissant à i. `null` si la
 * valeur n'était pas cotée à i − l, si une rupture tombe dans la fenêtre ou si
 * moins de 60 % des séances de la fenêtre ont été échangées.
 */
export function performance(c: ColonneGrille, i: number, l: number): number | null {
  const a = i - l;
  if (a < c.premier) return null;
  if (ruptureDans(c, a, i)) return null;
  const p = presence(c, i, l);
  if (p == null || p < SIGNAL.presenceMin) return null;
  return c.cours[i]! / c.cours[a]! - 1;
}

/** Cotée depuis 250 séances au moins et échangée 60 % au moins des 60 dernières. */
export function eligible(c: ColonneGrille, i: number): boolean {
  if (i < c.premier || i - c.premier + 1 < SIGNAL.ancienneteMin) return false;
  const p = presence(c, i, SIGNAL.fenetrePresence);
  return p != null && p >= SIGNAL.presenceMin;
}

/** Score [−1, +1] → état. Une valeur non éligible ou sans score n'a pas de signal. */
export function etatDe(score: number | null, estEligible: boolean): EtatSignal {
  if (!estEligible || score == null) return 'pas_de_signal';
  if (score <= -SIGNAL.seuil) return 'a_eviter';
  if (score >= SIGNAL.seuil) return 'favorable';
  return 'neutre';
}

export interface SignalValeur {
  etat: EtatSignal;
  /** Moyenne des rangs disponibles, ou null. */
  score: number | null;
  eligible: boolean;
  perf120: number | null;
  perf250: number | null;
  rang120: number | null;
  rang250: number | null;
  presence60: number | null;
}

/**
 * Signal de toutes les valeurs cotées à la séance d'indice i, avec les seules
 * données antérieures ou égales à cette séance. Une valeur sans aucun échange
 * sur 250 séances est tenue pour sortie de la cote et n'a pas de ligne.
 */
export function signauxSeance(g: Grille, i: number): Map<string, SignalValeur> {
  const [l1, l2] = SIGNAL.fenetres;
  const base = new Map<string, { el: boolean; p1: number | null; p2: number | null; pr: number | null }>();
  for (const [code, c] of [...g.colonnes].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (i < c.premier) continue;
    const recul = Math.max(c.premier - 1, i - SIGNAL.ancienneteMin);
    if (c.echangees[i]! - (recul >= 0 ? c.echangees[recul]! : 0) === 0) continue;
    const el = eligible(c, i);
    base.set(code, { el, p1: el ? performance(c, i, l1) : null, p2: el ? performance(c, i, l2) : null, pr: presence(c, i, SIGNAL.fenetrePresence) });
  }
  const rang = (cle: 'p1' | 'p2') => {
    const m = new Map([...base].map(([k, v]) => [k, v[cle]] as [string, number | null]));
    const classees = [...m.values()].filter((x) => x != null).length;
    return classees >= SIGNAL.effectifMin ? rangTransversal(m, 1) : new Map<string, number | null>();
  };
  const r1 = rang('p1');
  const r2 = rang('p2');
  const out = new Map<string, SignalValeur>();
  for (const [code, b] of base) {
    const rangs = [r1.get(code) ?? null, r2.get(code) ?? null].filter((x): x is number => x != null);
    const score = rangs.length ? rangs.reduce((s, x) => s + x, 0) / rangs.length : null;
    out.set(code, { etat: etatDe(score, b.el), score, eligible: b.el, perf120: b.p1, perf250: b.p2, rang120: r1.get(code) ?? null, rang250: r2.get(code) ?? null, presence60: b.pr });
  }
  return out;
}

/** Révision mensuelle : première séance du mois civil. */
export function estRevision(calendrier: string[], i: number): boolean {
  return i === 0 || calendrier[i]!.slice(0, 7) !== calendrier[i - 1]!.slice(0, 7);
}

export interface LigneSignal {
  date_marche: string;
  code: string;
  etat: EtatSignal;
  score: number | null;
  eligible: boolean;
  perf_120: number | null;
  perf_250: number | null;
  rang_120: number | null;
  rang_250: number | null;
  presence_60: number | null;
  /** Nombre de valeurs éligibles ce jour-là. */
  effectif: number;
  revision: boolean;
  moteur_version: string;
}

export function lignesSignaux(g: Grille, i: number): LigneSignal[] {
  const s = signauxSeance(g, i);
  const effectif = [...s.values()].filter((v) => v.eligible).length;
  const revision = estRevision(g.calendrier, i);
  return [...s].map(([code, v]) => ({
    date_marche: g.calendrier[i]!, code, etat: v.etat, score: v.score, eligible: v.eligible,
    perf_120: v.perf120, perf_250: v.perf250, rang_120: v.rang120, rang_250: v.rang250, presence_60: v.presence60,
    effectif, revision, moteur_version: SIGNAL_VERSION,
  }));
}

/** Sous ce nombre de valeurs éligibles, la collecte du jour est tenue pour défaillante. */
export const ELIGIBLES_MIN = 20;

/** Contrôle d'un lot (calculé, ou relu en base). Renvoie la liste des anomalies ; vide = conforme. */
export function verifierSignaux(lignes: LigneSignal[], derniereSeance: string): string[] {
  const erreurs: string[] = [];
  if (lignes.some((l) => l.date_marche !== derniereSeance)) erreurs.push(`séance écrite différente de la dernière séance (${derniereSeance})`);
  if (new Set(lignes.map((l) => l.code)).size !== lignes.length) erreurs.push('codes en double');
  const eligibles = lignes.filter((l) => l.eligible).length;
  if (eligibles < ELIGIBLES_MIN) erreurs.push(`${eligibles} valeurs éligibles seulement (minimum ${ELIGIBLES_MIN})`);
  if (lignes.some((l) => l.effectif !== eligibles)) erreurs.push('effectif incohérent avec le nombre de valeurs éligibles');
  const incoherentes = lignes.filter((l) => l.etat !== etatDe(l.score == null ? null : Number(l.score), l.eligible)).map((l) => l.code);
  if (incoherentes.length) erreurs.push(`état incohérent avec le score : ${incoherentes.join(', ')}`);
  if (lignes.some((l) => l.score != null && Math.abs(Number(l.score)) > 1 + 1e-9)) erreurs.push('score hors de [−1 ; +1]');
  for (const e of ['a_eviter', 'favorable'] as const) if (!lignes.some((l) => l.etat === e)) erreurs.push(`aucune valeur dans l'état ${e}`);
  if (lignes.some((l) => l.moteur_version !== SIGNAL_VERSION)) erreurs.push('version de moteur inattendue');
  return erreurs;
}
