import 'server-only';
import { createClient } from '@supabase/supabase-js';

export type LlmProvider = 'deepseek' | 'mistral' | 'xai';

const ENV_VAR: Record<LlmProvider, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  xai: 'XAI_API_KEY',
};

/**
 * Résout la clé d'un provider. Priorité : variable d'env, sinon table api_keys
 * (lue via service_role). Renvoie null si aucune source.
 */
export async function resolveApiKey(provider: LlmProvider): Promise<string | null> {
  const fromEnv = process.env[ENV_VAR[provider]];
  if (fromEnv) return fromEnv;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  const admin = createClient(url, svc);
  const { data } = await admin.from('api_keys').select('api_key').eq('provider', provider).maybeSingle();
  return data?.api_key ?? null;
}

/**
 * Résout la clé Resend (envoi d'emails). Priorité : env `RESEND_API_KEY`,
 * sinon table api_keys (provider='resend', lue via service_role). Permet de
 * gérer la clé depuis l'admin sans redéploiement. Renvoie null si aucune source.
 */
export async function resolveResendKey(): Promise<string | null> {
  const fromEnv = process.env.RESEND_API_KEY;
  if (fromEnv) return fromEnv;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  const admin = createClient(url, svc);
  const { data } = await admin.from('api_keys').select('api_key').eq('provider', 'resend').maybeSingle();
  return data?.api_key ?? null;
}
