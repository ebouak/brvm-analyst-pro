/**
 * Edge Function : scrape-daily
 *
 * Déclenchement : cron tous les jours à 18h45 UTC (lun-ven) via pg_cron
 * ou Supabase Scheduled Functions.
 *
 * Logique :
 *   1. Appelle le worker scraper Node.js via un webhook HTTP (GitHub Actions
 *      ou serveur dédié) OU exécute directement la logique de scraping si
 *      le scraper est porté en Deno Edge Function (voir DEPLOYMENT.md §2).
 *
 * Dans cette implémentation, la Edge Function délègue à un webhook externe
 * (pattern recommandé dans docs/DEPLOYMENT.md §2 Option A) : elle envoie
 * un POST à SCRAPER_WEBHOOK_URL avec les secrets nécessaires.
 *
 * Variables d'environnement requises (Supabase Dashboard → Secrets) :
 *   SCRAPER_WEBHOOK_URL   : URL du runner externe (GitHub Actions dispatch URL)
 *   SCRAPER_WEBHOOK_TOKEN : token d'autorisation Bearer
 *   SUPABASE_URL          : URL du projet (injecté automatiquement)
 *   SUPABASE_SERVICE_ROLE_KEY : clé service_role (injectée automatiquement)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


/**
 * Garde d'appel : ces fonctions tournent avec la clé service_role et déclenchent
 * des webhooks ; sans authentification de l'appelant, n'importe qui connaissant
 * l'URL pouvait les invoquer (audit sécurité). Secret partagé EDGE_FUNCTION_SECRET
 * (Supabase Dashboard -> Secrets), en-tête `x-edge-secret`, comparé en temps
 * constant. FAIL CLOSED : secret absent => 503, jamais d'accès libre.
 */
function appelAutorise(req: Request): Response | null {
  const attendu = Deno.env.get('EDGE_FUNCTION_SECRET') ?? '';
  if (attendu.length < 16) {
    return new Response(JSON.stringify({ error: 'EDGE_FUNCTION_SECRET non configuré' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
  const recu = req.headers.get('x-edge-secret') ?? '';
  const enc = new TextEncoder();
  const a = enc.encode(recu), b = enc.encode(attendu);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  if (diff !== 0) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const refus = appelAutorise(req);
  if (refus) return refus;

  const startedAt = new Date().toISOString();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const webhookUrl = Deno.env.get('SCRAPER_WEBHOOK_URL');
    const webhookToken = Deno.env.get('SCRAPER_WEBHOOK_TOKEN');

    if (!webhookUrl) {
      throw new Error('SCRAPER_WEBHOOK_URL non configuré');
    }

    // Déclenche le runner externe.
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify({ command: 'daily', triggered_by: 'edge-function' }),
    });

    const status = resp.ok ? 'success' : 'error';
    const errorMessage = resp.ok ? null : `webhook HTTP ${resp.status}`;

    await supabase.from('scraper_logs').insert({
      function_name: 'scrape-daily',
      status,
      rows_inserted: 0,
      rows_updated: 0,
      error_message: errorMessage,
      meta: { webhook_status: resp.status, started_at: startedAt },
    });

    return new Response(
      JSON.stringify({ status, webhookStatus: resp.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await supabase.from('scraper_logs').insert({
      function_name: 'scrape-daily',
      status: 'error',
      rows_inserted: 0,
      rows_updated: 0,
      error_message: message,
      meta: { started_at: startedAt },
    });

    return new Response(
      JSON.stringify({ status: 'error', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
