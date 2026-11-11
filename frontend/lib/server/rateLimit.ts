import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Rate-limit anti-spam pour les endpoints publics d'insertion (leads,
 * contact, newsletter). Adossé à Supabase (fiable sur du serverless,
 * contrairement à un compteur en mémoire qui ne survit pas entre
 * invocations). Minimisation RGPD : chaque appel supprime les lignes hors
 * fenêtre — aucune IP n'est conservée au-delà de la fenêtre active.
 *
 * Par défaut FAIL-OPEN si Supabase est mal configuré : l'anti-spam ne doit
 * jamais bloquer un formulaire légitime à cause d'une erreur d'infra. Les routes
 * qui coûtent de l'argent (appels LLM) passent `failClosed: true` : en cas
 * d'erreur d'infra elles REFUSENT, sinon une panne ouvrirait le budget.
 *
 * Chemin principal : la fonction SQL `rate_limit_prendre` (migration 0211), qui
 * purge, compte et insère sous verrou — atomique. Tant qu'elle n'est pas
 * appliquée, repli journalisé sur l'ancien chemin en trois requêtes (non
 * atomique : des rafales simultanées peuvent dépasser la limite).
 */

export { getClientIp } from './clientIp';

export interface RateLimitOptions {
  route: string;
  ip: string;
  maxHits: number;
  windowSeconds: number;
  /** Refuser (au lieu d'autoriser) quand le compteur est inaccessible. */
  failClosed?: boolean;
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<{ allowed: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const repli = { allowed: !opts.failClosed };
  if (!url || !key) {
    console.warn(
      `[rateLimit] SUPABASE_SERVICE_ROLE_KEY manquant — ${opts.failClosed ? 'refus (fail-closed)' : 'anti-spam désactivé (fail-open)'}.`,
    );
    return repli;
  }

  const admin = createSupabaseClient(url, key, { auth: { persistSession: false } });

  // Chemin atomique (migration 0211).
  const { data: pris, error: rpcError } = await admin.rpc('rate_limit_prendre', {
    p_route: opts.route,
    p_ip: opts.ip,
    p_max: opts.maxHits,
    p_window_seconds: opts.windowSeconds,
  });
  if (!rpcError && typeof pris === 'boolean') return { allowed: pris };
  if (rpcError && !fonctionAbsente(rpcError)) {
    console.warn('[rateLimit] rate_limit_prendre a échoué —', rpcError.message);
    return repli;
  }
  if (rpcError) {
    console.warn('[rateLimit] rate_limit_prendre absente (migration 0211 non appliquée) — repli non atomique.');
  }

  const windowStart = new Date(Date.now() - opts.windowSeconds * 1000).toISOString();

  // Minimisation : purge TOUTES les lignes hors fenêtre de la route, pas
  // seulement celles de cet appelant. Purger par IP laissait en base, sans
  // limite de durée, l'IP de quiconque ne revenait jamais.
  await admin
    .from('rate_limit_hits')
    .delete()
    .eq('route', opts.route)
    .lt('created_at', windowStart);

  const { count, error: countError } = await admin
    .from('rate_limit_hits')
    .select('*', { count: 'exact', head: true })
    .eq('route', opts.route)
    .eq('ip', opts.ip)
    .gte('created_at', windowStart);

  if (countError) {
    console.warn('[rateLimit] échec de lecture —', opts.failClosed ? 'refus' : 'fail-open', countError.message);
    return repli;
  }

  if ((count ?? 0) >= opts.maxHits) {
    return { allowed: false };
  }

  await admin.from('rate_limit_hits').insert({ route: opts.route, ip: opts.ip });
  return { allowed: true };
}

/** Vrai quand PostgREST ne trouve pas la fonction (migration non appliquée). */
function fonctionAbsente(e: { code?: string; message?: string }): boolean {
  return e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message ?? '');
}
