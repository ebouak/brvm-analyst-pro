import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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

    // Check if already has account
    const { data: existing } = await supabase
      .from('paper_trading_accounts')
      .select()
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { account: existing, alreadyExists: true },
        { status: 200 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { capital_initial } = body as { capital_initial: number };

    if (!capital_initial || capital_initial <= 0) {
      return NextResponse.json(
        { error: 'Invalid capital_initial' },
        { status: 400 }
      );
    }

    // Create account
    const { data: account, error } = await supabase
      .from('paper_trading_accounts')
      .insert({
        user_id: user.id,
        capital_initial,
        capital_current: capital_initial,
        pnl_total: 0,
        pnl_pct: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create account:', error);
      return NextResponse.json(
        { error: 'Failed to initialize account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ account, alreadyExists: false }, { status: 201 });
  } catch (error) {
    console.error('Paper trading init error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize account' },
      { status: 500 }
    );
  }
}
