import { createClient } from '@/lib/supabase/server';

export interface PointDividende {
  code: string; nom: string; rendement: number; payout: number; signal: string;
}
export interface PointLiquiditeVol {
  code: string; nom: string; liquidite: number; volatilite: number; signal: string;
}
export interface CellHeatmap {
  code: string; date: string; variation: number;
}
export interface PointValuation {
  code: string; nom: string; marge_nette: number; croissance_ca: number | null; signal: string;
}

export async function getAnomaliesData() {
  const supabase = createClient();

  const { data: cotations } = await supabase
    .from('brvm_actions_daily')
    .select('code, designation, date_marche, cours_jour, variation_pct, valeur_echangee')
    .order('date_marche', { ascending: false })
    .limit(3000);

  const { data: fonds } = await supabase
    .from('fundamentals')
    .select('code, year, revenue, net_income, equity')
    .order('year', { ascending: false });

  const { data: divs } = await supabase
    .from('dividends')
    .select('code, montant, exercice')
    .order('exercice', { ascending: false });

  const { data: signals } = await supabase
    .from('signals_daily')
    .select('code, signal')
    .order('date_marche', { ascending: false })
    .limit(200);

  // Organiser par code
  const byCode = new Map<string, NonNullable<typeof cotations>>();
  for (const c of cotations ?? []) {
    if (!byCode.has(c.code)) byCode.set(c.code, []);
    if (byCode.get(c.code)!.length < 20) byCode.get(c.code)!.push(c);
  }

  const fondCurr = new Map<string, { revenue: number | null; net_income: number | null; equity: number | null; year: number }>();
  const fondPrev = new Map<string, { revenue: number | null; net_income: number | null }>();
  for (const f of fonds ?? []) {
    if (!fondCurr.has(f.code)) {
      fondCurr.set(f.code, { revenue: f.revenue, net_income: f.net_income, equity: f.equity, year: f.year });
    } else {
      const curr = fondCurr.get(f.code)!;
      if (f.year === curr.year - 1 && !fondPrev.has(f.code)) {
        fondPrev.set(f.code, { revenue: f.revenue, net_income: f.net_income });
      }
    }
  }

  const divMap = new Map<string, number>();
  for (const d of divs ?? []) {
    if (!divMap.has(d.code)) divMap.set(d.code, Number(d.montant));
  }

  const signalMap = new Map<string, string>();
  for (const s of signals ?? []) {
    if (!signalMap.has(s.code)) signalMap.set(s.code, s.signal);
  }

  // 1. Scatter dividendes : rendement vs payout
  const pointsDividendes: PointDividende[] = [];
  for (const [code, rows] of byCode) {
    const cours = rows[0]?.cours_jour;
    const div = divMap.get(code);
    const f = fondCurr.get(code);
    if (!cours || !div) continue;
    const rendement = (div / cours) * 100;
    const payout = (f?.net_income && f.net_income > 0) ? (div * 1000 / f.net_income) * 100 : NaN;
    if (isNaN(payout) || payout > 500 || payout < 0) continue;
    pointsDividendes.push({
      code, nom: rows[0]?.designation ?? code,
      rendement: +rendement.toFixed(2),
      payout: +payout.toFixed(1),
      signal: signalMap.get(code) ?? 'HOLD',
    });
  }

  // 2. Scatter liquidité vs volatilité
  const pointsLiqVol: PointLiquiditeVol[] = [];
  for (const [code, rows] of byCode) {
    if (rows.length < 5) continue;
    const liquidite = rows.reduce((s, r) => s + (r.valeur_echangee ?? 0), 0) / rows.length / 1e6;
    const variations = rows.map((r) => r.variation_pct ?? 0);
    const mean = variations.reduce((s, v) => s + v, 0) / variations.length;
    const volatilite = +Math.sqrt(variations.reduce((s, v) => s + (v - mean) ** 2, 0) / variations.length).toFixed(2);
    pointsLiqVol.push({
      code, nom: rows[0]?.designation ?? code,
      liquidite: +liquidite.toFixed(2),
      volatilite,
      signal: signalMap.get(code) ?? 'HOLD',
    });
  }

  // 3. Heatmap 20 séances
  const heatmapCells: CellHeatmap[] = [];
  for (const [code, rows] of byCode) {
    for (const r of rows) {
      heatmapCells.push({ code, date: r.date_marche, variation: +(r.variation_pct ?? 0).toFixed(2) });
    }
  }

  // 4. Marge nette vs croissance CA
  const pointsValuation: PointValuation[] = [];
  for (const [code, f] of fondCurr) {
    if (!f.revenue || !f.net_income) continue;
    const marge = (f.net_income / f.revenue) * 100;
    const prev = fondPrev.get(code);
    const croissance_ca = prev?.revenue ? +((f.revenue - prev.revenue) / Math.abs(prev.revenue) * 100).toFixed(1) : null;
    const rows = byCode.get(code);
    pointsValuation.push({
      code, nom: rows?.[0]?.designation ?? code,
      marge_nette: +marge.toFixed(1),
      croissance_ca,
      signal: signalMap.get(code) ?? 'HOLD',
    });
  }

  return { pointsDividendes, pointsLiqVol, heatmapCells, pointsValuation };
}
