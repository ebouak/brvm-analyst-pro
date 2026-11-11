import { NextResponse } from 'next/server';
import {
  TEXT_PROVIDERS, VISION_PROVIDERS, SYSTEM_PROMPT, userPrompt, parseLlmJson,
  type Provider, type ExtractRequest,
} from '@/lib/import/llmProviders';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { requireAdminApi } from '@/lib/server/adminApi';

export const maxDuration = 60;

const MAX_TEXT_CHARS = 200_000;
const MAX_IMAGES = 12;

interface ProviderCfg {
  key: string | undefined;
  url: string;
  model: (mode: 'text' | 'vision') => string;
}

async function providers(): Promise<Record<Provider, ProviderCfg>> {
  const [deepseekKey, mistralKey, xaiKey] = await Promise.all([
    resolveApiKey('deepseek'), resolveApiKey('mistral'), resolveApiKey('xai'),
  ]);
  return {
    deepseek: {
      key: deepseekKey ?? undefined,
      url: 'https://api.deepseek.com/chat/completions',
      model: () => 'deepseek-chat',
    },
    mistral: {
      key: mistralKey ?? undefined,
      url: 'https://api.mistral.ai/v1/chat/completions',
      model: (m) => (m === 'vision' ? 'mistral-small-latest' : 'mistral-small-latest'),
    },
    grok: {
      key: xaiKey ?? undefined,
      url: 'https://api.x.ai/v1/chat/completions',
      model: (m) => (m === 'vision' ? 'grok-4.6' : 'grok-4.6'),
    },
  };
}

function buildMessages(req: ExtractRequest) {
  const sys = { role: 'system', content: SYSTEM_PROMPT };
  if (req.mode === 'vision' && req.images?.length) {
    const content: unknown[] = [{ type: 'text', text: userPrompt(req.symbol, req.year) }];
    for (const img of req.images) content.push({ type: 'image_url', image_url: { url: img } });
    return [sys, { role: 'user', content }];
  }
  return [sys, { role: 'user', content: userPrompt(req.symbol, req.year, req.text) }];
}

async function callProvider(cfg: ProviderCfg, req: ExtractRequest): Promise<Record<string, unknown> | null> {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model(req.mode),
      messages: buildMessages(req),
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(55000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  return parseLlmJson(content);
}

export async function POST(request: Request) {
  // Route d'import réservée à l'administration (+ 2FA) : elle consomme le budget LLM.
  const g = await requireAdminApi('content.write');
  if ('error' in g) return g.error;

  const req = (await request.json().catch(() => null)) as ExtractRequest | null;
  if (!req || (req.mode !== 'text' && req.mode !== 'vision')) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  // Bornes de taille : sans elles, un appelant pouvait faire payer un contexte énorme.
  if (typeof req.text === 'string' && req.text.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ error: 'Texte trop volumineux' }, { status: 413 });
  }
  if (Array.isArray(req.images) && req.images.length > MAX_IMAGES) {
    return NextResponse.json({ error: 'Trop d’images' }, { status: 413 });
  }

  const cfgs = await providers();
  const order = req.mode === 'vision' ? VISION_PROVIDERS : TEXT_PROVIDERS;
  const available = order.filter((p) => cfgs[p].key);
  if (available.length === 0) {
    const msg = req.mode === 'vision'
      ? 'PDF scanné : aucune clé VISION configurée. Ajoute une clé Mistral ou Grok dans /admin/cles-api (DeepSeek ne lit pas les PDF scannés).'
      : 'Aucune clé LLM configurée. Ajoute une clé DeepSeek, Mistral ou Grok dans /admin/cles-api.';
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const errors: string[] = [];
  for (const p of available) {
    try {
      const data = await callProvider(cfgs[p], req);
      if (data) return NextResponse.json({ provider: p, data });
      errors.push(`${p}: JSON illisible`);
    } catch (e) {
      errors.push(`${p}: ${e instanceof Error ? e.message : 'erreur'}`);
    }
  }
  return NextResponse.json({ error: `Tous les fournisseurs ont échoué — ${errors.join(' ; ')}` }, { status: 502 });
}
