// GET /api/cron/rapport-highlights[?code=ORAC]
// Pré-extrait la synthèse qualitative des rapports d'activité / rapports annuels
// intégrés (option B) et la stocke dans rapport_highlights. Alimente la « Revue
// de résultats ». Protégé par CRON_SECRET. Sans ?code, traite toutes les sociétés
// disposant d'un rapport (par lots). Tolérant : une société en échec n'arrête pas le lot.
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { ocrPdf } from '@/lib/import/ocr';
import { parseLlmJson } from '@/lib/import/llmProviders';
import { classifyCompany } from '@/lib/reports/profile';
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SYSTEM =
  "Tu es analyste actions BRVM. À partir du texte d'un rapport d'activité / rapport annuel, " +
  "extrais UNIQUEMENT des faits réels présents dans le document (jamais d'invention). " +
  "Réponds en français par un objet JSON STRICT :\n" +
  '{ "synthese": "1 à 2 phrases résumant ce qui se passe dans l\'activité", ' +
  '"highlights": [{ "titre": "court", "detail": "fait chiffré ou concret" }], ' +
  '"cyclique": true|false }\n' +
  "6 highlights maximum, priorité aux chiffres (investissements, parc/clients, segments, " +
  "marchés, perspectives). 'cyclique'=true si l'activité dépend de campagnes ou de cours " +
  "de matières premières (agro). Aucun texte hors JSON.";

async function callLlm(text: string): Promise<{ synthese?: string; highlights?: unknown; cyclique?: boolean } | null> {
  const cfgs: Array<{ key: string | null; url: string; model: string }> = [
    { key: await resolveApiKey('deepseek'), url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
    { key: await resolveApiKey('mistral'), url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  ];
  for (const c of cfgs) {
    if (!c.key) continue;
    try {
      const r = await fetch(c.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}` },
        body: JSON.stringify({
          model: c.model,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `Texte du rapport :\n${text.slice(0, 28000)}` },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const parsed = parseLlmJson(j?.choices?.[0]?.message?.content ?? '');
      if (parsed) return parsed as { synthese?: string; highlights?: unknown; cyclique?: boolean };
    } catch {
      /* provider suivant */
    }
  }
  return null;
}

async function processCode(admin: ReturnType<typeof getServiceClient>, code: string, mistralKey: string) {
  // Rapport le plus pertinent : on privilégie un « Rapport Annuel Intégré », sinon le plus récent.
  const { data: pubs } = await admin
    .from('publications')
    .select('libelle, source_url, date_publication')
    .eq('code', code)
    .eq('type_publication', 'rapport')
    .order('date_publication', { ascending: false })
    .limit(10);
  const list = (pubs ?? []) as Array<{ libelle: string; source_url: string; date_publication: string }>;
  const chosen = list.find((p) => /annuel|int[ée]gr/i.test(p.libelle)) ?? list[0];
  if (!chosen?.source_url) return { code, status: 'pas-de-rapport' };

  let text = '';
  try {
    text = await ocrPdf(chosen.source_url, mistralKey);
  } catch (e) {
    return { code, status: 'ocr-echec', error: (e as Error).message };
  }
  if (text.trim().length < 200) return { code, status: 'texte-vide' };

  const out = await callLlm(text);
  if (!out) return { code, status: 'llm-echec' };

  const { data: instr } = await admin.from('brvm_instruments').select('secteur').eq('code', code).maybeSingle();
  const profil = classifyCompany(code, (instr as { secteur?: string } | null)?.secteur ?? null, FAMILLE_PAR_CODE[code]);
  const items = Array.isArray(out.highlights)
    ? (out.highlights as Array<{ titre?: string; detail?: string }>).slice(0, 6)
        .map((i) => ({ titre: String(i.titre ?? ''), detail: String(i.detail ?? '') }))
    : [];

  const { error } = await admin.from('rapport_highlights').upsert({
    code,
    profil: profil.profil,
    cyclique: out.cyclique ?? profil.cyclique,
    synthese: out.synthese ? String(out.synthese) : null,
    highlights: items,
    source_libelle: chosen.libelle,
    source_url: chosen.source_url,
    source_date: chosen.date_publication,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'code' });
  if (error) return { code, status: 'db-echec', error: error.message };
  return { code, status: 'ok', items: items.length };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const provided = bearer ?? req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret');
  if (!secret || provided !== secret) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const mistralKey = await resolveApiKey('mistral');
  if (!mistralKey) return NextResponse.json({ error: 'Clé Mistral requise (OCR).' }, { status: 503 });

  const admin = getServiceClient();
  const url = new URL(req.url);
  const one = url.searchParams.get('code');

  let codes: string[];
  if (one) {
    codes = [one.toUpperCase()];
  } else {
    // Sociétés disposant d'au moins un rapport ; lot borné (durée).
    // Priorité aux NON encore extraites, puis aux plus anciennes → chaque
    // passage (cron hebdo ou amorçage manuel) avance et rafraîchit le stock.
    const limit = Number(url.searchParams.get('limit') ?? 8);
    const [{ data: pubRows }, { data: hlRows }] = await Promise.all([
      admin.from('publications').select('code').eq('type_publication', 'rapport').limit(2000),
      admin.from('rapport_highlights').select('code, updated_at'),
    ]);
    const withRapport = [...new Set(((pubRows ?? []) as Array<{ code: string }>).map((r) => r.code))];
    const updatedAt = new Map(((hlRows ?? []) as Array<{ code: string; updated_at: string }>).map((r) => [r.code, r.updated_at]));
    codes = withRapport
      .sort((a, b) => {
        const ua = updatedAt.get(a); const ub = updatedAt.get(b);
        if (!ua && ub) return -1;            // a non extrait → priorité
        if (ua && !ub) return 1;
        if (!ua && !ub) return a.localeCompare(b);
        return ua!.localeCompare(ub!);       // plus ancien d'abord
      })
      .slice(0, limit);
  }

  const results = [];
  for (const code of codes) {
    results.push(await processCode(admin, code, mistralKey));
  }
  return NextResponse.json({ traite: results.length, results });
}
