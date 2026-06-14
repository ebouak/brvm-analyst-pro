import { NextRequest } from 'next/server';
import { resolveApiKey, type LlmProvider } from '@/lib/server/apiKeys';
import { runTool } from '@/lib/briefTools';
import { SYSTEM_PROMPT_ANALYSTE } from '@/lib/ai/prompts';
import { createClient } from '@/lib/supabase/server';

const LIQUIDITES_CODE = 'LIQUIDITES';

/**
 * Contexte portefeuille de l'utilisateur connecté (positions valorisées + P&L)
 * — injecté quand la question le concerne. Soumis à la RLS (auth.uid()).
 */
async function buildPortfolioContext(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '\n[PORTEFEUILLE] Utilisateur non connecté — impossible d\'accéder au portefeuille.';

    const { data: pos } = await supabase
      .from('portfolios_positions').select('code, quantite, prix_entree').eq('user_id', user.id);
    const rows = ((pos ?? []) as { code: string; quantite: number; prix_entree: number }[]).filter((p) => p.code !== LIQUIDITES_CODE);
    if (rows.length === 0) return '\n[PORTEFEUILLE] Aucune position enregistrée.';

    const codes = [...new Set(rows.map((r) => r.code))];
    const { data: lastDateRow } = await supabase.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
    const lastDate = (lastDateRow as { date_marche: string }[] | null)?.[0]?.date_marche ?? null;
    const priceByCode: Record<string, number> = {};
    if (lastDate) {
      const { data: q } = await supabase.from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', lastDate).in('code', codes);
      for (const x of (q ?? []) as { code: string; cours_jour: number | null }[]) if (x.cours_jour != null) priceByCode[x.code] = x.cours_jour;
    }

    let totalVal = 0, totalCost = 0;
    const lines = rows.map((p) => {
      const cours = priceByCode[p.code] ?? p.prix_entree;
      const valeur = p.quantite * cours, cost = p.quantite * p.prix_entree;
      totalVal += valeur; totalCost += cost;
      return { code: p.code, qte: p.quantite, pru: p.prix_entree, cours, valeur: Math.round(valeur), pnl: Math.round(valeur - cost), pnlPct: cost > 0 ? +(((valeur - cost) / cost) * 100).toFixed(1) : 0 };
    });
    const pnl = totalVal - totalCost;
    return `\n[PORTEFEUILLE UTILISATEUR] valorisation=${Math.round(totalVal)} FCFA · capital investi=${Math.round(totalCost)} FCFA · P&L latent=${Math.round(pnl)} FCFA (${totalCost > 0 ? ((pnl / totalCost) * 100).toFixed(1) : '0'}%)\nPositions: ${JSON.stringify(lines)}`;
  } catch {
    return '';
  }
}

function mentionsPortfolio(text: string): boolean {
  return /portefeuille|portfolio|plus-?value|mes? position|mon portefeuille|ma position|r[ée]['é]?quilibr|renforcer|mes titres|mon capital/i.test(text);
}

export const maxDuration = 60;

const ORDER: { provider: LlmProvider; url: string; model: string }[] = [
  { provider: 'deepseek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { provider: 'mistral',  url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  { provider: 'xai',      url: 'https://api.x.ai/v1/chat/completions',      model: 'grok-2-latest' },
];

// ── Détecte les codes BRVM mentionnés dans le texte ──────────────────────────

function extractCodes(text: string): string[] {
  const matches = text.toUpperCase().match(/\b[A-Z]{2,5}C?\b/g) ?? [];
  // Filtre les mots courants qui ne sont pas des codes
  const SKIP = new Set(['RSI','MACD','EMA','SMA','BUY','HOLD','SELL','BRVM','FCFA','ROE','PER']);
  return [...new Set(matches.filter((m) => !SKIP.has(m)))].slice(0, 3);
}

// ── Construit un contexte temps réel riche ────────────────────────────────────

async function buildRichContext(question: string): Promise<string> {
  const parts: string[] = [];

  try {
    // Données marché obligatoires (toujours chargées)
    const [snapshot, topMovers, signals] = await Promise.all([
      runTool('get_market_snapshot', {}),
      runTool('get_top_movers', { limit: 5 }),
      runTool('get_signals', {}),
    ]);

    const snap = snapshot as { date?: string; actions?: Array<{ code: string; variation_pct: number; valeur_echangee: number; cours_jour: number; secteur: string; signal?: string }> };
    const movers = topMovers as { date?: string; top_hausse?: unknown[]; top_baisse?: unknown[]; top_volume?: unknown[] };
    const sigs = signals as { date?: string; signals?: Array<{ code: string; signal: string; score_total: number; confiance: number; explication: string }> };

    parts.push(`=== DONNÉES TEMPS RÉEL BRVM — ${snap.date ?? 'dernière séance'} ===`);
    parts.push(`\n[MARCHÉ]\n${JSON.stringify(snap.actions?.slice(0, 47), null, 0)}`);
    parts.push(`\n[TOP MOVERS]\n${JSON.stringify(movers, null, 0)}`);
    parts.push(`\n[SIGNAUX BUY/HOLD/SELL]\n${JSON.stringify(sigs.signals?.slice(0, 20), null, 0)}`);

    // Données spécifiques à la question (indices si demandés, obligations, etc.)
    const q = question.toLowerCase();
    const fetches: Promise<void>[] = [];

    if (q.includes('indice') || q.includes('brvm10') || q.includes('composite')) {
      fetches.push(runTool('get_indices', { days: 10 }).then((d) => {
        parts.push(`\n[INDICES]\n${JSON.stringify(d, null, 0)}`);
      }));
    }
    if (q.includes('obligat') || q.includes('bond') || q.includes('taux')) {
      fetches.push(runTool('get_obligations', {}).then((d) => {
        parts.push(`\n[OBLIGATIONS]\n${JSON.stringify(d, null, 0)}`);
      }));
    }
    if (q.includes('dividende') || q.includes('rendement')) {
      fetches.push(runTool('get_dividends', {}).then((d) => {
        parts.push(`\n[DIVIDENDES]\n${JSON.stringify(d, null, 0)}`);
      }));
    }
    if (q.includes('secteur') || q.includes('sector')) {
      fetches.push(runTool('get_sector_performance', {}).then((d) => {
        parts.push(`\n[SECTEURS]\n${JSON.stringify(d, null, 0)}`);
      }));
    }
    if (q.includes('notation') || q.includes('rating') || q.includes('bloomfield') || q.includes('gcr')) {
      fetches.push(runTool('get_notations', {}).then((d) => {
        parts.push(`\n[NOTATIONS]\n${JSON.stringify(d, null, 0)}`);
      }));
    }
    if (q.includes('événement') || q.includes('evenement') || q.includes('ag ') || q.includes('résultat')) {
      fetches.push(runTool('get_events', { limit: 20 }).then((d) => {
        parts.push(`\n[ÉVÉNEMENTS]\n${JSON.stringify(d, null, 0)}`);
      }));
    }

    // Détail par société si un code est détecté
    const codes = extractCodes(question);
    for (const code of codes) {
      fetches.push(runTool('search_company', { query: code }).then(async (found) => {
        const res = found as { results?: Array<{ code: string }> };
        const match = res.results?.[0];
        if (match) {
          const detail = await runTool('get_action_detail', { code: match.code, days: 30 });
          parts.push(`\n[DÉTAIL ${match.code}]\n${JSON.stringify(detail, null, 0)}`);
        }
      }).catch(() => {}));
    }

    await Promise.all(fetches);
  } catch (e) {
    parts.push(`[Erreur chargement données: ${String(e)}]`);
  }

  parts.push(`\nINSTRUCTION ABSOLUE: Utilise UNIQUEMENT les données ci-dessus pour répondre. Ne jamais inventer de chiffres. Si la donnée n'est pas dans le contexte, dis-le clairement.`);
  return parts.join('\n');
}

// ── Streaming LLM ─────────────────────────────────────────────────────────────

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
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`${resp.status}: ${err.slice(0, 200)}`);
  }

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
  let chosen: { url: string; model: string; key: string } | null = null;
  for (const c of ORDER) {
    const key = await resolveApiKey(c.provider);
    if (key) { chosen = { url: c.url, model: c.model, key }; break; }
  }
  if (!chosen) {
    return Response.json(
      { error: 'Aucune clé IA configurée. Ajoutez DeepSeek, Mistral ou Grok dans /admin/cles-api.' },
      { status: 503 },
    );
  }

  // 2. Parser le body
  const body = await req.json().catch(() => null) as { messages?: Array<{ role: string; content: string }> } | null;
  if (!body?.messages?.length) {
    return Response.json({ error: 'messages requis' }, { status: 400 });
  }

  // 3. Charger les données temps réel BRVM + (si pertinent) le portefeuille user
  const lastQuestion = body.messages[body.messages.length - 1]?.content ?? '';
  const [marketCtx, portfolioCtx] = await Promise.all([
    buildRichContext(lastQuestion),
    mentionsPortfolio(lastQuestion) ? buildPortfolioContext() : Promise.resolve(''),
  ]);
  const ctx = marketCtx + portfolioCtx;

  // 4. Construire la conversation avec contexte données injecté
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT_ANALYSTE + '\n\n' + ctx },
    ...body.messages.slice(-8),
  ];

  // 5. Streaming
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const text of streamLLM({ url: chosen!.url, model: chosen!.model }, chosen!.key, messages)) {
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
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
