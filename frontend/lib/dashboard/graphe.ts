/** Géométrie des graphes du tableau de bord (spec §12). PUR, une seule échelle par graphe. */
const fini = (x: number) => Number.isFinite(x);

export function echelle(valeurs: number[], pas = 4): { bas: number; haut: number; graduations: number[] } | null {
  const v = valeurs.filter(fini);
  if (v.length === 0) return null;
  let bas = Math.min(...v), haut = Math.max(...v);
  const marge = (haut - bas) * 0.15 || 1;
  bas -= marge; haut += marge;
  return { bas, haut, graduations: Array.from({ length: pas + 1 }, (_, k) => bas + ((haut - bas) / pas) * k) };
}

/** Polyligne d'une sparkline dans un cadre l × h (marge intérieure `m`). */
export function cheminSparkline(serie: number[], l: number, h: number, m = 3):
  { points: string; dernier: [number, number]; hausse: boolean } | null {
  if (serie.length < 2 || !serie.every(fini)) return null;
  const lo = Math.min(...serie), hi = Math.max(...serie), e = hi - lo || 1;
  const pts = serie.map((v, i): [number, number] => [(i / (serie.length - 1)) * (l - 2 * m) + m, (1 - (v - lo) / e) * (h - 2 * m) + m]);
  return {
    points: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    dernier: pts[pts.length - 1]!,
    hausse: serie[serie.length - 1]! >= serie[0]!,
  };
}

/** Indice du minimum s'il n'est ni le premier ni le dernier point (point bas à annoter). */
export function indexMinInterieur(valeurs: number[]): number | null {
  if (valeurs.length < 3) return null;
  const i = valeurs.indexOf(Math.min(...valeurs));
  return i > 0 && i < valeurs.length - 1 ? i : null;
}

/** Barres autour de zéro : `largeur` en % de la demi-jauge (0..50). */
export function barresDivergentes<K extends string>(vals: { cle: K; v: number }[]):
  { cle: K; v: number; largeur: number; sens: 'up' | 'down' | 'flat' }[] {
  const max = Math.max(0.5, ...vals.filter((x) => fini(x.v)).map((x) => Math.abs(x.v)));
  return vals.map((x) => ({
    cle: x.cle, v: x.v,
    largeur: fini(x.v) ? (Math.abs(x.v) / max) * 50 : 0,
    sens: !fini(x.v) || x.v === 0 ? 'flat' : x.v > 0 ? 'up' : 'down',
  }));
}
