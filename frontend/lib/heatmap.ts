export interface HeatmapNode {
  code: string;
  designation: string | null;
  secteur: string | null;
  valeur_echangee: number | null;
  variation_pct: number | null;
  cours_jour: number | null;
  volume: number | null;
  /** Capitalisation boursière (shares × cours), si connue. Sert au dimensionnement. */
  capitalisation?: number | null;
}

export interface SectorGroup {
  name: string;
  children: HeatmapNode[];
  totalValeur: number;
  totalWeight: number;
}

/**
 * Poids d'un nœud pour le dimensionnement du treemap : on privilégie la
 * capitalisation boursière (comme TradingView « market_cap »), à défaut la
 * valeur échangée, à défaut 1 (jamais 0, sinon la tuile disparaît). Aucune
 * valeur inventée : un nœud sans capitalisation retombe simplement sur la
 * valeur échangée réelle.
 */
export function nodeWeight(n: HeatmapNode): number {
  const cap = n.capitalisation;
  if (cap != null && cap > 0) return cap;
  if (n.valeur_echangee != null && n.valeur_echangee > 0) return n.valeur_echangee;
  return 1;
}

export function groupBySector(rows: HeatmapNode[]): SectorGroup[] {
  const map = new Map<string, HeatmapNode[]>();

  for (const row of rows) {
    const key = row.secteur ?? 'Autre';
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }

  const groups: SectorGroup[] = [];
  for (const [name, children] of map.entries()) {
    const totalValeur = children.reduce((sum, n) => sum + (n.valeur_echangee ?? 0), 0);
    const totalWeight = children.reduce((sum, n) => sum + nodeWeight(n), 0);
    groups.push({ name, children, totalValeur, totalWeight });
  }

  // Tri des secteurs par poids (capitalisation) décroissant.
  groups.sort((a, b) => b.totalWeight - a.totalWeight);

  return groups;
}

/** Linear interpolation between two hex colours. t in [0,1]. */
export function mixColor(hex1: string, hex2: string, t: number): string {
  const parse = (h: string): [number, number, number] => {
    const c = h.replace('#', '');
    return [
      parseInt(c.slice(0, 2), 16),
      parseInt(c.slice(2, 4), 16),
      parseInt(c.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Variation à partir de laquelle la teinte est à pleine intensité. */
export const VAR_PLEINE = 4;
/** Intensité minimale dès qu'il y a une hausse ou une baisse : jamais confondue avec le neutre. */
export const INTENSITE_MIN = 0.5;

export interface PaletteVariation {
  up: string;
  down: string;
  neutre: string;
}

/**
 * Couleur d'une tuile selon la variation : source unique pour la cartographie
 * et la grille mobile. Les teintes viennent des jetons up/down du thème
 * (chartTheme), le neutre mélange surface et muted.
 */
export function couleurVariation(pct: number | null, p: PaletteVariation): string {
  if (pct == null || pct === 0) return p.neutre;
  const t = Math.min(1, INTENSITE_MIN + (1 - INTENSITE_MIN) * (Math.abs(pct) / VAR_PLEINE));
  return mixColor(p.neutre, pct > 0 ? p.up : p.down, t);
}

/** « rgb(r,g,b) » ou « rgba(r,g,b,a) » (sortie de chartTheme) → #rrggbb. */
export function versHex(c: string): string {
  const m = c.match(/\d+/g) ?? ['0', '0', '0'];
  return '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

/** Palette du thème courant (à appeler côté client uniquement). */
export function paletteDepuisTheme(T: { up: string; down: string; surface: string; muted: string }): PaletteVariation {
  return {
    up: versHex(T.up),
    down: versHex(T.down),
    neutre: mixColor(versHex(T.surface), versHex(T.muted), 0.3),
  };
}
