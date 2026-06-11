import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get account
    const { data: account } = await supabase
      .from('paper_trading_accounts')
      .select()
      .eq('user_id', user.id)
      .single();

    if (!account) {
      return NextResponse.json({ stats: null, account: null }, { status: 200 });
    }

    // Fetch closed positions for stats
    const { data: positions, error } = await supabase
      .from('paper_trading_positions')
      .select()
      .eq('account_id', account.id)
      .eq('status', 'closed');

    if (error) {
      console.error('Failed to fetch positions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stats' },
        { status: 500 }
      );
    }

    const closedPositions = positions || [];

    // Calculate stats
    const totalTrades = closedPositions.length;
    const winningTrades = closedPositions.filter((p) => p.pnl > 0).length;
    const losingTrades = closedPositions.filter((p) => p.pnl < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const winningPnls = closedPositions.filter((p) => p.pnl > 0).map((p) => p.pnl);
    const losingPnls = closedPositions.filter((p) => p.pnl < 0).map((p) => p.pnl);

    const avgWin = winningTrades > 0 ? winningPnls.reduce((a, b) => a + b, 0) / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? losingPnls.reduce((a, b) => a + b, 0) / losingTrades : 0;
    const bestTrade = closedPositions.length > 0 ? Math.max(...closedPositions.map((p) => p.pnl)) : 0;
    const worstTrade = closedPositions.length > 0 ? Math.min(...closedPositions.map((p) => p.pnl)) : 0;

    const stats = {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      avgWin,
      avgLoss,
      bestTrade,
      worstTrade,
    };

    return NextResponse.json(
      { stats, account },
      { status: 200 }
    );
  } catch (error) {
    console.error('Paper trading stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
