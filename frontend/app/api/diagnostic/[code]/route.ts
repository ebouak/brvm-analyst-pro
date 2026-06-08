import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSbAdmin } from '@supabase/supabase-js';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import { computeDiagnosticMetrics } from '@/lib/diagnostic/metrics';
import { buildDiagnosticPrompt } from '@/lib/diagnostic/prompt';

export const maxDuration = 120;

const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

interface ProviderCfg {
  name: string;
  key: string | undefined;
  url: string;
  model: string;
}

async function getProviders(): Promise<ProviderCfg[]> {
  const [deepseekKey, mistralKey, xaiKey] = await Promise.all([
    resolveApiKey('deepseek'), resolveApiKey('mistral'), resolveApiKey('xai'),
  ]);
  return [
    { name: 'deepseek', key: deepseekKey ?? undefined, url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
    { name: 'mistral',  key: mistralKey ?? undefined, url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
    { name: 'grok',     key: xaiKey ?? undefined, url: 'https://api.x.ai/v1/chat/completions', model: 'grok-2-latest' },
  ].filter((p) => p.key);
}

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const supa = createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: profile } = await supa.from('profiles').select('is_premium').eq('id', user.id).single();
  if (user.email !== 'ebouak@gmail.com' && !profile?.is_premium) {
    return NextResponse.json({ error: 'Abonnement Premium requis' }, { status: 403 });
  }

  const code = params.code.toUpperCase();
  const body = await req.json().catch(() => ({})) as { force?: boolean };
  const force = body.force === true;

  const admin = createSbAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Cache check
  if (!force) {
    const { data: cached } = await admin
      .from('diagnostic_reports')
      .select('markdown_content, generated_at')
      .eq('code', code)
      .single();
    if (cached && Date.now() - new Date(cached.generated_at).getTime() < MAX_AGE_MS) {
      return NextResponse.json({ markdown: cached.markdown_content, cached: true, generated_at: cached.generated_at });
    }
  }

  const data = await loadCompanyFinancials(code);
  if (!data) return NextResponse.json({ error: 'Instrument inconnu' }, { status: 404 });

  const inc_n  = data.incomeStatements[0] ?? null;
  const inc_n1 = data.incomeStatements[1] ?? null;
  const bal_n  = data.balanceSheets[0] ?? null;
  const bal_n1 = data.balanceSheets[1] ?? null;
  const cf_n   = data.cashFlowStatements[0] ?? null;
  const cf_n1  = data.cashFlowStatements[1] ?? null;
  const cours  = data.latestDaily?.cours_jour ?? null;

  const ratios = calculateFundamentals({
    coursActuel: cours,
    shares: data.instrument.shares,
    cours_bas_52s: data.latestDaily?.cours_bas_52s ?? null,
    cours_haut_52s: data.latestDaily?.cours_haut_52s ?? null,
    income: inc_n, incomePrev: inc_n1, balance: bal_n, cashflow: cf_n,
  });

  const m = computeDiagnosticMetrics({ inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, cours, capitalisation: ratios.capitalisation });

  const prompt = buildDiagnosticPrompt({
    code,
    designation: data.instrument.designation,
    secteur: data.instrument.secteur,
    cours,
    cours_bas_52s: ratios.cours_bas_52s,
    cours_haut_52s: ratios.cours_haut_52s,
    inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m,
    periode_n: inc_n?.periode ?? 'N',
    periode_n1: inc_n1?.periode ?? 'N-1',
  });

  const providerList = await getProviders();
  if (providerList.length === 0) {
    return NextResponse.json({ error: 'Aucune clé LLM configurée (DeepSeek, Mistral ou Grok requis)' }, { status: 503 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let full = '';
      let usedModel = 'unknown';

      for (const p of providerList) {
        try {
          const resp = await fetch(p.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
            body: JSON.stringify({
              model: p.model,
              stream: true,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 4096,
              temperature: 0.3,
            }),
            signal: AbortSignal.timeout(110000),
          });

          if (!resp.ok || !resp.body) continue;

          usedModel = p.name;
          const reader = resp.body.getReader();
          const dec = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = dec.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') break;
              try {
                const j = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
                const text = j.choices?.[0]?.delta?.content ?? '';
                if (text) {
                  full += text;
                  controller.enqueue(encoder.encode(text));
                }
              } catch {
                // ligne malformée, ignorer
              }
            }
          }
          break; // succès, on arrête la cascade
        } catch {
          continue; // prochain provider
        }
      }

      if (full) {
        await admin.from('diagnostic_reports').upsert(
          { code, markdown_content: full, model_used: usedModel, metrics_snapshot: m as unknown as Record<string, unknown> },
          { onConflict: 'code' },
        );
      } else {
        controller.enqueue(encoder.encode('\n\n[Erreur : tous les fournisseurs LLM ont échoué]'));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
