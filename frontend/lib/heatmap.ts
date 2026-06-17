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

const NEUTRAL = '#232733';
const UP = '#00c853';
const DOWN = '#f44336';
const MAX_VAR = 8;

/** Maps variation_pct to a colour on the red–grey–green gradient. */
export function colorForVariation(pct: number | null): string {
  if (pct == null) return NEUTRAL;
  const clamped = Math.max(-MAX_VAR, Math.min(MAX_VAR, pct));
  if (clamped > 0) {
    return mixColor(NEUTRAL, UP, clamped / MAX_VAR);
  } else if (clamped < 0) {
    return mixColor(NEUTRAL, DOWN, -clamped / MAX_VAR);
  }
  return NEUTRAL;
}
