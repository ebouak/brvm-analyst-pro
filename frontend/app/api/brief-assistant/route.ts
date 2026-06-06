import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveApiKey, type LlmProvider } from '@/lib/server/apiKeys';
import { TOOL_DEFS, runTool } from '@/lib/briefTools';

export const maxDuration = 60;

const ORDER: { provider: LlmProvider; url: string; model: string }[] = [
  { provider: 'deepseek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { provider: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  { provider: 'xai', url: 'https://api.x.ai/v1/chat/completions', model: 'grok-2-latest' },
];

const SYSTEM =
  "Tu es un analyste financier de la BRVM. Réponds en français, de façon concise et factuelle. " +
  "Base-toi UNIQUEMENT sur le contexte fourni et les outils disponibles. N'invente jamais de chiffres : " +
  "si une donnée manque, dis 'donnée non disponible'. Pas de conseil d'investissement personnalisé.";

async function buildContext(): Promise<string> {
  const sb = createServerClient();
  const { data: lastRow } = await sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche;
  if (!lastDate) return 'Aucune donnée de marché disponible.';
  const { data: lastIdx } = await sb.from('brvm_indices_daily').select('code, valeur, variation_pct, date_marche').not('valeur', 'is', null).order('date_marche', { ascending: false }).limit(2);
  const { data: actions } = await sb.from('brvm_actions_daily').select('code, variation_pct, valeur_echangee').eq('date_marche', lastDate);
  const rows = actions ?? [];
  const up = rows.filter((r) => (r.variation_pct ?? 0) > 0).length;
  const down = rows.filter((r) => (r.variation_pct ?? 0) < 0).length;
  const topVol = [...rows].sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0)).slice(0, 5).map((r) => r.code).join(', ');
  const idxTxt = (lastIdx ?? []).map((i) => `${i.code}=${i.valeur} (${i.variation_pct}%)`).join(' ; ');
  return `Séance du ${lastDate}. Indices: ${idxTxt}. ${up} actions en hausse, ${down} en baisse sur ${rows.length}. Top volumes: ${topVol}.`;
}

interface ChatMsg { role: string; content: unknown; tool_call_id?: string; tool_calls?: unknown; name?: string; }

async function callLLM(cfg: { url: string; model: string }, key: string, messages: ChatMsg[], withTools: boolean) {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: cfg.model, messages, temperature: 0.2, ...(withTools ? { tools: TOOL_DEFS } : {}) }),
    signal: AbortSignal.timeout(50000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function POST(request: Request) {
  const supa = createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { question?: string; history?: ChatMsg[] } | null;
  if (!body?.question?.trim()) return NextResponse.json({ error: 'Question vide' }, { status: 400 });

  // 1er provider disponible.
  let chosen: { url: string; model: string; key: string } | null = null;
  for (const c of ORDER) {
    const k = await resolveApiKey(c.provider);
    if (k) { chosen = { url: c.url, model: c.model, key: k }; break; }
  }
  if (!chosen) return NextResponse.json({ error: 'Aucune clé IA configurée (page admin Clés API).' }, { status: 503 });

  const ctx = await buildContext();
  const messages: ChatMsg[] = [
    { role: 'system', content: `${SYSTEM}\n\nContexte du jour: ${ctx}` },
    ...((body.history ?? []).slice(-6)),
    { role: 'user', content: body.question },
  ];

  try {
    // Boucle d'outils (max 3 tours).
    for (let turn = 0; turn < 3; turn++) {
      const json = await callLLM(chosen, chosen.key, messages, true);
      const msg = json?.choices?.[0]?.message;
      if (!msg) break;
      const toolCalls = msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
      if (toolCalls?.length) {
        messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
        for (const tc of toolCalls) {
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
          const result = await runTool(tc.function.name, parsed);
          messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result) });
        }
        continue; // redonne la main au LLM avec les résultats d'outils
      }
      return NextResponse.json({ answer: msg.content ?? '', provider: chosen.model });
    }
    // Dernier tour sans outils pour forcer une réponse.
    const finalJson = await callLLM(chosen, chosen.key, messages, false);
    return NextResponse.json({ answer: finalJson?.choices?.[0]?.message?.content ?? 'Réponse indisponible.', provider: chosen.model });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur IA' }, { status: 502 });
  }
}
