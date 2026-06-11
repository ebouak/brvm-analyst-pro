import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
