// GET /api/account/export
// Renvoie l'intégralité des données personnelles de l'utilisateur en JSON
// (droit d'accès et de portabilité — cf. spec §11.2).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const [watchlists, items, positions, alerts, notifs, snapshots, backtests] =
    await Promise.all([
      supabase.from('watchlists').select('*').eq('user_id', user.id),
      supabase
        .from('watchlist_items')
        .select('*, watchlists!inner(user_id)')
        .eq('watchlists.user_id', user.id),
      supabase.from('portfolios_positions').select('*').eq('user_id', user.id),
      supabase.from('alerts').select('*').eq('user_id', user.id),
      supabase.from('notifications_log').select('*').eq('user_id', user.id),
      supabase.from('report_snapshots').select('*').eq('user_id', user.id),
      supabase.from('backtest_runs').select('*').eq('user_id', user.id),
    ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    watchlists: watchlists.data ?? [],
    watchlist_items: items.data ?? [],
    portfolio_positions: positions.data ?? [],
    alerts: alerts.data ?? [],
    notifications_log: notifs.data ?? [],
    report_snapshots: snapshots.data ?? [],
    backtest_runs: backtests.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="brvm-analyst-export-${user.id}.json"`,
    },
  });
}
