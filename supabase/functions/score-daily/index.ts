/**
 * Edge Function : score-daily
 *
 * Déclenchement : cron tous les jours à 19h15 UTC (lun-ven), après scrape-daily.
 *
 * Logique :
 *   1. Lit les instruments actifs depuis brvm_instruments.
 *   2. Pour chaque instrument, récupère l'historique de clôture (120 séances).
 *   3. Calcule le signal (BUY/HOLD/SELL) via la formule de scoring §9.
 *   4. Upsert dans signals_daily.
 *   5. Détecte les NOUVEAUX signaux BUY/SELL (non présents la veille) et
 *      appelle alert-signals pour chacun.
 *
 * Variables d'environnement (Supabase Dashboard → Secrets) :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injectés automatiquement)
 *   ALERT_SIGNALS_URL : URL de la Edge Function alert-signals (optionnel)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Paramètres de scoring (cf. scraper/src/scoring/score.ts SCORING_PARAMS).
const BUY_THRESHOLD = 0.6;
const SELL_THRESHOLD = -0.6;
const MIN_HISTORY = 15;
const VAR_CAP_PCT = 5;
const RSI_BAND = 20;
const W_VARIATION = 0.3;
const W_VOLUME = 0.4;
const W_RSI = 0.3;
const BONUS_TENDANCE = 0.1;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  return closes.slice(closes.length - period).reduce((a, b) => a + b, 0) / period;
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (d >= 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function computeSignal(closes: number[], variationPct: number | null): 'BUY' | 'HOLD' | 'SELL' {
  if (closes.length < MIN_HISTORY || variationPct == null) return 'HOLD';

  const scoreVar = variationPct != null
    ? clamp(variationPct / VAR_CAP_PCT, -1, 1) : 0;
  const rsiVal = rsi(closes, 14);
  const scoreRsi = rsiVal != null ? clamp((50 - rsiVal) / RSI_BAND, -1, 1) : 0;
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const bonus = (ma20 != null && ma50 != null && ma20 > ma50) ? BONUS_TENDANCE : 0;

  const total = clamp(
    W_VARIATION * scoreVar + W_VOLUME * 0 + W_RSI * scoreRsi + bonus,
    -1, 1,
  );

  if (total > BUY_THRESHOLD) return 'BUY';
  if (total < SELL_THRESHOLD) return 'SELL';
  return 'HOLD';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    // Date cible : dernière séance disponible.
    const { data: lastRow } = await supabase
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(1);
    const dateMarche: string | null = lastRow?.[0]?.date_marche ?? null;

    if (!dateMarche) {
      await logRun(supabase, 'score-daily', 'partial', 0, 0, Date.now() - startMs, null,
        'Aucune données brvm_actions_daily disponible');
      return jsonResp({ status: 'partial', message: 'no data' });
    }

    // Signaux de la veille pour détecter les nouveaux.
    const yesterday = new Date(dateMarche);
    yesterday.setDate(yesterday.getDate() - 1);
    const { data: prevSignals } = await supabase
      .from('signals_daily')
      .select('code, signal')
      .eq('date_marche', yesterday.toISOString().slice(0, 10));
    const prevMap = new Map((prevSignals ?? []).map((s) => [s.code as string, s.signal as string]));

    // Instruments actifs.
    const { data: instruments } = await supabase
      .from('brvm_instruments')
      .select('code')
      .eq('type', 'action')
      .eq('actif', true);

    const codes = (instruments ?? []).map((i) => i.code as string);
    const newSignals: { code: string; signal: string; score: number; cours: number | null }[] = [];
    let inserted = 0;

    for (const code of codes) {
      const { data: hist } = await supabase
        .from('brvm_actions_daily')
        .select('cours_jour, variation_pct')
        .eq('code', code)
        .order('date_marche', { ascending: false })
        .limit(120);

      const rows = (hist ?? []) as { cours_jour: number | null; variation_pct: number | null }[];
      const closes = rows.map((r) => r.cours_jour ?? 0).filter((v) => v > 0).reverse();
      const latestVar = rows[0]?.variation_pct ?? null;

      const signal = computeSignal(closes, latestVar);
      const scoreTotal = clamp(W_VARIATION * (latestVar != null ? clamp(latestVar / VAR_CAP_PCT, -1, 1) : 0), -1, 1);

      await supabase.from('signals_daily').upsert(
        { code, date_marche: dateMarche, signal, score_total: scoreTotal, confiance: null, explication: null },
        { onConflict: 'code,date_marche' },
      );
      inserted++;

      // Nouveau signal actionnable non présent la veille.
      const prev = prevMap.get(code);
      if (signal !== 'HOLD' && prev !== signal) {
        newSignals.push({ code, signal, score: scoreTotal, cours: rows[0]?.cours_jour ?? null });
      }
    }

    // Déclenche alert-signals pour chaque nouveau signal.
    const alertUrl = Deno.env.get('ALERT_SIGNALS_URL');
    if (alertUrl && newSignals.length > 0) {
      await fetch(alertUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals: newSignals, date: dateMarche }),
      });
    }

    await logRun(supabase, 'score-daily', 'success', inserted, 0, Date.now() - startMs, dateMarche, null);
    return jsonResp({ status: 'success', date: dateMarche, nb_signaux: inserted, new_alerts: newSignals.length });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun(supabase, 'score-daily', 'error', 0, 0, Date.now() - startMs, null, message);
    return new Response(JSON.stringify({ status: 'error', message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function logRun(
  supabase: ReturnType<typeof createClient>,
  fnName: string,
  status: 'success' | 'error' | 'partial',
  inserted: number,
  updated: number,
  durationMs: number,
  dateMarche: string | null,
  errorMessage: string | null,
) {
  await supabase.from('scraper_logs').insert({
    function_name: fnName, status,
    rows_inserted: inserted, rows_updated: updated,
    duration_ms: durationMs, date_marche: dateMarche, error_message: errorMessage,
  });
}

function jsonResp(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}
