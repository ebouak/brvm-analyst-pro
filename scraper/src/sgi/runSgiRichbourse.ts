import { chromium, type Browser } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import {
  parseSgiListRows,
  parseSgiContactFiche,
  planDirectoryMerge,
  type ScrapedSgi,
  type ExistingSgiRow,
} from '../scrapers/sgiRichbourse.js';

/**
 * Scraper de l'annuaire SGI RichBourse (Playwright — le site bloque le HTTP
 * simple par anti-bot JS ; un vrai navigateur passe). ENRICHIT sgi_directory
 * sans écraser les champs curés (via planDirectoryMerge). N'écrit JAMAIS dans
 * sgi_frais : les tarifs passent par l'import PDF vision (brique 3).
 *
 * Best-effort : tente de télécharger les PDF « Consulter les tarifs » dans
 * scraper/output/sgi-tarifs/, pour un dépôt manuel ultérieur dans l'admin —
 * jamais auto-persisté. Le rapport utilisateur signale une interstitielle pub :
 * si le téléchargement échoue, on log et on continue.
 *
 * Sélecteurs de parsing testés sur fixtures (sgiRichbourse.test.ts) ; la
 * navigation reste à confirmer sur le markup réel (convention scraper projet).
 */

const BASE = 'https://www.richbourse.com';
const LIST_PATH = '/common/apprendre/liste-sgi';
const LIST_PAGES = 9; // 9 pages relevées (croisement 2026-07-02)
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const PDF_DIR = join(process.cwd(), 'output', 'sgi-tarifs');

export interface SgiScrapeResult {
  status: 'success' | 'failed';
  scraped: number;
  inserts: number;
  enrichments: number;
  pdfsSaved: number;
  message?: string;
}

function abs(href: string): string {
  return href.startsWith('http') ? href : BASE + href;
}

export async function runSgiRichbourse(opts: { mock?: boolean; withPdfs?: boolean } = {}): Promise<SgiScrapeResult> {
  const { mock = false, withPdfs = true } = opts;
  if (mock) {
    logger.info('runSgiRichbourse --mock : aucune navigation ni écriture.');
    return { status: 'success', scraped: 0, inserts: 0, enrichments: 0, pdfsSaved: 0, message: 'mock' };
  }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true, userAgent: UA });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    // 1) Liste : parcourt les pages, collecte {nom, paysIso, slug, detailUrl}.
    const listEntries: ReturnType<typeof parseSgiListRows> = [];
    const seenSlugs = new Set<string>();
    for (let p = 0; p < LIST_PAGES; p++) {
      const url = `${BASE}${LIST_PATH}?page=${p}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const rows = parseSgiListRows(await page.content());
      for (const r of rows) {
        if (!seenSlugs.has(r.slug)) {
          seenSlugs.add(r.slug);
          listEntries.push(r);
        }
      }
    }
    logger.info({ count: listEntries.length }, 'SGI listées (RichBourse)');

    // 2) Fiches détail : contacts + lien tarifs.
    const scraped: ScrapedSgi[] = [];
    const tarifTargets: { slug: string; tarifsUrl: string }[] = [];
    for (const e of listEntries) {
      try {
        await page.goto(abs(e.detailUrl), { waitUntil: 'domcontentloaded' });
        const fiche = parseSgiContactFiche(await page.content());
        scraped.push({
          nom: e.nom,
          paysIso: e.paysIso ?? fiche.paysIso,
          depotMin: fiche.depotMin,
          siteWeb: fiche.siteWeb,
          telephone: fiche.telephone,
          tarifsUrl: fiche.tarifsUrl,
          slug: e.slug,
        });
        if (fiche.tarifsUrl) tarifTargets.push({ slug: e.slug, tarifsUrl: fiche.tarifsUrl });
      } catch (err) {
        logger.warn({ slug: e.slug, err: (err as Error).message }, 'Fiche SGI échouée');
      }
    }

    // 3) Fusion annuaire (enrichit, n'écrase pas) — via fonction pure testée.
    const sb = getSupabase();
    const { data: existingRows } = await sb.from('sgi_directory').select('nom, telephone, site_web, email');
    const today = new Date().toISOString().slice(0, 10);
    const plan = planDirectoryMerge(scraped, (existingRows ?? []) as ExistingSgiRow[], today);

    if (plan.inserts.length > 0) {
      const { error } = await sb.from('sgi_directory').insert(plan.inserts);
      if (error) throw new Error(`Insert sgi_directory: ${error.message}`);
    }
    for (const enr of plan.enrichments) {
      const { error } = await sb.from('sgi_directory').update(enr.patch).eq('nom', enr.nom);
      if (error) logger.warn({ nom: enr.nom, err: error.message }, 'Enrichissement contact échoué');
    }
    logger.info({ inserts: plan.inserts.length, enrichments: plan.enrichments.length }, 'Annuaire fusionné');

    // 4) Best-effort : PDF tarifs (jamais auto-persistés en base).
    let pdfsSaved = 0;
    if (withPdfs && tarifTargets.length > 0) {
      await mkdir(PDF_DIR, { recursive: true });
      for (const t of tarifTargets) {
        try {
          // L'URL « afficher-tarifs-sgi/{id}_{slug} » renvoie DIRECTEMENT le
          // fichier (page.goto échoue avec « Download is starting ») → requête
          // HTTP du contexte navigateur (mêmes cookies anti-bot). On vérifie la
          // signature %PDF : une interstitielle HTML est ignorée, jamais écrite.
          const resp = await context.request.get(abs(t.tarifsUrl), { timeout: 30_000 });
          if (!resp.ok()) {
            logger.warn({ slug: t.slug, status: resp.status() }, 'Téléchargement tarifs non OK — ignoré');
            continue;
          }
          const buf = await resp.body();
          const contentType = resp.headers()['content-type'] ?? '';
          const isPdf = contentType.includes('pdf') || buf.subarray(0, 5).toString('latin1').startsWith('%PDF');
          if (!isPdf) {
            logger.warn({ slug: t.slug, contentType }, 'Réponse tarifs non-PDF (interstitielle ?) — ignorée');
            continue;
          }
          await writeFile(join(PDF_DIR, `${t.slug}.pdf`), buf);
          pdfsSaved++;
        } catch (err) {
          logger.warn({ slug: t.slug, err: (err as Error).message }, 'PDF tarif échoué — ignoré');
        }
      }
      logger.info({ pdfsSaved, dir: PDF_DIR }, 'PDF tarifs sauvegardés (dépôt manuel admin ensuite)');
    }

    return {
      status: 'success',
      scraped: scraped.length,
      inserts: plan.inserts.length,
      enrichments: plan.enrichments.length,
      pdfsSaved,
    };
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'runSgiRichbourse échoué');
    return { status: 'failed', scraped: 0, inserts: 0, enrichments: 0, pdfsSaved: 0, message: (err as Error).message };
  } finally {
    if (browser) await browser.close();
  }
}
