import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveApiKey, type LlmProvider } from '@/lib/server/apiKeys';
import { TOOL_DEFS, runTool } from '@/lib/briefTools';
import { SYSTEM_PROMPT_ANALYSTE } from '@/lib/ai/prompts';

export const maxDuration = 60;

const ORDER: { provider: LlmProvider; url: string; model: string }[] = [
  { provider: 'deepseek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { provider: 'mistral',  url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  { provider: 'xai',      url: 'https://api.x.ai/v1/chat/completions',      model: 'grok-2-latest' },
];

// ── Contexte marché injecté automatiquement ──────────────────────────────────

async function buildContext(): Promise<string> {
  try {
    const sb = createClient();
    const [
      { data: lastRow },
      { data: lastIdx },
      { data: actions },
      { data: signals },
    ] = await Promise.all([
      sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1),
      sb.from('brvm_indices_daily').select('code, valeur, variation_pct').order('date_marche', { ascending: false }).limit(4),
      sb.from('brvm_actions_daily').select('code, variation_pct, valeur_echangee').order('date_marche', { ascending: false }).limit(47),
      sb.from('signals_daily').select('code, signal, confiance').order('date_marche', { ascending: false }).limit(47),
    ]);

    const lastDate = lastRow?.[0]?.date_marche;
    if (!lastDate) return '';

    const rows = actions ?? [];
    const up   = rows.filter((r) => (r.variation_pct ?? 0) > 0).length;
    const down = rows.filter((r) => (r.variation_pct ?? 0) < 0).length;
    const flat = rows.filter((r) => r.variation_pct === 0).length;

    const topHausse = [...rows]
      .sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0))
      .slice(0, 3).map((r) => `${r.code} +${r.variation_pct?.toFixed(2)}%`).join(', ');
    const topBaisse = [...rows]
      .sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0))
      .slice(0, 3).map((r) => `${r.code} ${r.variation_pct?.toFixed(2)}%`).join(', ');
    const topVol = [...rows]
      .sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0))
      .slice(0, 3).map((r) => r.code).join(', ');

    const idxTxt = (lastIdx ?? []).slice(0, 2)
      .map((i) => `${i.code} ${i.valeur} (${i.variation_pct?.toFixed(2)}%)`).join(' | ');

    const sigs = signals ?? [];
    const nBuy  = sigs.filter((s) => s.signal === 'BUY').length;
    const nSell = sigs.filter((s) => s.signal === 'SELL').length;
    const nHold = sigs.filter((s) => s.signal === 'HOLD').length;

    return `\n\n=== DONNÉES TEMPS RÉEL — Séance du ${lastDate} ===
Indices: ${idxTxt}
Marché: ${up} hausse · ${down} baisse · ${flat} stables (${rows.length} cotées)
Top hausses: ${topHausse}
Top baisses: ${topBaisse}
Plus gros volumes: ${topVol}
Signaux: ${nBuy} BUY · ${nHold} HOLD · ${nSell} SELL

IMPORTANT: Tu as accès aux données temps réel via tes outils. Utilise-les SYSTÉMATIQUEMENT avant de répondre. Ne jamais inventer de données.
Outils disponibles: get_market_snapshot, get_action_detail, get_signals, get_sector_performance, get_indices, get_obligations, get_dividends, get_events, get_notations, get_top_movers, get_fundamentals, search_company`;
  } catch {
    return '';
  }
}

// ── Appel LLM (non-streaming pour la boucle d'outils) ────────────────────────

async function callLLM(
  cfg: { url: string; model: string },
  key: string,
  messages: unknown[],
  withTools: boolean,
) {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.15,
      messages,
      ...(withTools ? { tools: TOOL_DEFS, tool_choice: 'auto' } : {}),
    }),
    signal: AbortSignal.timeout(50000),
  });
  if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// ── Appel LLM streaming (réponse finale) ─────────────────────────────────────

async function* streamLLM(
  cfg: { url: string; model: string },
  key: string,
  messages: unknown[],
): AsyncGenerator<string> {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: cfg.model, temperature: 0.15, stream: true, messages }),
    signal: AbortSignal.timeout(50000),
  });
  if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}`);

  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') return;
      try {
        const evt = JSON.parse(raw);
        const text: string | undefined = evt?.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch { /* skip */ }
    }
  }
}

// ── Route principale ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Résoudre le provider
  let chosen: { provider: string; url: string; model: string; key: string } | null = null;
  for (const c of ORDER) {
    const key = await resolveApiKey(c.provider);
    if (key) { chosen = { ...c, key }; break; }
  }
  if (!chosen) {
    return Response.json(
      { error: 'Aucune clé IA configurée. Ajoutez DeepSeek, Mistral ou Grok dans /admin/cles-api.' },
      { status: 503 },
    );
  }

  // 2. Parser le body
  const body = await req.json().catch(() => null);
  if (!body?.messages?.length) {
    return Response.json({ error: 'messages requis' }, { status: 400 });
  }

  // 3. Construire le contexte temps réel
  const ctx = await buildContext();
  const systemContent = SYSTEM_PROMPT_ANALYSTE + ctx;

  // 4. Construire la conversation initiale
  type ChatMsg = { role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string; name?: string };
  const messages: ChatMsg[] = [
    { role: 'system', content: systemContent },
    ...(body.messages as ChatMsg[]).slice(-8),
  ];

  // 5. Boucle d'outils (max 5 tours, non-streaming)
  const cfg = { url: chosen.url, model: chosen.model };
  const key = chosen.key;

  for (let turn = 0; turn < 5; turn++) {
    const json = await callLLM(cfg, key, messages, true);
    const msg = json?.choices?.[0]?.message;
    if (!msg) break;

    const toolCalls = msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
    if (!toolCalls?.length) {
      // Pas d'appel d'outil — on relance en mode streaming pour la réponse finale
      break;
    }

    // Exécuter les outils en parallèle
    messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
    await Promise.all(
      toolCalls.map(async (tc) => {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
        const result = await runTool(tc.function.name, args);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result),
        });
      }),
    );
  }

  // 6. Streaming de la réponse finale (sans tools pour forcer le texte)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Retirer tool_calls des messages pour le streaming final
        const cleanMessages = messages.map(({ tool_calls: _tc, ...rest }) => rest);
        for await (const text of streamLLM(cfg, key, cleanMessages)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
