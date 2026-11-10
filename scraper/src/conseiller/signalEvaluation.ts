import { bootstrapStationnaire, moyenne, quantile } from './stats.js';
import { ruptureDans, type EtatSignal, type Grille } from './signal.js';

/**
 * Évaluation du signal « tendance longue ». Module PUR. Paramètres figés par
 * docs/conseiller/PREREG-signal-tendance-longue.md.
 */
export const CONFIRMATION = {
  /** Seules les séances de signal STRICTEMENT postérieures à cette date comptent. */
  apres: '2026-11-10',
  /** Détention, en séances du calendrier ; entrée à la clôture de la séance suivant le signal. */
  horizon: 60,
  /** Une ligne écrite plus de 4 jours après sa séance n'est pas un signal d'époque : écartée. */
  retardMaxJours: 4,
  bootstrap: { blocMoyen: 120, tirages: 10_000, graine: 20261110 },
  /** Deux lectures seulement ; risque total ≤ 1 % + 4 % = 5 % (borne de Bonferroni). */
  etapes: [
    { nom: 'intermediaire', jusquau: '2031-11-10', alpha: 0.01 },
    { nom: 'finale', jusquau: '2036-11-10', alpha: 0.04 },
  ],
  /** Règle de retrait (non confirmatoire) : à partir de ce nombre de séances, écart moyen ≥ 0 = affichage suspendu. */
  retraitApresSeances: 750,
  seancesParAn: 250,
} as const;

/**
 * Rendement total entre les séances a et b du calendrier, cours reportés :
 * (cours_b + dividendes détachés dans ]a ; b]) / cours_a − 1. `null` si la valeur
 * n'est pas cotée en a, si une rupture non expliquée tombe dans ]a ; b], ou si un
 * dividende connu mais sans ex-date peut avoir détaché dans la fenêtre.
 */
export function rendementGrille(g: Grille, code: string, a: number, b: number): number | null {
  const c = g.colonnes.get(code);
  if (!c || a < c.premier || b >= g.calendrier.length || b <= a) return null;
  if (ruptureDans(c, a, b)) return null;
  const debut = g.calendrier[a]!;
  const fin = g.calendrier[b]!;
  for (const s of c.sansExDate) if (s.connuLe <= fin && debut <= s.au && fin >= s.du) return null;
  return (c.cours[b]! + c.dividendes[b]! - c.dividendes[a]!) / c.cours[a]! - 1;
}

export interface EtatValeur { etat: EtatSignal; eligible: boolean }
export interface EcartCohorte { date: string; ecart: number; n: number; univers: number }

/**
 * Pour chaque séance de signal t : moyenne des rendements des valeurs dans
 * l'état `etat` MOINS moyenne des rendements de toutes les valeurs éligibles,
 * de la clôture t+1 à la clôture t+1+horizon. Rendement total des deux côtés.
 * Une séance sans valeur dans l'état, ou dont la fenêtre n'est pas close, est sautée.
 */
export function ecartsCohortes(
  g: Grille,
  etatsA: (i: number) => Map<string, EtatValeur> | undefined,
  indices: number[],
  etat: EtatSignal,
  horizon: number = CONFIRMATION.horizon,
): EcartCohorte[] {
  const out: EcartCohorte[] = [];
  for (const i of indices) {
    const a = i + 1;
    const b = a + horizon;
    if (b >= g.calendrier.length) continue;
    const etats = etatsA(i);
    if (!etats) continue;
    let sS = 0, nS = 0, sU = 0, nU = 0;
    for (const [code, v] of etats) {
      if (!v.eligible) continue;
      const r = rendementGrille(g, code, a, b);
      if (r == null) continue;
      sU += r; nU++;
      if (v.etat === etat) { sS += r; nS++; }
    }
    if (nS === 0 || nU === 0) continue;
    out.push({ date: g.calendrier[i]!, ecart: sS / nS - sU / nU, n: nS, univers: nU });
  }
  return out;
}

/** t de la moyenne, variance de Newey-West (noyau de Bartlett). Descriptif. */
export function tNeweyWest(xs: number[], retard: number): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const m = moyenne(xs);
  const e = xs.map((x) => x - m);
  let g = e.reduce((s, x) => s + x * x, 0) / n;
  for (let l = 1; l <= Math.min(retard, n - 1); l++) {
    let c = 0;
    for (let k = l; k < n; k++) c += e[k]! * e[k - l]!;
    g += (2 * (1 - l / (retard + 1)) * c) / n;
  }
  return g > 0 ? m / Math.sqrt(g / n) : null;
}

export interface Resume {
  n: number;
  /** Écart moyen par cohorte (60 séances), en fraction. */
  moyenne: number | null;
  /** Même écart ramené à l'année (× 250 / horizon). */
  annualise: number | null;
  t: number | null;
  /** Part des séances où l'écart est négatif. */
  partNegative: number | null;
  parAnnee: { annee: string; n: number; moyenne: number }[];
}

export function resumer(ecarts: EcartCohorte[], horizon: number = CONFIRMATION.horizon): Resume {
  const xs = ecarts.map((e) => e.ecart);
  const annees = new Map<string, number[]>();
  for (const e of ecarts) { const a = e.date.slice(0, 4); annees.set(a, [...(annees.get(a) ?? []), e.ecart]); }
  const m = xs.length ? moyenne(xs) : null;
  return {
    n: xs.length,
    moyenne: m,
    annualise: m == null ? null : (m * CONFIRMATION.seancesParAn) / horizon,
    t: tNeweyWest(xs, 2 * horizon),
    partNegative: xs.length ? xs.filter((x) => x < 0).length / xs.length : null,
    parAnnee: [...annees].sort().map(([annee, v]) => ({ annee, n: v.length, moyenne: moyenne(v) })),
  };
}

export type VerdictConfirmation = 'confirme' | 'non_confirme' | 'descriptif';

export interface Lecture {
  /** Étape ouverte à la date des données, ou null (rapport descriptif seulement). */
  etape: (typeof CONFIRMATION.etapes)[number]['nom'] | null;
  verdict: VerdictConfirmation;
  /** Borne haute unilatérale de l'écart moyen au niveau de l'étape (ou à 95 % en descriptif). */
  borneHaute: number | null;
  retrait: boolean;
  resume: Resume;
}

/**
 * Lecture pré-enregistrée. `ecarts` : cohortes « À éviter » dont le signal est
 * postérieur à CONFIRMATION.apres. Une étape n'est lue que si la dernière
 * cohorte possible de l'étape est close (`derniereCohorteClose` ≥ sa date) ;
 * elle ne porte que sur les signaux antérieurs ou égaux à cette date.
 * Hypothèse : écart moyen < 0. Confirmé si la borne haute du bootstrap est < 0.
 */
export function lireConfirmation(ecarts: EcartCohorte[], derniereCohorteClose: string | null): Lecture {
  const tous = ecarts.filter((e) => e.date > CONFIRMATION.apres);
  const ouverte = derniereCohorteClose == null ? undefined : [...CONFIRMATION.etapes].reverse().find((e) => derniereCohorteClose >= e.jusquau);
  const retenus = ouverte ? tous.filter((e) => e.date <= ouverte.jusquau) : tous;
  const resume = resumer(retenus);
  const xs = retenus.map((e) => e.ecart);
  const boot = xs.length >= 2 ? bootstrapStationnaire(xs, CONFIRMATION.bootstrap) : [];
  const borneHaute = boot.length ? quantile(boot, 1 - (ouverte?.alpha ?? 0.05)) : null;
  const retrait = resume.n >= CONFIRMATION.retraitApresSeances && resume.moyenne != null && resume.moyenne >= 0;
  const verdict: VerdictConfirmation = !ouverte ? 'descriptif' : borneHaute != null && borneHaute < 0 ? 'confirme' : 'non_confirme';
  return { etape: ouverte?.nom ?? null, verdict, borneHaute, retrait, resume };
}
