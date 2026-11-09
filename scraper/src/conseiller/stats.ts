/** Statistiques pures du banc v2 (spec §2). Aucune I/O. */

/** mulberry32 : générateur reproductible. */
export function prng(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MIN_VALEURS_RANG = 5;

/**
 * Rang transversal → [−1, +1]. `sens = 1` : plus haut = +1. Ex æquo : rang moyen.
 * Moins de 5 valeurs non nulles : tout est null (un rang sur 4 valeurs ne veut rien dire).
 */
export function rangTransversal(valeurs: Map<string, number | null>, sens: 1 | -1): Map<string, number | null> {
  const presentes = [...valeurs].filter((e): e is [string, number] => e[1] != null && Number.isFinite(e[1]));
  const out = new Map<string, number | null>();
  for (const k of valeurs.keys()) out.set(k, null);
  if (presentes.length < MIN_VALEURS_RANG) return out;
  presentes.sort((a, b) => a[1] - b[1]);
  const n = presentes.length;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && presentes[j + 1]![1] === presentes[i]![1]) j++;
    const rangMoyen = (i + j) / 2;
    const score = (2 * rangMoyen) / (n - 1) - 1;
    for (let k = i; k <= j; k++) out.set(presentes[k]![0], sens * score);
    i = j + 1;
  }
  return out;
}

export const moyenne = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function ecartType(xs: number[]): number {
  const m = moyenne(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Quantile d'un tableau TRIÉ. */
export function quantile(trie: number[], q: number): number {
  const i = Math.min(trie.length - 1, Math.max(0, Math.floor(q * trie.length)));
  return trie[i]!;
}

/**
 * Bootstrap stationnaire (Politis-Romano) de la moyenne. Renvoie les moyennes
 * TRIÉES. Blocs de longueur géométrique de moyenne `blocMoyen`, enroulés.
 */
export function bootstrapStationnaire(
  xs: number[],
  opts: { blocMoyen: number; tirages: number; graine: number },
): number[] {
  const n = xs.length;
  const alea = prng(opts.graine);
  const p = 1 / opts.blocMoyen;
  const moyennes: number[] = [];
  for (let t = 0; t < opts.tirages; t++) {
    let s = 0;
    let i = Math.floor(alea() * n);
    for (let k = 0; k < n; k++) {
      s += xs[i]!;
      i = alea() < p ? Math.floor(alea() * n) : (i + 1) % n;
    }
    moyennes.push(s / n);
  }
  return moyennes.sort((a, b) => a - b);
}

/** Bootstrap i.i.d. (cas regroupés) : sert seulement à mesurer la sur-confiance. */
export function bootstrapIid(xs: number[], tirages: number, graine: number): number[] {
  return bootstrapStationnaire(xs, { blocMoyen: 1, tirages, graine });
}

/** Test de signe unilatéral : P(X ≥ positifs) sous p = 0,5. Les zéros sont écartés. */
export function testSigne(xs: number[]): { positifs: number; n: number; p: number } {
  const nonNuls = xs.filter((x) => x !== 0);
  const n = nonNuls.length;
  const positifs = nonNuls.filter((x) => x > 0).length;
  let p = 0;
  let c = 1; // C(n, 0)
  for (let k = 0; k <= n; k++) {
    if (k >= positifs) p += c;
    c = (c * (n - k)) / (k + 1);
  }
  return { positifs, n, p: p / 2 ** n };
}

const Z_95_UNILATERAL = 1.6449;
const Z_PUISSANCE_80 = 0.8416;
export const PERIODES_PAR_AN = 252 / 20;

/** Effet minimal détectable (unilatéral 5 %, puissance 80 %), par période de 20 séances et annualisé. */
export function effetMinimalDetectable(ecartTypeParDate: number, nDates: number): { parPeriode: number; annualise: number } {
  const parPeriode = ((Z_95_UNILATERAL + Z_PUISSANCE_80) * ecartTypeParDate) / Math.sqrt(nDates);
  return { parPeriode, annualise: parPeriode * PERIODES_PAR_AN };
}
