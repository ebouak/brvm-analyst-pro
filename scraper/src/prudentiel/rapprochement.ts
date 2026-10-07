/**
 * Rapprochement des valeurs prudentielles publiées — module pur.
 *
 * Règle (2026-10-07) : deux observations d'un même indicateur, même émetteur,
 * même date, même périmètre et même unité se comparent à la précision publiée
 * la MOINS fine des deux. Compatible = la plus précise, arrondie à cette
 * précision, donne l'autre. Une troisième valeur plus grossière, compatible
 * avec deux valeurs contradictoires, ne les réconcilie pas : 16 % est
 * compatible avec 16,19 % et avec 16,3 %, mais 16,19 % et 16,3 % restent en
 * conflit.
 *
 * Calcul en décimal exact (entier × 10^-décimales) : une tolérance générale ou
 * un arrondi en virgule flottante (1,005 → 1,00) fausserait la comparaison.
 */

export interface ValeurPubliee {
  /** Valeur entière mise à l'échelle : 16,19 → 1619n avec decimales = 2. */
  entier: bigint;
  decimales: number;
}

/** Lit une valeur telle qu'imprimée : « 16,19 % », « 16 % », « 1 234,5 ». null si illisible. */
export function lireValeur(texte: string): ValeurPubliee | null {
  const t = texte.replace(/[\s  %]/g, '').replace(/[−–]/g, '-');
  const m = /^(-?)(\d+)(?:[.,](\d+))?$/.exec(t);
  if (!m) return null;
  const decimales = (m[3] ?? '').length;
  if (decimales > 6) return null;
  const entier = BigInt(`${m[1]}${m[2]}${m[3] ?? ''}`);
  return { entier, decimales };
}

/** Arrondit à `d` décimales, demi-unité arrondie en s'éloignant de zéro (convention usuelle des publications). */
export function arrondir(v: ValeurPubliee, d: number): ValeurPubliee {
  if (d >= v.decimales) return { entier: v.entier * 10n ** BigInt(d - v.decimales), decimales: d };
  const div = 10n ** BigInt(v.decimales - d);
  const neg = v.entier < 0n;
  const abs = neg ? -v.entier : v.entier;
  const q = abs / div;
  const reste = abs % div;
  const arrondi = reste * 2n >= div ? q + 1n : q;
  return { entier: neg ? -arrondi : arrondi, decimales: d };
}

/** Deux valeurs concordent-elles à la précision la moins fine des deux ? */
export function compatibles(a: ValeurPubliee, b: ValeurPubliee): boolean {
  const d = Math.min(a.decimales, b.decimales);
  return arrondir(a, d).entier === arrondir(b, d).entier;
}

export interface Observation {
  id: string;
  texte: string;
}

export type Classe = 'unique' | 'rounding_compatible' | 'source_conflict' | 'illisible';

export interface Rapprochement {
  classe: Classe;
  /** Observation retenue (la plus précise) ; null en cas de conflit ou d'illisibilité. */
  retenue: string | null;
  /** Paires incompatibles, pour la piste d'audit. */
  conflits: [string, string][];
}

/**
 * Classe un groupe d'observations DÉJÀ homogènes (même émetteur, indicateur,
 * date, périmètre, unité — voir `cleRapprochement`). Toutes les paires sont
 * testées : un conflit entre deux valeurs précises suffit, quelle que soit la
 * valeur grossière qui les accompagne.
 */
export function rapprocher(obs: Observation[]): Rapprochement {
  const lues = obs.map((o) => ({ o, v: lireValeur(o.texte) }));
  if (lues.some((x) => x.v == null)) return { classe: 'illisible', retenue: null, conflits: [] };
  const vals = lues as { o: Observation; v: ValeurPubliee }[];
  if (vals.length === 1) return { classe: 'unique', retenue: vals[0]!.o.id, conflits: [] };

  const conflits: [string, string][] = [];
  for (let i = 0; i < vals.length; i++) {
    for (let j = i + 1; j < vals.length; j++) {
      if (!compatibles(vals[i]!.v, vals[j]!.v)) conflits.push([vals[i]!.o.id, vals[j]!.o.id]);
    }
  }
  if (conflits.length) return { classe: 'source_conflict', retenue: null, conflits };
  const plusPrecise = [...vals].sort((a, b) => b.v.decimales - a.v.decimales)[0]!;
  return { classe: 'rounding_compatible', retenue: plusPrecise.o.id, conflits: [] };
}

/** Clé d'homogénéité : seules des observations de même clé se comparent. */
export function cleRapprochement(o: {
  code: string; indicateur: string; date_arrete: string | null; perimetre: string; unite: string | null;
}): string {
  return [o.code, o.indicateur, o.date_arrete ?? '?', o.perimetre, o.unite ?? '?'].join('|');
}
