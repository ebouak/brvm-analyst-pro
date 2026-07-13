import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSb } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/server/admin';
import { getMfaStatus } from '@/lib/server/mfa';

const PROVIDERS = ['deepseek', 'mistral', 'xai', 'resend'] as const;
type Provider = (typeof PROVIDERS)[number];
const ENV_VAR: Record<Provider, string> = {
  deepseek: 'DEEPSEEK_API_KEY', mistral: 'MISTRAL_API_KEY', xai: 'XAI_API_KEY', resend: 'RESEND_API_KEY',
};

function admin() {
  return createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * Cette route écrit les clés LLM : elle exige la 2FA comme le reste de la console.
 *
 * Elle ne passe PAS par `rbac.requireAdmin` (qui redirige) mais par le garde
 * historique basé sur l'email, qui renvoie un vrai 403 JSON — approprié pour une
 * route appelée en fetch. Le contrôle 2FA est donc ajouté explicitement ici :
 * sans lui, cette route serait le seul point de la console encore ouvert à un
 * simple mot de passe volé.
 */
async function requireElevated(): Promise<NextResponse | null> {
  const mfa = await getMfaStatus();
  if (mfa.isElevated) return null;
  return NextResponse.json(
    {
      error: mfa.hasFactor
        ? 'Double authentification requise : reconnectez-vous avec votre code.'
        : 'Double authentification obligatoire. Activez-la sur /account/security.',
    },
    { status: 403 },
  );
}

/** GET : statut de chaque clé (jamais la valeur en clair). */
export async function GET() {
  const guard = await requireAdmin(createServerClient());
  if ('error' in guard) return guard.error;
  const notElevated = await requireElevated();
  if (notElevated) return notElevated;

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
  const notElevated = await requireElevated();
  if (notElevated) return notElevated;

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
