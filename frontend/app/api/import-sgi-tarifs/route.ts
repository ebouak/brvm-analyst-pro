import { NextResponse } from 'next/server';
import { createClient as createSbAdmin } from '@supabase/supabase-js';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { TEXT_PROVIDERS, VISION_PROVIDERS, parseLlmJson, type Provider } from '@/lib/import/llmProviders';
import { SGI_TARIF_SYSTEM_PROMPT, sgiTarifUserPrompt } from '@/lib/import/sgiTarifPrompt';
import { sgiTarifSchema, checkSgiTarif, sgiTarifToRow } from '@/lib/import/sgiTarifSchema';
import { getAdminContext, can } from '@/lib/server/rbac';

export const maxDuration = 60;

interface Body {
  sgiNom?: string;
  mode?: 'text' | 'vision';
  text?: string;
  images?: string[];
  sourceLabel?: string;
  persist?: boolean;
}

interface ProviderCfg {
  key: string | undefined;
  url: string;
  model: (mode: 'text' | 'vision') => string;
}

async function providers(): Promise<Record<Provider, ProviderCfg>> {
  const [deepseekKey, mistralKey, xaiKey] = await Promise.all([
    resolveApiKey('deepseek'),
    resolveApiKey('mistral'),
    resolveApiKey('xai'),
  ]);
  return {
    deepseek: { key: deepseekKey ?? undefined, url: 'https://api.deepseek.com/chat/completions', model: () => 'deepseek-chat' },
    mistral: { key: mistralKey ?? undefined, url: 'https://api.mistral.ai/v1/chat/completions', model: (m) => (m === 'vision' ? 'pixtral-large-latest' : 'mistral-large-latest') },
    grok: { key: xaiKey ?? undefined, url: 'https://api.x.ai/v1/chat/completions', model: (m) => (m === 'vision' ? 'grok-2-vision-latest' : 'grok-2-latest') },
  };
}

function buildMessages(sgiNom: string, mode: 'text' | 'vision', text?: string, images?: string[]) {
  const sys = { role: 'system', content: SGI_TARIF_SYSTEM_PROMPT };
  if (mode === 'vision' && images?.length) {
    const content: unknown[] = [{ type: 'text', text: sgiTarifUserPrompt(sgiNom) }];
    for (const img of images) content.push({ type: 'image_url', image_url: { url: img } });
    return [sys, { role: 'user', content }];
  }
  return [sys, { role: 'user', content: sgiTarifUserPrompt(sgiNom, text) }];
}

async function callProvider(cfg: ProviderCfg, sgiNom: string, mode: 'text' | 'vision', text?: string, images?: string[]) {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model(mode),
      messages: buildMessages(sgiNom, mode, text, images),
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
  // Réservé admin (permission content.write ou super-admin), sans redirection.
  const ctx = await getAdminContext();
  if (!can(ctx, 'content.write')) {
    return NextResponse.json({ error: 'Réservé à l’administration' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || !body.sgiNom || (body.mode !== 'text' && body.mode !== 'vision')) {
    return NextResponse.json({ error: 'Requête invalide (sgiNom + mode requis)' }, { status: 400 });
  }

  const cfgs = await providers();
  const order = body.mode === 'vision' ? VISION_PROVIDERS : TEXT_PROVIDERS;
  const available = order.filter((p) => cfgs[p].key);
  if (available.length === 0) {
    const msg = body.mode === 'vision'
      ? 'PDF scanné : aucune clé VISION configurée (Mistral ou Grok).'
      : 'Aucune clé LLM configurée (DeepSeek, Mistral ou Grok).';
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const errors: string[] = [];
  for (const p of available) {
    try {
      const raw = await callProvider(cfgs[p], body.sgiNom, body.mode, body.text, body.images);
      if (!raw) { errors.push(`${p}: JSON illisible`); continue; }
      const parsed = sgiTarifSchema.safeParse(raw);
      if (!parsed.success) { errors.push(`${p}: schéma invalide`); continue; }
      const guard = checkSgiTarif(parsed.data);

      // Écriture seulement si demandée ET plausible (jamais un barème hors bornes).
      let persisted = false;
      if (body.persist && guard.ok) {
        const admin = createSbAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const sourceLabel = body.sourceLabel?.trim() || `Import PDF (${p}) ${new Date().toISOString().slice(0, 10)}`;
        const row = sgiTarifToRow(body.sgiNom, parsed.data, sourceLabel, new Date().toISOString().slice(0, 10));
        const { error } = await admin.from('sgi_frais').upsert(row, { onConflict: 'sgi_nom' });
        if (error) return NextResponse.json({ error: `Écriture échouée : ${error.message}` }, { status: 500 });
        persisted = true;
      }

      return NextResponse.json({ provider: p, data: parsed.data, guard, persisted });
    } catch (e) {
      errors.push(`${p}: ${e instanceof Error ? e.message : 'erreur'}`);
    }
  }
  return NextResponse.json({ error: `Tous les fournisseurs ont échoué — ${errors.join(' ; ')}` }, { status: 502 });
}
