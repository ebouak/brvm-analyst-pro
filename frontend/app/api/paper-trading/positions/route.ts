import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
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
    const requestedAmount = typeof body.amount === 'number' && Number.isFinite(body.amount) && body.amount > 0 ? body.amount : null;

    // Plafond d'exposition + ouverture/renfort dans UNE fonction SQL qui verrouille
    // le compte (migration 0185) : les requêtes parallèles ne peuvent plus lire le
    // même « disponible ». Appel service_role, avec l'identifiant de la session.
    const { data, error } = await getServiceClient().rpc('paper_ouvrir_position', {
      p_user: user.id,
      p_code: code,
      p_amount: requestedAmount,
    });
    if (error || !data) {
      console.error('Create position error:', error);
      return NextResponse.json({ error: 'Échec ouverture position' }, { status: 500 });
    }
    const r = data as { ok: boolean; error?: string; prix?: number; reinforced?: boolean; position?: unknown };
    if (!r.ok) {
      if (r.error === 'NO_ACCOUNT') return NextResponse.json({ error: 'Compte non initialisé' }, { status: 400 });
      if (r.error === 'NO_QUOTE') return NextResponse.json({ error: `Aucun cours pour ${code}` }, { status: 400 });
      if (r.error === 'AMOUNT_TOO_LOW') {
        return NextResponse.json(
          { error: `Montant insuffisant : il faut au moins ${Math.round(r.prix ?? 0).toLocaleString('fr-FR')} FCFA pour 1 titre de ${code}.` },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: 'Échec ouverture position' }, { status: 500 });
    }
    if (r.reinforced) return NextResponse.json({ position: r.position, reinforced: true }, { status: 200 });
    return NextResponse.json({ position: r.position }, { status: 201 });
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
