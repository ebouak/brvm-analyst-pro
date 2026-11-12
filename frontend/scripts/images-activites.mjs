// Sélection des photos d'activité des documents (lot 3) : interroge Pexels
// (licence libre d'usage commercial, déjà employée par l'Academy) et télécharge
// des candidates dans un dossier de revue. Le choix final et le crédit du
// photographe sont rangés à la main dans lib/document/imagesActivite.json.
//
// Usage : node scripts/images-activites.mjs <dossier-sortie>
// La clé Pexels est lue dans api_keys (service_role de .env.local), jamais affichée.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const sortie = process.argv[2];
if (!sortie) { console.error('dossier de sortie requis'); process.exit(1); }
mkdirSync(sortie, { recursive: true });

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sb.from('api_keys').select('api_key').eq('provider', 'pexels').maybeSingle();
const cle = data?.api_key;
if (!cle) { console.error('clé Pexels introuvable'); process.exit(1); }

const ACTIVITES = {
  telecoms: 'telecommunication tower sunset city',
  banque: 'modern bank office building glass Africa',
  plantations: 'oil palm plantation aerial',
  agroalimentaire: 'food factory production line',
  energie: 'fuel station night',
  electricite: 'power lines electricity grid sunset',
  industrie: 'industrial factory steel workers',
  logistique: 'container port cranes',
  distribution: 'african market trade',
};

const resume = {};
for (const [id, q] of Object.entries(ACTIVITES)) {
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=4&orientation=portrait`, { headers: { Authorization: cle } });
  if (!r.ok) { console.log(id, 'HTTP', r.status); continue; }
  const j = await r.json();
  resume[id] = [];
  for (const [i, p] of (j.photos ?? []).entries()) {
    const url = p.src?.medium;
    const img = await fetch(url);
    writeFileSync(`${sortie}/${id}-${i + 1}.jpg`, Buffer.from(await img.arrayBuffer()));
    resume[id].push({ n: i + 1, id: p.id, photographe: p.photographer, page: p.url, original: p.src?.original, alt: p.alt });
  }
  console.log(id, resume[id].length, 'candidates');
}
writeFileSync(`${sortie}/candidates.json`, JSON.stringify(resume, null, 2));
