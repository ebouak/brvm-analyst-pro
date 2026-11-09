/** Couleurs des graphiques ECharts lues dans les jetons CSS au moment du rendu (suit le mode clair/sombre). */
export interface ChartTheme {
  up: string;
  down: string;
  accent: string;
  muted: string;
  border: string;
  warn: string;
  ivory: string;
  surface: string;
}

const REPLI: Record<keyof ChartTheme, string> = {
  up: '63 225 139',
  down: '255 107 107',
  accent: '86 215 253',
  muted: '181 181 181',
  border: '27 42 48',
  warn: '255 179 0',
  ivory: '252 252 252',
  surface: '10 20 23',
};

function jeton(nom: string, repli: string): string {
  if (typeof window === 'undefined') return repli;
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(`--color-${nom}`).trim();
    return /^\d+\s+\d+\s+\d+$/.test(v) ? v : repli;
  } catch {
    return repli;
  }
}

const rgb = (t: string, a?: number) => {
  const [r, g, b] = t.split(/\s+/);
  return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
};

export function chartTheme(): ChartTheme & { alpha: (c: keyof ChartTheme, a: number) => string } {
  const brut = (k: keyof ChartTheme) => jeton(k, REPLI[k]);
  return {
    up: rgb(brut('up')),
    down: rgb(brut('down')),
    accent: rgb(brut('accent')),
    muted: rgb(brut('muted')),
    border: rgb(brut('border')),
    warn: rgb(brut('warn')),
    ivory: rgb(brut('ivory')),
    surface: rgb(brut('surface')),
    alpha: (c, a) => rgb(brut(c), a),
  };
}
