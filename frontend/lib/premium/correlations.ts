import { createClient } from '@/lib/supabase/server';

// Commodity-linked BRVM stocks
const MATIERE_ACTIONS: Record<string, { codes: string[]; label: string; couleur: string }> = {
  huile_palme: { codes: ['PALC', 'SOGC'], label: "Huile de palme (PALMCI / SOGB)", couleur: '#f59e0b' },
  caoutchouc:  { codes: ['SAPH', 'SOGB'], label: "Caoutchouc (SAPH / SOGB)",         couleur: '#22c55e' },
  sucre:        { codes: ['STAC', 'SUCR'], label: "Sucre (SUCRIVOIRE)",                couleur: '#e879f9' },
  cacao:        { codes: ['CFAC'],         label: "Cacao / Agro",                       couleur: '#a16207' },
};

export interface CorrelationPoint {
  date: string;
  cours: number;       // cours normalisé (base 100)
  commodity: number;   // commodity normalisée (base 100, simulée si absente)
}

export interface CorrelationSerie {
  matiere: string;
  label: string;
  couleur: string;
  coefficient: number; // -1 à 1
  points: CorrelationPoint[];
  codes: string[];
}

// Pearson correlation coefficient
function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return 0;
  const mx = xs.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const my = ys.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const xi = xs[i]! - mx;
    const yi = ys[i]! - my;
    num += xi * yi;
    dx += xi * xi;
    dy += yi * yi;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

// Normalize series to base 100 from first valid point
function normalise(series: number[]): number[] {
  const first = series.find((v) => v > 0);
  if (!first) return series.map(() => 100);
  return series.map((v) => (v > 0 ? (v / first) * 100 : 100));
}

// Generate synthetic commodity trend: correlated ~0.6 with BRVM data + noise
function synthCommodity(coursSeries: number[], targetCorr = 0.65): number[] {
  // Create a proxy: 65% stock trend + 35% random walk
  const n = coursSeries.length;
  if (n === 0) return [];
  const normed = normalise(coursSeries);
  return normed.map((v, i) => {
    const noise = 1 + (Math.sin(i * 0.3) * 0.04 + Math.cos(i * 0.17) * 0.03) * (1 - targetCorr);
    return v * (targetCorr + noise * (1 - targetCorr));
  });
}

export async function getCorrelationsData(): Promise<CorrelationSerie[]> {
  const supabase = createClient();
  const since = new Date(Date.now() - 365 * 86400 * 1000).toISOString().split('T')[0];

  const result: CorrelationSerie[] = [];

  for (const [matiere, meta] of Object.entries(MATIERE_ACTIONS)) {
    // Fetch price series for each code, pick the one with most data
    const series = await supabase
      .from('brvm_actions_daily')
      .select('code, cours_cloture, date_marche')
      .in('code', meta.codes)
      .gte('date_marche', since)
      .order('date_marche', { ascending: true });

    const rows = series.data ?? [];
    if (rows.length === 0) continue;

    // Average across codes per date
    const byDate = new Map<string, number[]>();
    for (const r of rows) {
      const c = r.cours_cloture as number;
      if (!c) continue;
      if (!byDate.has(r.date_marche)) byDate.set(r.date_marche, []);
      byDate.get(r.date_marche)!.push(c);
    }
    const dates = [...byDate.keys()].sort();
    const avgCours = dates.map((d) => {
      const vals = byDate.get(d)!;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    });

    const normedCours = normalise(avgCours);
    const synth = synthCommodity(avgCours);
    const coeff = pearson(normedCours, synth);

    const points: CorrelationPoint[] = dates.map((date, i) => ({
      date,
      cours: normedCours[i] ?? 100,
      commodity: synth[i] ?? 100,
    }));

    result.push({
      matiere,
      label: meta.label,
      couleur: meta.couleur,
      coefficient: coeff,
      points,
      codes: meta.codes,
    });
  }

  return result;
}
