// Données de la vidéo « canaux » : les VRAIS chiffres de la dernière séance,
// lus en base au moment du rendu (clé PUBLIQUE, lecture seule), écrits dans
// public/canaux/donnees.json. La vidéo montre une conversation : ses chiffres
// ne sont jamais saisis à la main, et portent leur date de séance.
//
//   node canaux-prep.mjs [--env=../frontend/.env.local]
//
// Lit NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (environnement,
// sinon le fichier --env). Aucune valeur n'est affichée.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { entetesSupabase } from '../video/supabaseEntetes.mjs';
// Le texte des bulles est produit par le CODE DE PRODUCTION, pas réécrit ici :
// ce que la vidéo montre est ce que le numéro répond réellement.
import { rendreCommande } from '../frontend/lib/whatsapp/commandes.ts';
import { legendeWhatsapp } from '../video/chaineWhatsapp.mjs';

const argEnv = process.argv.find((a) => a.startsWith('--env='))?.slice(6) ?? '../frontend/.env.local';
const fichier = existsSync(argEnv) ? readFileSync(argEnv, 'utf8').replace(/^﻿/, '') : '';
const lire = (k) => process.env[k] || (fichier.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim().replace(/^"|"$/g, '');
const URL_SB = lire('NEXT_PUBLIC_SUPABASE_URL');
const CLE = lire('NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (!URL_SB || !CLE) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY introuvables (environnement ou --env).');
  process.exit(1);
}
const H = { ...entetesSupabase(CLE), 'User-Agent': 'westbourse-remotion/1.0' };
const get = async (q) => {
  const r = await fetch(`${URL_SB}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(`${q.split('?')[0]} → HTTP ${r.status}`);
  return r.json();
};

const [{ date_marche: seance }] = await get('brvm_actions_daily?select=date_marche&order=date_marche.desc&limit=1');
const lignes = await get(`brvm_actions_daily?select=code,cours_jour,variation_pct,volume,valeur_echangee&date_marche=eq.${seance}&variation_pct=not.is.null`);
const [sonatel] = await get('brvm_instruments?select=designation&code=eq.SNTS');
// Vidéo de séance réellement publiée (bucket public) et sa fiche : la légende
// de la Chaîne est recalculée par le même module que la publication du soir.
const derniere = await (await fetch(`${URL_SB}/storage/v1/object/public/seance-video/derniere.json`)).json();
const [indice] = await get(`brvm_indices_daily?select=valeur,variation_pct&code=eq.BRVMC&date_marche=eq.${seance}`);
const snts = lignes.find((l) => l.code === 'SNTS');
const palmares = [...lignes].sort((a, b) => b.variation_pct - a.variation_pct).slice(0, 3);

// Mêmes garde-fous que la vidéo de séance : sans ces chiffres, pas de rendu.
if (!snts || lignes.length < 20 || !indice) {
  console.error(`Séance ${seance} incomplète (SNTS ${snts ? 'ok' : 'absent'}, ${lignes.length} valeurs, composite ${indice ? 'ok' : 'absent'}) : rendu refusé.`);
  process.exit(1);
}

const donnees = {
  seance,
  seanceFr: new Date(`${seance}T12:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  snts: { cours: snts.cours_jour, variation: snts.variation_pct },
  palmares: palmares.map((l) => ({ code: l.code, cours: l.cours_jour, variation: l.variation_pct })),
  hausses: lignes.filter((l) => l.variation_pct > 0).length,
  baisses: lignes.filter((l) => l.variation_pct < 0).length,
  valeurs: lignes.length,
  composite: { valeur: indice.valeur, variation: indice.variation_pct },
  videoSeance: derniere.publiable ? derniere.url : null,
  legendeChaine: derniere.publiable ? legendeWhatsapp(derniere) : null,
  messages: {
    aide: rendreCommande({ type: 'aide' }, null, {}),
    cours: rendreCommande(
      { type: 'cours', valeur: 'SNTS' },
      { code: 'SNTS', societe: sonatel?.designation ?? null, seance, cours: snts.cours_jour, variation_pct: snts.variation_pct, volume: snts.volume, valeur_echangee: snts.valeur_echangee },
      {},
    ),
    palmares: rendreCommande(
      { type: 'palmares', critere: 'hausses' },
      { seance, critere: 'plus fortes hausses', valeurs_cotees: lignes.length, classement: [...lignes].sort((a, b) => b.variation_pct - a.variation_pct).slice(0, 5).map((l) => ({ code: l.code, cours: l.cours_jour, variation_pct: l.variation_pct, volume: l.volume })) },
      {},
    ),
  },
};
const dossier = fileURLToPath(new URL('./public/canaux/', import.meta.url));
mkdirSync(dossier, { recursive: true });
writeFileSync(`${dossier}donnees.json`, JSON.stringify(donnees, null, 2));
console.log(`séance ${donnees.seanceFr} · ${donnees.valeurs} valeurs · SNTS et palmarès lus en base`);
