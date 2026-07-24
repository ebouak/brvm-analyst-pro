/**
 * Rattachement rétroactif de la provenance des exercices déjà en base.
 *
 *   npx tsx scripts/backfill-provenance.ts          # passe à blanc
 *   npx tsx scripts/backfill-provenance.ts --write  # écrit
 *
 * Méthode : `fundamentals.source_file` contient le libellé de la publication
 * (posé par toRows : `pub.libelle ?? pub.source_url`). On le rapproche de
 * `publications.libelle` pour retrouver le publication_id.
 *
 * Là où le rattachement échoue, la ligne est écrite avec confiance='non_trace'
 * et publication_id=null. On n'invente AUCUNE provenance : une source devinée
 * serait pire que pas de source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(p: string): void {
  if (!fs.existsSync(p)) return;
  for (const ligne of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]!]) continue;
    process.env[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv(path.resolve(__dirname, '../.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('SUPABASE_URL / SERVICE_ROLE_KEY manquants'); process.exit(1); }
const admin = createClient(url, key);
const write = process.argv.includes('--write');

const TABLES = ['income_statements', 'balance_sheets', 'cash_flow_statements'] as const;

async function main(): Promise<void> {
  console.log(`\n=== Backfill provenance ${write ? '(ÉCRITURE)' : '(passe à blanc)'} ===\n`);

  const { data: pubs } = await admin
    .from('publications').select('id, code, libelle, source_url');
  // Index par code + libellé, et par code + URL (source_file peut contenir l'un ou l'autre).
  const parLibelle = new Map<string, string>();
  for (const p of pubs ?? []) {
    if (p.libelle) parLibelle.set(`${p.code}|${p.libelle}`, p.id as string);
    if (p.source_url) parLibelle.set(`${p.code}|${p.source_url}`, p.id as string);
  }

  const { data: fundamentals } = await admin
    .from('fundamentals').select('code, year, source_file, source');

  const lignes: Record<string, unknown>[] = [];
  let rattaches = 0, orphelins = 0;

  for (const f of fundamentals ?? []) {
    const periode = String(f.year);
    const pubId = f.source_file ? parLibelle.get(`${f.code}|${f.source_file}`) ?? null : null;
    if (pubId) rattaches++; else orphelins++;

    for (const table_cible of TABLES) {
      lignes.push({
        code: f.code, periode, table_cible,
        publication_id: pubId,
        extrait_le: null,               // date d'extraction inconnue rétroactivement
        extracteur: f.source === 'pdf-verified' ? 'manuel' : null,
        confiance: pubId ? 'extrait' : 'non_trace',
      });
    }
  }

  console.log(`${rattaches} exercice(s) rattaché(s) à une publication`);
  console.log(`${orphelins} exercice(s) sans rattachement -> non_trace`);
  console.log(`${lignes.length} ligne(s) de provenance à écrire`);

  if (!write) { console.log('\nRien écrit — relancer avec --write.'); return; }

  // Par lots de 500 : PostgREST plafonne les payloads volumineux.
  for (let i = 0; i < lignes.length; i += 500) {
    const lot = lignes.slice(i, i + 500);
    const { error } = await admin
      .from('provenance_exercice').upsert(lot, { onConflict: 'code,periode,table_cible' });
    if (error) { console.error(`Lot ${i} : ${error.message}`); process.exit(1); }
  }
  console.log('\nÉcrit ✓');
}

main().catch((e) => { console.error(e); process.exit(1); });
