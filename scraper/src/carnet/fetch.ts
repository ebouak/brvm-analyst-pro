import { parseCarnet, type FragmentPdf, type LigneCarnet } from './parse.js';

/**
 * Récupération du Bulletin Officiel de la Cote et extraction du carnet.
 *
 * Politesse : le robots.txt de brvm.org impose `Crawl-delay: 10`. On ne
 * télécharge qu'un bulletin par exécution, et la découverte de son URL passe
 * par la page de liste — jamais par une URL devinée à partir d'une date, qui
 * ramènerait un 404 silencieux les jours fériés.
 */

const BASE = 'https://www.brvm.org';
const LISTE = `${BASE}/fr/bulletins-officiels-de-la-cote/0`;
const UA = 'WESTBOURSE-boc/1.0 (+https://www.westbourse.com ; contact ebouak@gmail.com)';

/** Bulletin publié : sa date de séance et l'URL de son PDF. */
export interface BulletinPublie {
  date: string;      // ISO, AAAA-MM-JJ
  url: string;
}

/** `boc_20260922_2.pdf` → `2026-09-22`. Toute autre forme est ignorée. */
export function dateDepuisNom(url: string): string | null {
  const m = /boc_(\d{4})(\d{2})(\d{2})/i.exec(url);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/**
 * Bulletins listés sur le site, du plus récent au plus ancien.
 * Fonction pure sur le HTML : testable sans réseau.
 */
export function bulletinsDepuisHtml(html: string): BulletinPublie[] {
  const vus = new Set<string>();
  const out: BulletinPublie[] = [];
  for (const m of html.matchAll(/href="([^"]*boc_\d{8}[^"]*\.pdf)"/gi)) {
    const href = m[1];
    if (!href) continue;
    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    const date = dateDepuisNom(url);
    if (!date || vus.has(date)) continue;
    vus.add(date);
    out.push({ date, url });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

async function texte(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`BOC : HTTP ${r.status} sur ${url}`);
  return r.text();
}

export async function listerBulletins(): Promise<BulletinPublie[]> {
  return bulletinsDepuisHtml(await texte(LISTE));
}

/**
 * Fragments de texte de la page du carnet d'ordres des ACTIONS.
 *
 * La page est trouvée par son contenu — le titre « MARCHE DES ACTIONS » et le
 * mot « résiduelle » — et non par son numéro : le bulletin en compte une
 * vingtaine et leur ordre peut changer d'une séance à l'autre. Les marchés des
 * droits et des obligations portent le même tableau ; seul le premier nous
 * intéresse ici.
 */
export async function fragmentsCarnet(pdf: Uint8Array): Promise<FragmentPdf[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: pdf, useSystemFonts: true }).promise;
  for (let n = 1; n <= doc.numPages; n++) {
    const contenu = await (await doc.getPage(n)).getTextContent();
    const items = contenu.items as { str: string; transform: number[] }[];
    const brut = items.map((i) => i.str).join(' ');
    if (!/MARCHE\s+DES\s+ACTIONS/i.test(brut) || !/r.siduelle/i.test(brut)) continue;
    return items
      .filter((i) => typeof i.transform?.[4] === 'number' && typeof i.transform?.[5] === 'number')
      .map((i) => ({ x: i.transform[4] as number, y: i.transform[5] as number, texte: i.str }));
  }
  throw new Error('page « MARCHE DES ACTIONS » introuvable dans le bulletin');
}

export async function telechargerPdf(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`BOC : HTTP ${r.status} sur ${url}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Carnet d'une séance : télécharge le bulletin et en extrait les lignes. */
export async function carnetDuBulletin(b: BulletinPublie): Promise<LigneCarnet[]> {
  return parseCarnet(await fragmentsCarnet(await telechargerPdf(b.url)));
}
