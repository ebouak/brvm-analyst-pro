import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveApiKey, type LlmProvider } from '@/lib/server/apiKeys';
import { parseCopilotQuery, findSociete, normalize, type CopilotIntent, type InstrumentRef } from '@/lib/copilot/parse';
import { loadPerTrapDataset, loadDividendDataset } from '@/lib/citable/page';
import { NAV_GROUPS, PALETTE_EXTRA } from '@/lib/nav';

/**
 * Copilote ⌘K — barre de commande serveur, outillée.
 *
 * Pipeline : (1) parseur déterministe pur (lib/copilot/parse) ; (2) si échec,
 * un appel LLM UNIQUE choisit parmi 4 outils typés (zod) — la requête de
 * l'utilisateur est le seul texte envoyé au LLM, jamais de données personnelles ;
 * (3) sinon, repli vers /assistant. Les clés LLM restent côté serveur
 * (table api_keys via resolveApiKey).
 */

export const maxDuration = 30;

type CopilotResponse =
  | { action: 'navigate'; href: string; label: string }
  | { action: 'resultats'; titre: string; items: { code: string; nom: string; detail: string; href: string }[] }
  | { action: 'assistant'; href: string };

const bodySchema = z.object({ q: z.string().min(2).max(300) });

/** Routes navigables par le LLM — strictement la nav officielle (aucune URL libre). */
const PAGE_WHITELIST = new Set<string>([
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
  ...PALETTE_EXTRA.map((i) => i.href),
]);

const toolSchema = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('chercher_societe'), query: z.string().min(1).max(80) }),
  z.object({ tool: z.literal('ouvrir_page'), href: z.string().min(1).max(120) }),
  z.object({ tool: z.literal('filtrer_per'), op: z.enum(['lt', 'gt']), seuil: z.number().min(0).max(200) }),
  z.object({ tool: z.literal('filtrer_rendement'), op: z.enum(['lt', 'gt']), seuil: z.number().min(0).max(100) }),
]);
type ToolCall = z.infer<typeof toolSchema>;

// ── Exécution des filtres (données publiques, mêmes loaders que /analyses) ──

async function runFiltrePer(op: 'lt' | 'gt', seuil: number): Promise<CopilotResponse> {
  const { rows } = await loadPerTrapDataset();
  const hits = rows
    .filter((r) => r.per != null && r.per > 0 && (op === 'lt' ? r.per < seuil : r.per > seuil))
    .sort((a, b) => (a.per ?? 0) - (b.per ?? 0))
    .slice(0, 12);
  return {
    action: 'resultats',
    titre: `PER ${op === 'lt' ? '<' : '>'} ${seuil} — ${hits.length} action${hits.length > 1 ? 's' : ''}`,
    items: hits.map((r) => ({
      code: r.code,
      nom: r.nom,
      detail: `PER ${r.per!.toFixed(1)}${r.severity === 'danger' ? ' ⚠ value trap' : ''}`,
      href: `/actions/${r.code}`,
    })),
  };
}

async function runFiltreRendement(op: 'lt' | 'gt', seuil: number): Promise<CopilotResponse> {
  const { rows } = await loadDividendDataset();
  const hits = rows
    .filter((r) => (op === 'lt' ? r.rendementPct < seuil : r.rendementPct > seuil))
    .sort((a, b) => b.rendementPct - a.rendementPct)
    .slice(0, 12);
  return {
    action: 'resultats',
    titre: `Rendement net ${op === 'lt' ? '<' : '>'} ${seuil} % — ${hits.length} action${hits.length > 1 ? 's' : ''}`,
    items: hits.map((r) => ({
      code: r.code,
      nom: r.nom,
      detail: `${r.rendementPct.toFixed(1)} % net (${r.exercice})`,
      href: `/actions/${r.code}`,
    })),
  };
}

async function executeIntent(intent: CopilotIntent): Promise<CopilotResponse> {
  if (intent.type === 'navigate') return { action: 'navigate', href: intent.href, label: intent.label };
  if (intent.type === 'filtre_per') return runFiltrePer(intent.op, intent.seuil);
  return runFiltreRendement(intent.op, intent.seuil);
}

// ── Fallback LLM : un appel, sortie JSON, validée zod ────────────────────────

const LLM_ORDER: { provider: LlmProvider; url: string; model: string }[] = [
  { provider: 'deepseek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { provider: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
];

const TOOL_PROMPT = `Tu es le routeur de commandes de WESTBOURSE (analyse BRVM). Choisis UN outil pour la requête utilisateur et réponds UNIQUEMENT en JSON compact, sans markdown.
Outils :
- {"tool":"chercher_societe","query":"<nom ou code de la société>"} — la requête vise une société cotée BRVM précise.
- {"tool":"ouvrir_page","href":"<route>"} — la requête vise une page du site. Routes autorisées : __ROUTES__
- {"tool":"filtrer_per","op":"lt|gt","seuil":<n>} — filtre d'actions par PER.
- {"tool":"filtrer_rendement","op":"lt|gt","seuil":<n>} — filtre par rendement du dividende (%).
Si aucun outil ne convient, réponds {"tool":"ouvrir_page","href":"/assistant"}.`;

async function llmChooseTool(q: string): Promise<ToolCall | null> {
  const prompt = TOOL_PROMPT.replace('__ROUTES__', [...PAGE_WHITELIST].join(' '));
  for (const { provider, url, model } of LLM_ORDER) {
    const key = await resolveApiKey(provider);
    if (!key) continue;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: q },
          ],
          temperature: 0,
          max_tokens: 100,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
      const jsonText = raw.replace(/^```(?:json)?|```$/g, '').trim();
      const parsed = toolSchema.safeParse(JSON.parse(jsonText));
      if (parsed.success) return parsed.data;
    } catch {
      // provider suivant
    }
  }
  return null;
}

async function executeTool(call: ToolCall, instruments: InstrumentRef[], q: string): Promise<CopilotResponse> {
  switch (call.tool) {
    case 'chercher_societe': {
      const soc = findSociete(normalize(call.query), instruments);
      if (soc) return { action: 'navigate', href: `/actions/${soc.code}`, label: `Fiche ${soc.designation ?? soc.code}` };
      return { action: 'assistant', href: `/assistant?q=${encodeURIComponent(q)}` };
    }
    case 'ouvrir_page': {
      if (PAGE_WHITELIST.has(call.href)) {
        return { action: 'navigate', href: call.href, label: 'Ouvrir la page' };
      }
      return { action: 'assistant', href: `/assistant?q=${encodeURIComponent(q)}` };
    }
    case 'filtrer_per':
      return runFiltrePer(call.op, call.seuil);
    case 'filtrer_rendement':
      return runFiltreRendement(call.op, call.seuil);
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  const q = body.data.q.trim();

  const { data: instruments } = await supabase
    .from('brvm_instruments')
    .select('code, designation')
    .eq('type', 'action')
    .eq('actif', true);
  const refs = (instruments ?? []) as InstrumentRef[];

  // 1. Déterministe (rapide, gratuit, sans LLM).
  const intent = parseCopilotQuery(q, refs);
  if (intent) return NextResponse.json(await executeIntent(intent));

  // 2. LLM : choix d'outil typé (la requête seule est transmise).
  const call = await llmChooseTool(q);
  if (call) return NextResponse.json(await executeTool(call, refs, q));

  // 3. Repli : l'assistant conversationnel.
  const fallback: CopilotResponse = { action: 'assistant', href: `/assistant?q=${encodeURIComponent(q)}` };
  return NextResponse.json(fallback);
}
