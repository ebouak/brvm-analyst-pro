import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ActionDaily, IndiceDaily, MarketEvent } from '@/lib/types';

// GET /api/reports/market/daily?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = createClient();
  let date = req.nextUrl.searchParams.get('date');
  if (!date) {
    const { data } = await supabase.from('brvm_actions_daily')
      .select('date_marche').order('date_marche', { ascending: false }).limit(1);
    date = data?.[0]?.date_marche ?? null;
  }
  if (!date) return NextResponse.json({ error: 'no data' }, { status: 404 });

  const [{ data: actions }, { data: indices }, { data: events }, { data: signals }] = await Promise.all([
    supabase.from('brvm_actions_daily').select('*').eq('date_marche', date),
    supabase.from('brvm_indices_daily').select('*').eq('date_marche', date),
    supabase.from('market_events').select('*').eq('event_date', date).order('importance_level', { ascending: false }),
    supabase.from('signals_daily').select('*').eq('date_marche', date),
  ]);

  const acts = (actions ?? []) as ActionDaily[];
  const withVar = acts.filter((a) => a.variation_pct != null);
  const vals = withVar.map((a) => a.variation_pct!) ;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const trend = avg > 0.2 ? 'bullish' : avg < -0.2 ? 'bearish' : 'neutral';
  const advancers = withVar.filter((a) => (a.variation_pct ?? 0) > 0).length;
  const decliners = withVar.filter((a) => (a.variation_pct ?? 0) < 0).length;

  const sorted = [...withVar].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0));

  return NextResponse.json({
    reportType: 'market',
    date,
    summary: {
      trend,
      volumeTotal: acts.reduce((s, a) => s + (a.volume ?? 0), 0),
      valeurTotale: acts.reduce((s, a) => s + (a.valeur_echangee ?? 0), 0),
      txTotal: acts.reduce((s, a) => s + (a.nb_transactions ?? 0), 0),
      breadth: { advancers, decliners, unchanged: withVar.length - advancers - decliners },
    },
    indices: (indices ?? []) as IndiceDaily[],
    topGainers: sorted.slice(0, 5),
    topLosers: sorted.slice(-5).reverse(),
    mostActive: [...acts].sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0)).slice(0, 5),
    events: (events ?? []) as MarketEvent[],
    signals: signals ?? [],
  });
}
