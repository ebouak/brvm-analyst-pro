import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSbAdmin } from '@supabase/supabase-js';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { fetchPdfText } from '@/lib/import/serverPdf';
import { ocrPdf } from '@/lib/import/ocr';
import { selectFinancialPublications, type PubRow } from '@/lib/import/selectPublications';
import { fullUserPrompt, buildSystemPrompt } from '@/lib/import/fullPrompt';
import { fullExtractionSchema } from '@/lib/import/fullStatement';
import { checkStatement, checkBankSpecific } from '@/lib/import/fullGuardrails';
import { toRows, persistRows } from '@/lib/import/fullPersist';
import type { Famille } from '@/lib/financials/sectors';

export const maxDuration = 300;

async function callLlm(text: string, symbol: string, famille: Famille): Promise<string | null> {
  const providers = [
    { key: await resolveApiKey('deepseek'), url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
    { key: await resolveApiKey('mistral'), url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  ].filter((p) => p.key);
  for (const p of providers) {
    try {
      const r = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({
          model: p.model, temperature: 0.1, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: buildSystemPrompt(famille) }, { role: 'user', content: fullUserPrompt(symbol, text) }],
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) continue;
      const j = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = j.choices?.[0]?.message?.content;
      if (content) return content;
    } catch { /* provider suivant */ }
  }
  return null;
}

export async function POST(req: Request) {
  const supa = createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user || user.email !== 'ebouak@gmail.com') {
    return NextResponse.json({ error: 'Réservé à l’administrateur' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { code?: string };
  const onlyCode = body.code?.toUpperCase();

  const admin = createSbAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  let q = admin.from('brvm_instruments').select('code, famille_comptable').eq('type', 'action');
  if (onlyCode) q = q.eq('code', onlyCode);
  const { data: instruments } = await q;
  const rows = (instruments ?? []) as Array<{ code: string; famille_comptable: Famille }>;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const log = (m: string) => controller.enqueue(encoder.encode(m + '\n'));
      for (const { code, famille_comptable: famille } of rows) {
        const { data: pubs } = await admin
          .from('publications')
          .select('id, code, libelle, date_publication, type_publication, source_url')
          .eq('code', code);
        const selected = selectFinancialPublications((pubs ?? []) as PubRow[]);
        if (selected.length === 0) { log(`${code} : aucun état financier — ignoré`); continue; }

        for (const pub of selected) {
          try {
            let text = await fetchPdfText(pub.source_url!);
            // PDF scanné (image) : pdfjs renvoie quasi rien → repli OCR Mistral.
            if (text.trim().length < 500) {
              const mistralKey = await resolveApiKey('mistral');
              if (mistralKey) {
                text = await ocrPdf(pub.source_url!, mistralKey);
                log(`${code} ex.${pub.exercice} : PDF scanné → OCR (${text.length} car)`);
              }
            }
            const raw = await callLlm(text, code, famille);
            if (!raw) { log(`${code} ex.${pub.exercice} : LLM indisponible`); continue; }
            const parsed = fullExtractionSchema.safeParse(JSON.parse(raw));
            if (!parsed.success) { log(`${code} ex.${pub.exercice} : JSON invalide`); continue; }

            for (const ex of parsed.data.exercices) {
              const guard = checkStatement(ex, parsed.data.est_banque);
              if (!guard.ok) { log(`${code} ${ex.periode} : REJET [${guard.reasons.join('; ')}]`); continue; }
              if (famille === 'banque') {
                const bk = checkBankSpecific({
                  credits_clientele: ex.lignes_specifiques?.credits_clientele ?? null,
                  tresorerie: ex.tresorerie_equivalents ?? null,
                  total_actifs: ex.total_actifs ?? null,
                });
                if (!bk.ok) { log(`${code} ${ex.periode} : REJET [${bk.reasons.join('; ')}]`); continue; }
              }
              const res = await persistRows(admin, code, toRows(code, ex, pub.libelle ?? pub.source_url!));
              log(`${code} ${ex.periode} : ${res === 'written' ? 'écrit ✓' : 'protégé (pdf-verified)'}`);
            }
          } catch (e) {
            log(`${code} ex.${pub.exercice} : ERREUR ${e instanceof Error ? e.message : 'inconnue'}`);
          }
        }
      }
      log('--- Terminé ---');
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
