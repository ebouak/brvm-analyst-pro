/**
 * Ré-extraction ciblée des fondamentaux d'une société, hors serveur Next.
 *
 * Rejoue exactement le pipeline de /api/import-batch (mêmes prompt, schéma,
 * garde-fous et persistance) pour un seul code, afin de corriger une extraction
 * fautive sans relancer les 48 sociétés.
 *
 *   npx tsx scripts/reextract.ts ETIT            # passe à blanc (n'écrit rien)
 *   npx tsx scripts/reextract.ts ETIT --write    # écrit en base
 *
 * Clés lues dans frontend/.env.local (Supabase) et scraper/.env.local (LLM).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { selectFinancialPublications, type PubRow } from '../lib/import/selectPublications';
import { fullUserPrompt, buildSystemPrompt } from '../lib/import/fullPrompt';
import { fullExtractionSchema } from '../lib/import/fullStatement';
import { checkStatement, checkBankSpecific, checkDeviseFcfa, checkActionsImplicites } from '../lib/import/fullGuardrails';
import { toRows, persistRows } from '../lib/import/fullPersist';
import type { Famille } from '../lib/financials/sectors';

/** Charge un .env sans dépendance : KEY=value, ignore commentaires et guillemets. */
function loadEnv(p: string): void {
  if (!fs.existsSync(p)) return;
  for (const ligne of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, brut] = m;
    if (process.env[k!]) continue; // ne jamais écraser l'environnement réel
    process.env[k!] = brut!.trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv(path.resolve(__dirname, '../.env.local'));
loadEnv(path.resolve(__dirname, '../../scraper/.env.local'));

const code = (process.argv[2] ?? '').toUpperCase();
const write = process.argv.includes('--write');
if (!code) { console.error('Usage: npx tsx scripts/reextract.ts <CODE> [--write]'); process.exit(1); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const llmKey = process.env.DEEPSEEK_API_KEY;
const mistralKey = process.env.MISTRAL_API_KEY ?? null;
if (!url || !serviceKey) { console.error('SUPABASE_URL / SERVICE_ROLE_KEY manquants'); process.exit(1); }
if (!llmKey) { console.error('DEEPSEEK_API_KEY manquant'); process.exit(1); }

const admin = createClient(url, serviceKey);

/**
 * Copie de lib/import/serverPdf.ts, dont l'import `server-only` ne se résout
 * pas hors runtime Next. Même logique pdfjs legacy — toute correction est à
 * reporter des deux côtés.
 */
async function fetchPdfText(pdfUrl: string): Promise<string> {
  const resp = await fetch(pdfUrl, { signal: AbortSignal.timeout(60000), redirect: 'follow' });
  if (!resp.ok) throw new Error(`PDF HTTP ${resp.status}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: buf, useSystemFonts: true, isEvalSupported: false, disableFontFace: true,
  }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    out += content.items.map((it: unknown) => (it && typeof it === 'object' && 'str' in it ? String((it as { str?: string }).str ?? '') : '')).join(' ') + '\n';
  }
  return out;
}

/**
 * Copie de lib/import/ocr.ts (meme raison : import `server-only`). Repli pour les
 * PDF scannes, dont pdfjs ne tire aucun texte — cas de CFAC exercice 2025.
 */
async function ocrPdf(pdfUrl: string, mistralKey: string): Promise<string> {
  const r = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mistralKey}` },
    body: JSON.stringify({ model: 'mistral-ocr-latest', document: { type: 'document_url', document_url: pdfUrl } }),
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) throw new Error(`OCR HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { pages?: { markdown?: string }[] };
  return (j.pages ?? []).map((pg) => pg.markdown ?? '').join('\n');
}

async function callLlm(text: string, symbol: string, famille: Famille): Promise<string | null> {
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llmKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat', temperature: 0.1, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(famille) },
        { role: 'user', content: fullUserPrompt(symbol, text) },
      ],
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) { console.error(`  LLM HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`); return null; }
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? null;
}

const fmt = (x: number | null | undefined) =>
  x == null ? '—' : new Intl.NumberFormat('fr-FR').format(x);

async function main(): Promise<void> {
  console.log(`\n=== Ré-extraction ${code} ${write ? '(ÉCRITURE)' : '(passe à blanc)'} ===\n`);

  const { data: inst } = await admin
    .from('brvm_instruments').select('code, famille_comptable').eq('code', code).single();
  if (!inst) { console.error(`${code} introuvable dans brvm_instruments`); process.exit(1); }
  const famille = (inst.famille_comptable ?? 'general') as Famille;

  const { data: pubs } = await admin
    .from('publications')
    .select('id, code, libelle, date_publication, type_publication, source_url')
    .eq('code', code);
  const selected = selectFinancialPublications((pubs ?? []) as PubRow[]);
  console.log(`famille=${famille} — ${selected.length} état(s) financier(s) retenu(s)\n`);

  for (const pub of selected) {
    console.log(`--- exercice ${pub.exercice} — ${pub.libelle}`);
    // Trace l'extracteur réellement employé : le passeport doit dire si le
    // chiffre vient d'un texte PDF ou d'une reconnaissance optique.
    let utiliseOcr = false;
    let text: string;
    try {
      text = await fetchPdfText(pub.source_url!);
    } catch (e) {
      console.error(`  PDF illisible : ${e instanceof Error ? e.message : e}`);
      continue;
    }
    console.log(`  PDF : ${text.length} caractères`);
    if (text.trim().length < 500) {
      if (!mistralKey) { console.error('  PDF scanné et MISTRAL_API_KEY absente — ignoré'); continue; }
      try {
        text = await ocrPdf(pub.source_url!, mistralKey);
        utiliseOcr = true;
        console.log(`  PDF scanné -> OCR Mistral (${text.length} caractères)`);
      } catch (e) {
        console.error(`  OCR échoué : ${e instanceof Error ? e.message : e}`);
        continue;
      }
      if (text.trim().length < 500) { console.error('  OCR insuffisant — ignoré'); continue; }
    }

    const raw = await callLlm(text, code, famille);
    if (!raw) { console.error('  LLM indisponible'); continue; }
    const parsed = fullExtractionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      for (const iss of parsed.error.issues.slice(0, 5)) {
        console.error(`  JSON invalide : ${iss.path.join('.')} — ${iss.message}`);
      }
      continue;
    }

    console.log(`  unite_source=${parsed.data.unite_source ?? '(non renseignée)'} devise_source=${parsed.data.devise_source ?? '(non renseignée)'}`);
    const dev = checkDeviseFcfa(parsed.data.devise_source);
    if (!dev.ok) { console.error(`  REJET DEVISE : ${dev.reasons.join('; ')}`); continue; }

    const act = checkActionsImplicites(parsed.data.exercices);
    if (!act.ok) { console.error(`  REJET N/N-1 : ${act.reasons.join('; ')}`); continue; }

    for (const ex of parsed.data.exercices) {
      const guard = checkStatement(ex, famille === 'banque' || parsed.data.est_banque === true);
      if (!guard.ok) { console.error(`  ${ex.periode} REJET : ${guard.reasons.join('; ')}`); continue; }
      if (famille === 'banque') {
        const bk = checkBankSpecific({
          credits_clientele: ex.lignes_specifiques?.credits_clientele ?? null,
          tresorerie: ex.tresorerie_equivalents ?? null,
          total_actifs: ex.total_actifs ?? null,
        });
        if (!bk.ok) { console.error(`  ${ex.periode} REJET banque : ${bk.reasons.join('; ')}`); continue; }
      }

      console.log(
        `  ${ex.periode} : revenu=${fmt(ex.revenu_total)} RN=${fmt(ex.resultat_net)} ` +
        `flux_expl=${fmt(ex.flux_exploitation)} tréso_fin=${fmt(ex.tresorerie_fin_periode)}`,
      );

      if (write) {
        const res = await persistRows(
          admin, code, toRows(code, ex, pub.libelle ?? pub.source_url!),
          { publicationId: pub.id, extracteur: utiliseOcr ? 'ocr-mistral' : 'deepseek-chat' },
        );
        console.log(`    -> ${res === 'written' ? 'écrit ✓' : 'protégé (pdf-verified)'}`);
      }
    }
  }
  console.log(`\n=== Terminé ${write ? '' : '(rien écrit — relancer avec --write)'} ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });
