// API des thèses d'investissement (user-scoped, RLS owner). GET ?code= renvoie
// la thèse + son statut ; POST enregistre/met à jour ; DELETE supprime.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkThesis, type Stance } from '@/lib/theses/status';

export const dynamic = 'force-dynamic';

async function auth() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}

export async function GET(req: Request) {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const code = new URL(req.url).searchParams.get('code')?.toUpperCase();
  if (!code) return NextResponse.json({ error: 'code requis' }, { status: 400 });

  const [{ data: these }, { data: px }, { data: sig }] = await Promise.all([
    sb.from('investment_theses').select('*').eq('user_id', user.id).eq('code', code).maybeSingle(),
    sb.from('brvm_actions_daily').select('cours_jour').eq('code', code).order('date_marche', { ascending: false }).limit(1),
    sb.from('signals_daily').select('signal').eq('code', code).order('date_marche', { ascending: false }).limit(1),
  ]);
  if (!these) return NextResponse.json({ these: null });

  const coursActuel = (px?.[0]?.cours_jour as number | undefined) ?? null;
  const signalActuel = (sig?.[0]?.signal as 'BUY' | 'SELL' | 'HOLD' | undefined) ?? null;
  const check = checkThesis({
    stance: these.stance as Stance,
    coursReference: these.cours_reference,
    objectif: these.objectif,
    coursActuel,
    signalActuel,
  });
  return NextResponse.json({ these, check, coursActuel, signalActuel });
}

export async function POST(req: Request) {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    code?: string; stance?: Stance; these?: string; objectif?: number | null;
    horizon?: string | null; cours_reference?: number | null; points?: string[];
  } | null;
  if (!body?.code || !body.stance || !body.these?.trim()) {
    return NextResponse.json({ error: 'code, stance et thèse sont requis' }, { status: 400 });
  }
  if (!['achat', 'conserver', 'vente'].includes(body.stance)) {
    return NextResponse.json({ error: 'stance invalide' }, { status: 400 });
  }

  const row = {
    user_id: user.id,
    code: body.code.toUpperCase(),
    stance: body.stance,
    these: body.these.slice(0, 2000),
    objectif: body.objectif ?? null,
    horizon: body.horizon && ['court', 'moyen', 'long'].includes(body.horizon) ? body.horizon : null,
    cours_reference: body.cours_reference ?? null,
    points: Array.isArray(body.points) ? body.points.slice(0, 8).map((p) => String(p).slice(0, 160)) : [],
    updated_at: new Date().toISOString(),
  };
  // L'upsert onConflict:'user_id,code' ne fonctionne plus : l'unicité est
  // désormais un index PARTIEL (une seule these ACTIVE par titre), que
  // supabase-js ne sait pas cibler. On met à jour la these active si elle
  // existe, sinon on insère. Une nouvelle these sur un titre dont l'ancienne
  // est clôturée passe alors sans conflit.
  const { data: existante } = await sb
    .from('investment_theses')
    .select('id')
    .eq('user_id', user.id).eq('code', row.code).eq('statut', 'active')
    .maybeSingle();

  const { error } = existante
    ? await sb.from('investment_theses').update(row).eq('id', existante.id)
    : await sb.from('investment_theses').insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const code = new URL(req.url).searchParams.get('code')?.toUpperCase();
  if (!code) return NextResponse.json({ error: 'code requis' }, { status: 400 });
  const { error } = await sb.from('investment_theses').delete().eq('user_id', user.id).eq('code', code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
