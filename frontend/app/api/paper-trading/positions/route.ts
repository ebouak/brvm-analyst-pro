import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Ouvre une position paper trading sur un code, au dernier cours connu.
 * Taille = 10% du capital courant. Body: { code: string }.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { code?: string; amount?: number };
    const code = (body.code ?? '').trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }
    const requestedAmount = typeof body.amount === 'number' && body.amount > 0 ? body.amount : null;

    // Compte
    const { data: account } = await supabase
      .from('paper_trading_accounts')
      .select()
      .eq('user_id', user.id)
      .single();
    if (!account) {
      return NextResponse.json({ error: 'Compte non initialisé' }, { status: 400 });
    }

    // Dernier cours connu
    const { data: quote } = await supabase
      .from('brvm_actions_daily')
      .select('cours_jour, date_marche')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(1)
      .single();
    const entryPrice = quote?.cours_jour ?? null;
    if (!entryPrice || entryPrice <= 0) {
      return NextResponse.json({ error: `Aucun cours pour ${code}` }, { status: 400 });
    }

    const amountToInvest = requestedAmount ?? account.capital_current * 0.1;
    // On achète des actions ENTIÈRES (impossible de détenir une fraction d'action).
    const numShares = Math.floor(amountToInvest / entryPrice);
    if (numShares < 1) {
      return NextResponse.json(
        { error: `Montant insuffisant : il faut au moins ${Math.round(entryPrice).toLocaleString('fr-FR')} FCFA pour 1 titre de ${code}.` },
        { status: 400 },
      );
    }

    // Position déjà ouverte sur ce code : on RENFORCE (moyenne pondérée du PRU)
    // au lieu de bloquer.
    const { data: existing } = await supabase
      .from('paper_trading_positions')
      .select('id, num_shares, entry_price')
      .eq('account_id', account.id)
      .eq('code', code)
      .eq('status', 'open')
      .limit(1)
      .maybeSingle();

    if (existing) {
      const old = existing as { id: string; num_shares: number; entry_price: number };
      const totalShares = old.num_shares + numShares;
      const avgEntry = totalShares > 0 ? (old.num_shares * old.entry_price + numShares * entryPrice) / totalShares : entryPrice;
      const { data: position, error } = await supabase
        .from('paper_trading_positions')
        .update({ num_shares: totalShares, entry_price: avgEntry })
        .eq('id', old.id)
        .select()
        .single();
      if (error) {
        console.error('Reinforce position error:', error);
        return NextResponse.json({ error: 'Échec du renforcement de position' }, { status: 500 });
      }
      return NextResponse.json({ position, reinforced: true }, { status: 200 });
    }

    const { data: position, error } = await supabase
      .from('paper_trading_positions')
      .insert({
        user_id: user.id,
        account_id: account.id,
        code,
        entry_price: entryPrice,
        entry_date: quote!.date_marche,
        num_shares: numShares,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      console.error('Create position error:', error);
      return NextResponse.json({ error: 'Échec ouverture position' }, { status: 500 });
    }
    return NextResponse.json({ position }, { status: 201 });
  } catch (error) {
    console.error('Paper trading create position error:', error);
    return NextResponse.json({ error: 'Échec ouverture position' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ positions: [], account: null }, { status: 200 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'open' | 'closed' | null;

    // Fetch positions
    let query = supabase
      .from('paper_trading_positions')
      .select()
      .eq('account_id', account.id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: positions, error } = await query.order('entry_date', { ascending: false });

    if (error) {
      console.error('Failed to fetch positions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch positions' },
        { status: 500 }
      );
    }

    const rows = positions || [];

    // Valorise les positions OUVERTES au dernier cours connu (P&L latent).
    const openCodes = [...new Set(rows.filter((p) => p.status === 'open').map((p) => p.code))];
    const lastCours: Record<string, number> = {};
    if (openCodes.length > 0) {
      const { data: lastDateRow } = await supabase
        .from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
      const lastDate = (lastDateRow as { date_marche: string }[] | null)?.[0]?.date_marche ?? null;
      if (lastDate) {
        const { data: quotes } = await supabase
          .from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', lastDate).in('code', openCodes);
        for (const q of (quotes ?? []) as { code: string; cours_jour: number | null }[]) {
          if (q.cours_jour != null) lastCours[q.code] = q.cours_jour;
        }
      }
    }

    const enriched = rows.map((p) => {
      if (p.status !== 'open') return p;
      const cours = lastCours[p.code] ?? p.entry_price;
      const currentValue = cours * p.num_shares;
      const cost = p.entry_price * p.num_shares;
      const latentPnl = currentValue - cost;
      return {
        ...p,
        current_price: cours,
        current_value: currentValue,
        pnl: latentPnl,
        pnl_pct: cost > 0 ? (latentPnl / cost) * 100 : 0,
      };
    });

    return NextResponse.json(
      { positions: enriched, account },
      { status: 200 }
    );
  } catch (error) {
    console.error('Paper trading positions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}
