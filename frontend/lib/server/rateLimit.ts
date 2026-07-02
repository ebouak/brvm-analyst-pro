import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Rate-limit anti-spam pour les endpoints publics d'insertion (leads,
 * contact, newsletter). Adossé à Supabase (fiable sur du serverless,
 * contrairement à un compteur en mémoire qui ne survit pas entre
 * invocations). Minimisation RGPD : chaque appel supprime les lignes hors
 * fenêtre — aucune IP n'est conservée au-delà de la fenêtre active.
 *
 * Fail-open si Supabase est mal configuré : l'anti-spam ne doit jamais
 * bloquer un formulaire légitime à cause d'une erreur d'infra.
 */

export { getClientIp } from './clientIp';

export interface RateLimitOptions {
  route: string;
  ip: string;
  maxHits: number;
  windowSeconds: number;
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<{ allowed: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[rateLimit] SUPABASE_SERVICE_ROLE_KEY manquant — anti-spam désactivé (fail-open).');
    return { allowed: true };
  }

  const admin = createSupabaseClient(url, key, { auth: { persistSession: false } });
  const windowStart = new Date(Date.now() - opts.windowSeconds * 1000).toISOString();

  // Minimisation : purge les lignes hors fenêtre pour cette route+IP avant de compter.
  await admin
    .from('rate_limit_hits')
    .delete()
    .eq('route', opts.route)
    .eq('ip', opts.ip)
    .lt('created_at', windowStart);

  const { count, error: countError } = await admin
    .from('rate_limit_hits')
    .select('*', { count: 'exact', head: true })
    .eq('route', opts.route)
    .eq('ip', opts.ip)
    .gte('created_at', windowStart);

  if (countError) {
    console.warn('[rateLimit] échec de lecture — fail-open', countError.message);
    return { allowed: true };
  }

  if ((count ?? 0) >= opts.maxHits) {
    return { allowed: false };
  }

  await admin.from('rate_limit_hits').insert({ route: opts.route, ip: opts.ip });
  return { allowed: true };
}
