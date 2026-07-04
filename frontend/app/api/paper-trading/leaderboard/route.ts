import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET  : classement public anonymisé (RPC get_paper_leaderboard, opt-in only).
 *        Si l'utilisateur est connecté, renvoie aussi son statut (optin, alias, rang).
 * POST : opt-in/opt-out + alias — réservé au propriétaire du compte (RLS update-own).
 */
export async function GET() {
  try {
    const pub = createPublicClient();
    const { data: rows, error } = await pub.rpc('get_paper_leaderboard', { limit_n: 20 });
    if (error) {
      console.error('leaderboard rpc error:', error);
      return NextResponse.json({ error: 'Classement indisponible' }, { status: 500 });
    }

    // Statut personnel (best-effort : absent si non connecté / pas de compte)
    let me: { optin: boolean; alias: string | null; rank: number | null } | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: account } = await supabase
          .from('paper_trading_accounts')
          .select('id, leaderboard_optin, leaderboard_alias')
          .eq('user_id', user.id)
          .maybeSingle();
        if (account) {
          let rank: number | null = null;
          if (account.leaderboard_optin) {
            // La RLS (owner-only) interdit de compter les autres comptes ici :
            // on retrouve le rang dans le classement public (RPC, top 100) via
            // l'alias effectif — le même dérivé que côté SQL si aucun alias choisi.
            const effectiveAlias =
              (account.leaderboard_alias ?? '').trim() ||
              `Investisseur ${createHash('md5').update(String(account.id)).digest('hex').slice(0, 4).toUpperCase()}`;
            const { data: full } = await pub.rpc('get_paper_leaderboard', { limit_n: 100 });
            const mine = (full ?? []).find((r: { alias: string; rank: number }) => r.alias === effectiveAlias);
            rank = mine ? Number(mine.rank) : null;
          }
          me = {
            optin: Boolean(account.leaderboard_optin),
            alias: account.leaderboard_alias ?? null,
            rank,
          };
        }
      }
    } catch {
      // silencieux : le classement public reste servi
    }

    return NextResponse.json({ rows: rows ?? [], me }, { status: 200 });
  } catch (error) {
    console.error('leaderboard error:', error);
    return NextResponse.json({ error: 'Classement indisponible' }, { status: 500 });
  }
}

const ALIAS_RE = /^[\p{L}\p{N} _.-]{3,24}$/u;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.optin !== 'boolean') {
      return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
    }

    const patch: { leaderboard_optin: boolean; leaderboard_alias?: string | null } = {
      leaderboard_optin: body.optin,
    };

    if (body.alias !== undefined) {
      const alias = String(body.alias ?? '').trim();
      if (alias === '') {
        patch.leaderboard_alias = null;
      } else {
        if (!ALIAS_RE.test(alias)) {
          return NextResponse.json(
            { error: 'Alias invalide : 3 à 24 caractères (lettres, chiffres, espace, _ . -)' },
            { status: 400 },
          );
        }
        if (alias.includes('@')) {
          return NextResponse.json({ error: "L'alias ne doit pas être un email" }, { status: 400 });
        }
        patch.leaderboard_alias = alias;
      }
    }

    const { data, error } = await supabase
      .from('paper_trading_accounts')
      .update(patch)
      .eq('user_id', user.id)
      .select('leaderboard_optin, leaderboard_alias')
      .maybeSingle();

    if (error) {
      console.error('leaderboard optin error:', error);
      return NextResponse.json({ error: 'Échec de la mise à jour' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Aucun compte paper trading' }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true, optin: data.leaderboard_optin, alias: data.leaderboard_alias },
      { status: 200 },
    );
  } catch (error) {
    console.error('leaderboard POST error:', error);
    return NextResponse.json({ error: 'Échec de la mise à jour' }, { status: 500 });
  }
}
