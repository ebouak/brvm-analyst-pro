import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { checkRateLimit, getClientIp } from '@/lib/server/rateLimit';
import { TEXT_PROVIDERS, VISION_PROVIDERS, parseLlmJson, type Provider } from '@/lib/import/llmProviders';
import { RELEVE_SYSTEM_PROMPT, releveUserPrompt } from '@/lib/import/relevePrompt';
import { parseReleve, checkReleve, validateRowsToImport } from '@/lib/import/releveSchema';

export const maxDuration = 60;

/**
 * Import de relevé de compte-titres SGI (utilisateur connecté).
 * - action=analyze : texte/images du PDF → extraction LLM → positions candidates
 *   (+ mapping des codes vers brvm_instruments, sans écriture).
 * - action=persist : lignes REVUES par l'utilisateur → insertion dans son
 *   portefeuille (client user → la RLS owner-only s'applique naturellement).
 */

interface Body {
  action?: 'analyze' | 'persist';
  mode?: 'text' | 'vision';
  text?: string;
  images?: string[];
  rows?: unknown;
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

function buildMessages(mode: 'text' | 'vision', text?: string, images?: string[]) {
  const sys = { role: 'system', content: RELEVE_SYSTEM_PROMPT };
  if (mode === 'vision' && images?.length) {
    const content: unknown[] = [{ type: 'text', text: releveUserPrompt() }];
    for (const img of images) content.push({ type: 'image_url', image_url: { url: img } });
    return [sys, { role: 'user', content }];
  }
  return [sys, { role: 'user', content: releveUserPrompt(text) }];
}

async function callProvider(cfg: ProviderCfg, mode: 'text' | 'vision', text?: string, images?: string[]) {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model(mode),
      messages: buildMessages(mode, text, images),
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
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Connectez-vous pour importer un relevé' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });

  // ── Écriture des lignes revues (aucun LLM ici) ──────────────────────────
  if (body.action === 'persist') {
    const v = validateRowsToImport(body.rows);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    let inserted = 0;
    const skipped: string[] = [];
    for (const row of v.rows) {
      // Insert via client user → RLS owner-only ; FK brvm_instruments rejette
      // les codes inconnus (signalés, jamais bloquants pour le reste).
      const { error } = await supabase.from('portfolios_positions').insert({
        user_id: user.id,
        code: row.code,
        quantite: row.quantite,
        prix_entree: row.prix_entree,
        date_entree: row.date_entree,
        note: 'Importé depuis relevé SGI',
      });
      if (error) skipped.push(`${row.code} (${error.code === '23503' ? 'code inconnu' : error.message})`);
      else inserted += 1;
    }
    return NextResponse.json({ ok: true, inserted, skipped }, { status: 200 });
  }

  // ── Analyse LLM (coûteuse) : rate-limitée par IP ────────────────────────
  if (body.mode !== 'text' && body.mode !== 'vision') {
    return NextResponse.json({ error: 'Requête invalide (mode requis)' }, { status: 400 });
  }
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit({ route: 'import-releve', ip, maxHits: 10, windowSeconds: 3600 });
  if (!allowed) {
    return NextResponse.json({ error: 'Trop d’analyses — réessayez dans une heure' }, { status: 429 });
  }

  const cfgs = await providers();
  const order = body.mode === 'vision' ? VISION_PROVIDERS : TEXT_PROVIDERS;
  const available = order.filter((p) => cfgs[p].key);
  if (available.length === 0) {
    return NextResponse.json({ error: 'Analyse indisponible (aucune clé IA configurée)' }, { status: 503 });
  }

  // Référentiel des codes connus pour aider le mapping côté client.
  const pub = createPublicClient();
  const { data: instruments } = await pub
    .from('brvm_instruments')
    .select('code, libelle')
    .order('code');

  const errors: string[] = [];
  for (const p of available) {
    try {
      const raw = await callProvider(cfgs[p], body.mode, body.text, body.images);
      if (!raw) { errors.push(`${p}: JSON illisible`); continue; }
      const extraction = parseReleve(raw);
      const guard = checkReleve(extraction);
      return NextResponse.json({
        provider: p,
        extraction,
        guard,
        instruments: instruments ?? [],
      });
    } catch (e) {
      errors.push(`${p}: ${e instanceof Error ? e.message : 'erreur'}`);
    }
  }
  return NextResponse.json({ error: `Analyse échouée — ${errors.join(' ; ')}` }, { status: 502 });
}
