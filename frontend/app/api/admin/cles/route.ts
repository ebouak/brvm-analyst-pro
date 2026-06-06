import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSb } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/server/admin';

const PROVIDERS = ['deepseek', 'mistral', 'xai'] as const;
type Provider = (typeof PROVIDERS)[number];
const ENV_VAR: Record<Provider, string> = {
  deepseek: 'DEEPSEEK_API_KEY', mistral: 'MISTRAL_API_KEY', xai: 'XAI_API_KEY',
};

function admin() {
  return createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET : statut de chaque clé (jamais la valeur en clair). */
export async function GET() {
  const guard = await requireAdmin(createServerClient());
  if ('error' in guard) return guard.error;

  const { data } = await admin().from('api_keys').select('provider');
  const inTable = new Set((data ?? []).map((r) => r.provider as string));
  const status = PROVIDERS.map((p) => ({
    provider: p,
    configured: Boolean(process.env[ENV_VAR[p]]) || inTable.has(p),
    source: process.env[ENV_VAR[p]] ? 'env' : inTable.has(p) ? 'table' : null,
  }));
  return NextResponse.json({ status });
}

/** POST : { provider, api_key } -> upsert (admin uniquement). */
export async function POST(req: Request) {
  const guard = await requireAdmin(createServerClient());
  if ('error' in guard) return guard.error;

  const body = (await req.json().catch(() => null)) as { provider?: string; api_key?: string } | null;
  if (!body || !PROVIDERS.includes(body.provider as Provider) || !body.api_key?.trim()) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const { error } = await admin()
    .from('api_keys')
    .upsert({ provider: body.provider, api_key: body.api_key.trim(), updated_at: new Date().toISOString() },
            { onConflict: 'provider' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
