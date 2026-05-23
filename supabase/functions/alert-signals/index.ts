/**
 * Edge Function : alert-signals
 *
 * Appelée par score-daily quand un NOUVEAU signal BUY ou SELL est détecté.
 * Envoie un webhook POST vers ALERT_WEBHOOK_URL (compatible Slack, Discord,
 * ou tout endpoint HTTP).
 *
 * Payload envoyé au webhook :
 *   {
 *     text: string,           // message lisible
 *     signals: [{
 *       code: string,
 *       signal: 'BUY' | 'SELL',
 *       score: number,
 *       cours: number | null,
 *       date: string
 *     }]
 *   }
 *
 * Variables d'environnement (Supabase Dashboard → Secrets) :
 *   ALERT_WEBHOOK_URL  : endpoint Slack/Discord/custom (requis)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injectés automatiquement)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignalAlert {
  code: string;
  signal: 'BUY' | 'SELL' | string;
  score: number;
  cours: number | null;
}

interface AlertPayload {
  signals: SignalAlert[];
  date: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const startMs = Date.now();

  try {
    const payload = (await req.json()) as AlertPayload;
    const { signals, date } = payload;

    if (!signals || signals.length === 0) {
      return jsonResp({ status: 'ok', sent: 0 });
    }

    const webhookUrl = Deno.env.get('ALERT_WEBHOOK_URL');
    if (!webhookUrl) {
      // Pas de webhook configuré : journaliser et sortir proprement.
      await logAlert(supabase, 0, 'partial', 'ALERT_WEBHOOK_URL non configuré');
      return jsonResp({ status: 'partial', message: 'ALERT_WEBHOOK_URL manquant' });
    }

    // Construit le message lisible.
    const lines = signals.map((s) => {
      const icon = s.signal === 'BUY' ? '🟢' : '🔴';
      const cours = s.cours != null ? ` | Cours : ${s.cours.toLocaleString('fr-FR')} FCFA` : '';
      return `${icon} ${s.signal} — **${s.code}** | Score : ${s.score.toFixed(2)}${cours}`;
    });
    const text = `📊 *Nouveaux signaux BRVM — ${date}*\n\n${lines.join('\n')}`;

    const webhookBody = JSON.stringify({ text, signals: signals.map((s) => ({ ...s, date })) });

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: webhookBody,
    });

    if (!resp.ok) {
      const msg = `Webhook HTTP ${resp.status}`;
      await logAlert(supabase, signals.length, 'error', msg);
      return new Response(JSON.stringify({ status: 'error', message: msg }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await logAlert(supabase, signals.length, 'success', null, Date.now() - startMs);
    return jsonResp({ status: 'success', sent: signals.length });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAlert(supabase, 0, 'error', message);
    return new Response(JSON.stringify({ status: 'error', message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function logAlert(
  supabase: ReturnType<typeof createClient>,
  signalCount: number,
  status: 'success' | 'error' | 'partial',
  errorMessage: string | null,
  durationMs?: number,
) {
  await supabase.from('scraper_logs').insert({
    function_name: 'alert-signals',
    status,
    rows_inserted: signalCount,
    rows_updated: 0,
    duration_ms: durationMs ?? null,
    error_message: errorMessage,
  });
}

function jsonResp(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}
