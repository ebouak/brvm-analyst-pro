// API du profil utilisateur. GET = profil de l'utilisateur connecté.
// PATCH = met à jour UNIQUEMENT des champs whitelistés (jamais email/is_premium/id)
// via service_role après authentification → pas d'escalade de privilège.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

const WHITELIST = ['display_name', 'username', 'bio', 'location', 'experience_level', 'favorite_sectors', 'cover_gradient', 'preferences'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'];

export async function GET() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return NextResponse.json({ profile: data ?? { id: user.id, email: user.email }, email: user.email });
}

export async function PATCH(req: Request) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of WHITELIST) {
    if (!(k in body)) continue;
    let v = body[k];
    if (k === 'experience_level' && v != null && !LEVELS.includes(String(v))) continue;
    if (k === 'bio' && typeof v === 'string') v = v.slice(0, 160);
    if (k === 'favorite_sectors' && Array.isArray(v)) v = v.slice(0, 12).map((s) => String(s).slice(0, 40));
    patch[k] = v;
  }

  // Écriture via service_role sur la SEULE ligne de l'utilisateur (upsert idempotent).
  const admin = getServiceClient();

  // `preferences` est un seul jsonb écrit par plusieurs éditeurs (profil, dashboard) :
  // fusion top-level pour ne pas écraser les clés non envoyées.
  if ('preferences' in patch && patch.preferences && typeof patch.preferences === 'object') {
    const { data: existing } = await admin.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
    const prev = (existing?.preferences ?? {}) as Record<string, unknown>;
    patch.preferences = { ...prev, ...(patch.preferences as Record<string, unknown>) };
  }

  const { error } = await admin.from('profiles')
    .upsert({ id: user.id, email: user.email, ...patch }, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
