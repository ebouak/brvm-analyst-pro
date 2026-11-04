// Budget Jev générique : 20 réservations SIMULTANÉES, plafond 5, usage de test
// sur un jour fictif supprimé ensuite. Attendu : exactement 5. Aucune clé affichée.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'User-Agent': 'westbourse-verif-budget' } },
});
const cle = { usage: 'verification', jour: '1900-01-01' };
await db.from('jev_budget').delete().match(cle);
const reponses = await Promise.all(
  Array.from({ length: 20 }, () => db.rpc('jev_reserver_budget', { p_usage: cle.usage, p_plafond: 5, p_jour: cle.jour })),
);
const erreurs = reponses.filter((r) => r.error).length;
const accordees = reponses.filter((r) => r.data === true).length;
const { data: ligne } = await db.from('jev_budget').select('appels').match(cle).maybeSingle();
await db.from('jev_budget').delete().match(cle);
console.log(`réservations accordées : ${accordees}/20, erreurs : ${erreurs}, compteur : ${ligne?.appels ?? 'absent'}`);
process.exit(accordees === 5 && erreurs === 0 && ligne?.appels === 5 ? 0 : 1);
