import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Ferme une position paper trading au dernier cours connu.
 * Calcule le P&L, met à jour le compte (capital, pnl_total, pnl_pct).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Position (RLS garantit l'appartenance)
    const { data: position, error: posErr } = await supabase
      .from('paper_trading_positions')
      .select()
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();
    if (posErr || !position) {
      return NextResponse.json({ error: 'Position introuvable' }, { status: 404 });
    }
    if (position.status === 'closed') {
      return NextResponse.json({ error: 'Position déjà fermée' }, { status: 409 });
    }

    // Dernier cours
    const { data: quote } = await supabase
      .from('brvm_actions_daily')
      .select('cours_jour, date_marche')
      .eq('code', position.code)
      .order('date_marche', { ascending: false })
      .limit(1)
      .single();
    const exitPrice = quote?.cours_jour ?? null;
    if (!exitPrice || exitPrice <= 0) {
      return NextResponse.json({ error: 'Aucun cours pour clôturer' }, { status: 400 });
    }

    const pnl = (exitPrice - position.entry_price) * position.num_shares;
    const pnlPct = ((exitPrice - position.entry_price) / position.entry_price) * 100;
    const daysHeld = Math.max(
      0,
      Math.floor(
        (new Date(quote!.date_marche).getTime() - new Date(position.entry_date).getTime()) /
          86_400_000,
      ),
    );

    const { error: updErr } = await supabase
      .from('paper_trading_positions')
      .update({
        exit_price: exitPrice,
        exit_date: quote!.date_marche,
        status: 'closed',
        pnl,
        pnl_pct: pnlPct,
        days_held: daysHeld,
      })
      .eq('id', params.id);
    if (updErr) {
      console.error('Close position error:', updErr);
      return NextResponse.json({ error: 'Échec fermeture' }, { status: 500 });
    }

    // Recalcule les agrégats du compte
    const { data: closedAll } = await supabase
      .from('paper_trading_positions')
      .select('pnl')
      .eq('account_id', position.account_id)
      .eq('status', 'closed');
    const pnlTotal = (closedAll ?? []).reduce((s, p) => s + (p.pnl ?? 0), 0);

    const { data: account } = await supabase
      .from('paper_trading_accounts')
      .select('capital_initial')
      .eq('id', position.account_id)
      .single();
    const capitalInitial = account?.capital_initial ?? 0;
    const capitalCurrent = capitalInitial + pnlTotal;
    const accountPnlPct = capitalInitial > 0 ? (pnlTotal / capitalInitial) * 100 : 0;

    await supabase
      .from('paper_trading_accounts')
      .update({ capital_current: capitalCurrent, pnl_total: pnlTotal, pnl_pct: accountPnlPct })
      .eq('id', position.account_id);

    return NextResponse.json({ pnl, pnl_pct: pnlPct }, { status: 200 });
  } catch (error) {
    console.error('Paper trading close error:', error);
    return NextResponse.json({ error: 'Échec fermeture' }, { status: 500 });
  }
}
