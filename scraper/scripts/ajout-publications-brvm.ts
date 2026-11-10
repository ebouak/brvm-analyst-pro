/**
 * Ajout ponctuel de publications relevées à la main sur brvm.org
 * (pages /fr/rapports-societe-cotes/<société>), absentes de BDFIN.
 *
 *   npx tsx scripts/ajout-publications-brvm.ts            # à blanc
 *   npx tsx scripts/ajout-publications-brvm.ts --ecrire   # écrit
 *
 * Relevé du 2026-11-10. Titres recopiés tels que brvm.org les affiche ; date =
 * préfixe AAAAMMJJ du nom de fichier (la page n'en affiche pas d'autre).
 * SICC : le PDF « …exercice_2025… » est titré « Exercice 2024 » sur brvm.org et
 * contient les comptes 2024 (import 2025 rejeté le même jour) — on garde le titre.
 * IFRS de CABC volontairement absent : il relève de comptes_ifrs, pas des
 * tables SYSCOHADA.
 * Idempotent : upsert sur dedupe_hash, doublons ignorés.
 */
import '../src/polyfills.js';
import { classifyPublication } from '../src/publications/classify.js';
import { dedupeHash, upsertPublications } from '../src/publications/repository.js';

const F = 'https://www.brvm.org/sites/default/files/';

const RELEVE: { code: string; libelle: string; fichier: string }[] = [
  { code: 'SOGC', libelle: 'SOGB CI : Etats financiers SYSCOHADA - Exercice 2025', fichier: '20260422_-_etats_financiers_syscohada_-_exercice_2025_-_sogb_ci.pdf' },
  { code: 'CABC', libelle: 'SICABLE CI : Etats financiers SYSCOHADA - Exercice 2025', fichier: '20260310_-_etats_financiers_syscohada_-_exercice_2025_-_sicable_ci.pdf' },
  { code: 'CABC', libelle: "SICABLE CÔTE D'IVOIRE : Etats financiers - Exercice 2024", fichier: '20250903_-_etats_financiers_-_exercice_2024_-_sicable_ci.pdf' },
  { code: 'SICC', libelle: "SICOR CI : Rapport d'activités annuel et Etats Financiers - Exercice 2024", fichier: '20260612_-_rapport_dactivites_annuel_et_etats_financiers_-_exercice_2025_-_sicor_ci.pdf' },
  { code: 'SICC', libelle: 'SICOR CI : Rapport annuel - Exercice 2023', fichier: '20241205_-_rapport_annuel_-_exercice_2023_-_sicor_ci.pdf' },
  { code: 'SICC', libelle: 'SICOR CI : Rapport annuel - Exercice 2022', fichier: '20241205_-_rapport_annuel_-_exercice_2022_-_sicor_ci.pdf' },
  { code: 'BBGC', libelle: "BRIDGE BANK GROUP CI : Rapport d'activités - 1er semestre 2026", fichier: '20260924_-_rapport_dactivites_-_1er_semestre_2026_-_bridge_bank_group_ci.pdf' },
];

const ecrire = process.argv.includes('--ecrire');
const pubs = RELEVE.map((r) => {
  const m = /^(\d{4})(\d{2})(\d{2})_/.exec(r.fichier);
  if (!m) throw new Error(`date illisible : ${r.fichier}`);
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  return {
    code: r.code,
    date_publication: date,
    libelle: r.libelle,
    type_publication: classifyPublication(r.libelle),
    source_url: F + r.fichier,
    source: 'brvm.org',
    dedupe_hash: dedupeHash(r.code, date, r.libelle),
  };
});

// Chaque URL doit répondre avant d'être enregistrée : une adresse recopiée à
// la main peut être fausse. 10 s entre requêtes (Crawl-delay de brvm.org).
for (const p of pubs) {
  const r = await fetch(p.source_url, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
  console.log(`${r.status} ${p.code} ${p.type_publication.padEnd(16)} ${p.date_publication} ${p.libelle}`);
  if (!r.ok) throw new Error(`URL injoignable (${r.status}) : ${p.source_url}`);
  await new Promise((ok) => setTimeout(ok, 10_000));
}

if (!ecrire) {
  console.log(`\n${pubs.length} publication(s) prête(s) — rien écrit (relancer avec --ecrire).`);
} else {
  const n = await upsertPublications(pubs as never);
  console.log(`\n${n} publication(s) envoyée(s) (doublons ignorés).`);
}
