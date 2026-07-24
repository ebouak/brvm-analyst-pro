/**
 * Contrôle d'intégrité et rapport de couverture de la provenance.
 *
 *   npx tsx scripts/verify-provenance.ts
 *
 * Deux contrôles :
 *  1. Intégrité — toute ligne de provenance pointe une publication existante.
 *  2. Couverture — tout exercice d'income_statements a une ligne de provenance.
 *     Les trous doivent être VISIBLES, pas silencieux : c'est précisément le
 *     défaut que ce chantier corrige.
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

async function main(): Promise<void> {
  const { data: prov } = await admin
    .from('provenance_exercice').select('code, periode, table_cible, publication_id, confiance');
  const { data: pubs } = await admin.from('publications').select('id');
  const { data: income } = await admin
    .from('income_statements').select('code, periode').eq('type_periode', 'annuel');

  const idsPubs = new Set((pubs ?? []).map((p) => p.id as string));
  const lignes = prov ?? [];

  console.log(`\n=== Provenance : ${lignes.length} ligne(s) ===\n`);

  const orphelines = lignes.filter((l) => l.publication_id && !idsPubs.has(l.publication_id as string));
  console.log(`Intégrité : ${orphelines.length} référence(s) de publication cassée(s)`);
  for (const o of orphelines.slice(0, 10)) console.log(`  ${o.code} ${o.periode} ${o.table_cible}`);

  const tracees = new Set(lignes.map((l) => `${l.code}|${l.periode}|${l.table_cible}`));
  const manquants = (income ?? []).filter(
    (r) => !tracees.has(`${r.code}|${r.periode}|income_statements`),
  );
  console.log(`\nCouverture : ${(income ?? []).length - manquants.length}/${(income ?? []).length} exercices tracés`);
  for (const m of manquants.slice(0, 20)) console.log(`  SANS PROVENANCE : ${m.code} ${m.periode}`);
  if (manquants.length > 20) console.log(`  … et ${manquants.length - 20} autre(s)`);

  const parConfiance = new Map<string, number>();
  for (const l of lignes) parConfiance.set(l.confiance as string, (parConfiance.get(l.confiance as string) ?? 0) + 1);
  console.log('\nRépartition des niveaux de confiance :');
  for (const [c, n] of [...parConfiance].sort((a, b) => b[1] - a[1])) console.log(`  ${c} : ${n}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
