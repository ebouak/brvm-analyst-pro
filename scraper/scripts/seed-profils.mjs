// Génère le SQL d'import de public.societes_profils (migration 0201).
// Usage : node scripts/seed-profils.mjs > profils.sql
//         supabase db query --linked -f profils.sql
//
// Sources : data/historiques-societes.json (faits datés réécrits), data/profils-societes.json (dirigeants et actionnariat retenus selon la
// règle « officiel d'abord ») et data/presentations-societes.json (textes réécrits).
// Idempotent : upsert sur le code. Une société absente de brvm_instruments est ignorée.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const profils = JSON.parse(fs.readFileSync(path.join(dir, 'profils-societes.json'), 'utf8'));
const presentations = JSON.parse(fs.readFileSync(path.join(dir, 'presentations-societes.json'), 'utf8'));
const historiques = JSON.parse(fs.readFileSync(path.join(dir, 'historiques-societes.json'), 'utf8'));
const VERIFIE_LE = '2026-11-09';

const lit = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const tab = (a) => `array[${a.map(lit).join(',')}]::text[]`;
const js = (v) => (v == null ? 'null' : `${lit(JSON.stringify(v))}::jsonb`);

const valeurs = profils.map((p) =>
  `(${lit(p.code)}, ${lit(presentations[p.code] ?? null)}, ${tab(p.metiers ?? [])}, ${tab(p.determinants ?? [])}, ${js(p.dirigeants ?? [])}, ${js(p.actionnariat)}, ${lit(historiques[p.code] ?? null)}, ${js(p.identite ?? null)}, ${lit(p.site_web)}, ${lit(VERIFIE_LE)}::date)`);

process.stdout.write(`insert into public.societes_profils
  (code, presentation, metiers, determinants, dirigeants, actionnariat, historique, identite, site_web, verifie_le)
select v.* from (values
${valeurs.join(',\n')}
) as v(code, presentation, metiers, determinants, dirigeants, actionnariat, historique, identite, site_web, verifie_le)
where exists (select 1 from public.brvm_instruments i where i.code = v.code)
on conflict (code) do update set
  presentation = excluded.presentation, metiers = excluded.metiers, determinants = excluded.determinants,
  dirigeants = excluded.dirigeants, actionnariat = excluded.actionnariat,
  historique = excluded.historique, identite = excluded.identite, site_web = excluded.site_web,
  verifie_le = excluded.verifie_le, updated_at = now();
`);
