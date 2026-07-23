/**
 * Contrôle des comptes de résultat contre Sika Finance.
 *
 *   npx tsx scripts/verify-sika.ts            # les 48 actions
 *   npx tsx scripts/verify-sika.ts ETIT CFAC  # une sélection
 *
 * Sika est une RÉFÉRENCE DE CONTRÔLE, pas une source : ce script lit, compare et
 * signale. Il n'écrit RIEN en base et ne conserve aucune valeur de Sika — c'est
 * délibéré, leur base est sous licence. Sortie : un rapport d'écarts, à arbitrer
 * à la main contre la publication de la société.
 *
 * Le tableau financier de Sika est rendu en JavaScript (societe2.min.js) : un
 * simple fetch ne le voit pas, d'où Playwright.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium, type Browser } from '@playwright/test';
import { parseSikaTable, comparerASika, suffixesSika, type EcartSika } from '../lib/verify/sika';

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

const demandes = process.argv.slice(2).map((c) => c.toUpperCase());

/** Récupère le tableau annuel d'une société, en essayant les suffixes pays. */
async function lireSika(navigateur: Browser, code: string): Promise<string[][] | null> {
  const page = await navigateur.newPage();
  try {
    for (const suffixe of suffixesSika(code)) {
      try {
        // `domcontentloaded` puis attente explicite du tableau : les régies
        // publicitaires de la page gardent des connexions ouvertes, si bien que
        // `networkidle` expire sur des fiches parfaitement rendues.
        await page.goto(`https://www.sikafinance.com/marches/societe/${code}.${suffixe}`, {
          waitUntil: 'domcontentloaded', timeout: 45000,
        });
        await page.waitForSelector('table.tabSociete', { timeout: 15000 });
      } catch { continue; }

      const lignes = await page.$$eval('table.tabSociete tr', (trs) =>
        trs.map((tr) => Array.from(tr.querySelectorAll('th,td'))
          .map((c) => (c.textContent ?? '').trim().replace(/\s+/g, ' '))),
      ).catch(() => [] as string[][]);

      // Un tableau valide porte au moins l'en-tête d'années et une rubrique.
      if (lignes.length >= 2 && lignes.some((l) => /sultat net/i.test(l[0] ?? ''))) return lignes;
    }
    return null;
  } finally {
    await page.close();
  }
}

const fmt = (x: number) => new Intl.NumberFormat('fr-FR').format(x);

async function main(): Promise<void> {
  let q = admin.from('brvm_instruments').select('code').eq('type', 'action').order('code');
  if (demandes.length) q = q.in('code', demandes);
  const { data: instruments } = await q;
  const codes = (instruments ?? []).map((r) => r.code as string);
  console.log(`\n=== Contrôle Sika — ${codes.length} société(s) ===\n`);

  const navigateur = await chromium.launch();
  const ecarts: EcartSika[] = [];
  const introuvables: string[] = [];

  try {
    for (const code of codes) {
      const brut = await lireSika(navigateur, code);
      if (!brut) { introuvables.push(code); console.log(`${code} : fiche Sika introuvable`); continue; }

      const sika = parseSikaTable(brut);
      const { data: notres } = await admin
        .from('income_statements')
        .select('periode, revenu_total, resultat_net')
        .eq('code', code).eq('type_periode', 'annuel');

      const e = comparerASika(code, notres ?? [], sika);
      ecarts.push(...e);
      console.log(
        `${code} : ${sika.length} exercice(s) chez Sika, ${(notres ?? []).length} chez nous — ` +
        (e.length ? `${e.length} ÉCART(S)` : 'concordant'),
      );
    }
  } finally {
    await navigateur.close();
  }

  console.log('\n=== Écarts à arbitrer ===');
  if (ecarts.length === 0) {
    console.log('Aucun. Nos comptes de résultat concordent avec Sika.');
  } else {
    for (const e of ecarts.sort((a, b) => b.ecartPct - a.ecartPct)) {
      console.log(
        `${e.code} ${e.annee} ${e.champ} : nous ${fmt(e.notre)} | Sika ${fmt(e.sika)} ` +
        `(écart ${e.ecartPct.toFixed(1)} %)`,
      );
    }
  }
  if (introuvables.length) console.log(`\nFiches introuvables : ${introuvables.join(', ')}`);
  console.log('\nAucune donnée Sika n’a été stockée — contrôle uniquement.');
}

main().catch((e) => { console.error(e); process.exit(1); });
