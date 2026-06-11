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

    const body = (await request.json()) as { code?: string };
    const code = (body.code ?? '').trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

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

    // Interdit les doublons ouverts sur le même code
    const { data: existing } = await supabase
      .from('paper_trading_positions')
      .select('id')
      .eq('account_id', account.id)
      .eq('code', code)
      .eq('status', 'open')
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: `Position déjà ouverte sur ${code}` }, { status: 409 });
    }

    const numShares = (account.capital_current * 0.1) / entryPrice;
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

    return NextResponse.json(
      { positions: positions || [], account },
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
