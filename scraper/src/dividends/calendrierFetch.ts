/**
 * Accès réseau au calendrier de paiement des dividendes (brvm.org).
 *
 * Politesse : robots.txt de brvm.org → Crawl-delay 10. Une exécution fait au
 * plus 6 pages de table, 5 essais d'URL et 1 téléchargement, espacés de 10 s.
 */
import type { ItemPdf } from './boc.js';
import { lireTableEsv, urlsCandidatesCalendrier, type PaiementEsv } from './esv.js';

const BASE = 'https://www.brvm.org';
const TABLE = `${BASE}/fr/esv/paiement-de-dividendes`;
const LISTE = `${BASE}/fr/avis-calendrier-de-paiement-de-dividendes`;
const UA = 'WESTBOURSE-dividendes/1.0 (+https://www.westbourse.com ; contact ebouak@gmail.com)';
export const DELAI_MS = 10_000;
const MAX_PAGES = 6;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const requete = (url: string, method: 'GET' | 'HEAD' = 'GET') =>
  fetch(url, { method, headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });

/** Pages de la table, de la plus récente, jusqu'à atteindre un exercice antérieur. */
export async function lirePaiementsEsv(): Promise<PaiementEsv[]> {
  const tous: PaiementEsv[] = [];
  let exerciceMax: number | null = null;
  for (let p = 0; p < MAX_PAGES; p++) {
    if (p > 0) await pause(DELAI_MS);
    const r = await requete(p === 0 ? TABLE : `${TABLE}?page=${p}`);
    if (!r.ok) throw new Error(`table des paiements BRVM : HTTP ${r.status} (page ${p})`);
    const lus = lireTableEsv(await r.text());
    if (lus.length === 0) break;
    tous.push(...lus);
    exerciceMax ??= Math.max(...lus.map((l) => l.exercice));
    if (lus.some((l) => l.exercice < (exerciceMax as number))) break;
  }
  return tous;
}

/**
 * Dernier calendrier publié. D'abord par les dates d'avis de la table ; en
 * repli, le lien de la page de liste — figée au 31/03/2026, donc signalée.
 */
export async function trouverCalendrier(paiements: PaiementEsv[]): Promise<{ url: string; via: 'avis' | 'liste' }> {
  for (const url of urlsCandidatesCalendrier(paiements)) {
    await pause(DELAI_MS);
    if ((await requete(url, 'HEAD')).ok) return { url, via: 'avis' };
  }
  await pause(DELAI_MS);
  const r = await requete(LISTE);
  if (r.ok) {
    const m = /href="([^"]*_-_calendrier_de_paiement_des_dividendes_-_exercice_\d{4}\.pdf)"/i.exec(await r.text());
    if (m?.[1]) return { url: m[1].startsWith('http') ? m[1] : `${BASE}${m[1]}`, via: 'liste' };
  }
  throw new Error('aucun calendrier de paiement des dividendes trouvé sur brvm.org');
}

/** Fragments positionnés de toutes les pages (même extraction que la fixture). */
export async function telechargerCalendrier(url: string): Promise<ItemPdf[][]> {
  await pause(DELAI_MS);
  const r = await requete(url);
  if (!r.ok) throw new Error(`calendrier : HTTP ${r.status} sur ${url}`);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await r.arrayBuffer()) }).promise;
  const pages: ItemPdf[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const contenu = await (await doc.getPage(i)).getTextContent();
    const items: ItemPdf[] = [];
    for (const x of contenu.items) {
      if (!('str' in x) || !x.str.trim()) continue;
      items.push({ s: x.str.trim(), x: Math.round(x.transform[4]), y: Math.round(x.transform[5]) });
    }
    pages.push(items);
  }
  return pages;
}
