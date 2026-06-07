import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveApiKey, type LlmProvider } from '@/lib/server/apiKeys';
import { TOOL_DEFS, runTool } from '@/lib/briefTools';

export const maxDuration = 60;

const ORDER: { provider: LlmProvider; url: string; model: string }[] = [
  { provider: 'deepseek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { provider: 'mistral',  url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  { provider: 'xai',     url: 'https://api.x.ai/v1/chat/completions', model: 'grok-2-latest' },
];

const SYSTEM = `Tu es BRVM Analyst, un assistant financier expert de la Bourse Régionale des Valeurs Mobilières (UEMOA).

Tes capacités :
- Accès temps réel à toutes les données du marché via tes outils
- Cours, volumes, variations de toutes les actions BRVM
- Signaux techniques BUY/HOLD/SELL avec scores et explications
- Notations financières (BloomField Investment, GCR Ratings) avec historique
- Données fondamentales : CA, résultat net, capitaux propres, dette
- Dividendes historiques et rendements
- Événements de marché : AG, résultats, communiqués
- Publications officielles BDFIN
- Marché obligataire : taux, maturité, YTM
- Indices BRVM (BRVMC, BRVM10, BRVM-Prestige)
- Performance par secteur

Règles absolues :
- Réponds TOUJOURS en français, de façon concise et structurée
- Base-toi UNIQUEMENT sur les données récupérées via tes outils — jamais d'inventions
- Si une donnée manque, utilise un outil pour la récupérer avant de dire "non disponible"
- Quand on te cite une société par nom, utilise search_company pour trouver son code
- Les montants sont en FCFA sauf indication contraire
- Jamais de conseil d'investissement personnalisé ; tu fournis des analyses factuelles`;

async function buildContext(): Promise<string> {
  const sb = createServerClient();

  const [
    { data: lastRow },
    { data: lastIdx },
    { data: actions },
    { data: signals },
  ] = await Promise.all([
    sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1),
    sb.from('brvm_indices_daily').select('code, libelle, valeur, variation_pct').order('date_marche', { ascending: false }).limit(4),
    sb.from('brvm_actions_daily').select('code, variation_pct, valeur_echangee, cours_jour').order('date_marche', { ascending: false }).limit(47),
    sb.from('signals_daily').select('code, signal, confiance').order('date_marche', { ascending: false }).limit(47),
  ]);

  const lastDate = lastRow?.[0]?.date_marche;
  if (!lastDate) return 'Aucune donnée de marché disponible.';

  const rows = actions ?? [];
  const up    = rows.filter((r) => (r.variation_pct ?? 0) > 0).length;
  const down  = rows.filter((r) => (r.variation_pct ?? 0) < 0).length;
  const flat  = rows.filter((r) => r.variation_pct === 0).length;
  const topHausse = [...rows].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)).slice(0, 3).map((r) => `${r.code} +${r.variation_pct?.toFixed(2)}%`).join(', ');
  const topBaisse = [...rows].sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0)).slice(0, 3).map((r) => `${r.code} ${r.variation_pct?.toFixed(2)}%`).join(', ');
  const topVol    = [...rows].sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0)).slice(0, 3).map((r) => r.code).join(', ');
  const idxTxt    = (lastIdx ?? []).slice(0, 2).map((i) => `${i.code} ${i.valeur} (${i.variation_pct?.toFixed(2)}%)`).join(' | ');

  const sigs = signals ?? [];
  const nBuy  = sigs.filter((s) => s.signal === 'BUY').length;
  const nSell = sigs.filter((s) => s.signal === 'SELL').length;
  const nHold = sigs.filter((s) => s.signal === 'HOLD').length;

  return `=== CONTEXTE MARCHÉ — Séance du ${lastDate} ===
Indices: ${idxTxt}
Actions: ${up} en hausse · ${down} en baisse · ${flat} stables sur ${rows.length} cotées
Top hausses: ${topHausse}
Top baisses: ${topBaisse}
Plus gros volumes: ${topVol}
Signaux du jour: ${nBuy} BUY · ${nHold} HOLD · ${nSell} SELL

Outils disponibles: get_market_snapshot, get_action_detail, get_signals, get_sector_performance, get_indices, get_obligations, get_dividends, get_events, get_notations, get_top_movers, get_fundamentals, search_company`;
}

interface ChatMsg {
  role: string;
  content: unknown;
  tool_call_id?: string;
  tool_calls?: unknown;
  name?: string;
}

async function callLLM(
  cfg: { url: string; model: string },
  key: string,
  messages: ChatMsg[],
  withTools: boolean,
) {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.15,
      ...(withTools ? { tools: TOOL_DEFS, tool_choice: 'auto' } : {}),
    }),
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

  // Choisir le 1er provider disponible
  let chosen: { url: string; model: string; key: string } | null = null;
  for (const c of ORDER) {
    const k = await resolveApiKey(c.provider);
    if (k) { chosen = { ...c, key: k }; break; }
  }
  if (!chosen) return NextResponse.json({ error: 'Aucune clé IA configurée (page Clés API).' }, { status: 503 });

  const ctx = await buildContext();
  const messages: ChatMsg[] = [
    { role: 'system', content: `${SYSTEM}\n\n${ctx}` },
    ...((body.history ?? []).slice(-8)),
    { role: 'user', content: body.question },
  ];

  try {
    // Boucle d'outils — max 5 tours pour questions complexes
    for (let turn = 0; turn < 5; turn++) {
      const json = await callLLM(chosen, chosen.key, messages, true);
      const msg = json?.choices?.[0]?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
      if (toolCalls?.length) {
        messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
        await Promise.all(
          toolCalls.map(async (tc) => {
            let parsed: Record<string, unknown> = {};
            try { parsed = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
            const result = await runTool(tc.function.name, parsed);
            messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result) });
          }),
        );
        continue;
      }

      return NextResponse.json({ answer: msg.content ?? '', provider: chosen.model });
    }

    // Dernier recours sans outils
    const finalJson = await callLLM(chosen, chosen.key, messages, false);
    return NextResponse.json({
      answer: finalJson?.choices?.[0]?.message?.content ?? 'Réponse indisponible.',
      provider: chosen.model,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur IA' }, { status: 502 });
  }
}
