/**
 * Dividendes de référence : le Bulletin Officiel de la Cote (BRVM).
 *
 * À BLANC par défaut : lit le dernier bulletin, compare chaque « dernier
 * dividende payé » à la ligne de la base du MÊME exercice, et classe :
 *   concordant · date_manquante · montant_different · absent.
 * `--ecrire` : upsert sur (code, exercice) — contrainte de 0099/0100 — avec
 * source 'brvm-boc', base 'net' (en-tête « Rdt. Net » du bulletin) et la date
 * de paiement officielle. L'ex-date existante n'est PAS touchée : le bulletin
 * n'en publie aucune, il n'a donc rien à dire dessus.
 *
 * Exercice = année de paiement − 1 : même convention que richbourse.ts (un
 * dividende versé en 2026 rémunère l'exercice 2025).
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { sha256 } from '../utils/hash.js';
import { garderEchelle } from './operations.js';
import { listerBulletins, telechargerPdf } from '../carnet/fetch.js';
import { lireDerniersDividendes, type DividendeBoc, type ItemPdf } from './boc.js';

export type Ecart = 'concordant' | 'date_manquante' | 'montant_different' | 'absent' | 'ancien' | 'calendrier';

/** Au-delà, un « dernier dividende » ne sert plus de base de rendement : il
 *  n'est PAS inscrit (UNLC : payé en 2012 ; un rendement calculé dessus
 *  tromperait). Il reste lisible dans le rapport. */
export const ANCIENNETE_MAX_ANS = 3;

export interface LigneRapport {
  code: string;
  exercice: number;
  boc: DividendeBoc;
  base: { montant: number | null; payment_date: string | null; source: string | null; base_fiscale: string | null } | null;
  ecart: Ecart;
}

export function classer(boc: DividendeBoc, base: LigneRapport['base'], aujourdhui = new Date()): Ecart {
  if (!base || base.montant == null) {
    const limite = new Date(aujourdhui);
    limite.setUTCFullYear(limite.getUTCFullYear() - ANCIENNETE_MAX_ANS);
    return boc.date_paiement < limite.toISOString().slice(0, 10) ? 'ancien' : 'absent';
  }
  // Le calendrier officiel prime : le Bulletin ne le réécrit jamais.
  if (base.source === 'brvm-calendrier') return 'calendrier';
  if (Math.abs(base.montant - boc.montant) >= 0.01) return 'montant_different';
  return base.payment_date === boc.date_paiement ? 'concordant' : 'date_manquante';
}

async function itemsDesPages(pdf: Uint8Array): Promise<ItemPdf[][]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: pdf }).promise;
  const pages: ItemPdf[][] = [];
  let suite = false;
  for (let i = 1; i <= doc.numPages; i++) {
    const contenu = await (await doc.getPage(i)).getTextContent();
    const items: ItemPdf[] = [];
    for (const x of contenu.items) {
      if (!('str' in x) || !x.str.trim()) continue;
      items.push({ s: x.str.trim(), x: Math.round(x.transform[4]), y: Math.round(x.transform[5]) });
    }
    // La page du tableau des actions (en-tête « Dernier dividende ») et SA
    // page de continuation, seulement : ailleurs, d'autres tableaux portent
    // aussi des codes en première colonne.
    const entete = items.some((it) => it.s === 'Dernier dividende');
    if (entete || suite) pages.push(items);
    suite = entete;
  }
  return pages;
}

export async function runDividendesBoc(opts: { ecrire?: boolean } = {}): Promise<{ bulletin: string; lignes: LigneRapport[]; ecrites: number }> {
  const [dernier] = await listerBulletins();
  if (!dernier) throw new Error('aucun bulletin officiel listé');
  const lus = lireDerniersDividendes(await itemsDesPages(await telechargerPdf(dernier.url)));
  if (lus.length < 20) throw new Error(`seulement ${lus.length} dividendes lus dans ${dernier.url} : lecture suspecte, rien n'est fait`);

  const sb = getSupabase();
  const { data, error } = await sb
    .from('dividends')
    .select('code, exercice, montant, payment_date, source, base_fiscale')
    .in('code', lus.map((d) => d.code));
  if (error) throw new Error(`dividends : ${error.message}`);
  const enBase = (data ?? []) as { code: string; exercice: number | null; montant: number | null; payment_date: string | null; source: string | null; base_fiscale: string | null }[];

  const lignes: LigneRapport[] = lus.map((boc) => {
    const exercice = Number(boc.date_paiement.slice(0, 4)) - 1;
    const b = enBase.find((r) => r.code === boc.code && r.exercice === exercice) ?? null;
    const base = b ? { montant: b.montant, payment_date: b.payment_date, source: b.source, base_fiscale: b.base_fiscale } : null;
    return { code: boc.code, exercice, boc, base, ecart: classer(boc, base) };
  });

  let ecrites = 0;
  const aEcrire = lignes.filter((l) => l.ecart !== 'concordant' && l.ecart !== 'ancien' && l.ecart !== 'calendrier');
  if (opts.ecrire && aEcrire.length) {
    const bruts = aEcrire.map((l) => ({
      code: l.code,
      exercice: l.exercice,
      montant: l.boc.montant,
      payment_date: l.boc.date_paiement,
      base_fiscale: 'net',
      devise: 'XOF',
      source: 'brvm-boc',
      source_url: dernier.url,
      // Même clé que runDividends (code|exercice|montant), pour rester cohérent.
      dedupe_hash: sha256(`${l.code}|${l.exercice}|${l.boc.montant}`),
    }));
    const rows = (await garderEchelle(bruts)).map((r) => ({ ...r, dedupe_hash: sha256(`${r.code}|${r.exercice}|${r.montant}`) }));
    const { error: e } = await sb.from('dividends').upsert(rows, { onConflict: 'code,exercice' });
    if (e) throw new Error(`upsert dividends (brvm-boc) : ${e.message}`);
    ecrites = rows.length;
  }
  logger.info({ bulletin: dernier.date, lus: lus.length, a_corriger: aEcrire.length, ecrites, ecrire: Boolean(opts.ecrire) }, 'dividendes du bulletin officiel');
  return { bulletin: dernier.url, lignes, ecrites };
}
