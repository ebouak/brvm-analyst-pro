import { scrapeAllNews } from './brvmNews.js';
import { scrapeSikaNews } from './sikaNews.js';
import { scrapeBrvmOrgNews } from './brvmOrgNews.js';
import { upsertNews } from '../persistence/repository.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runNews' });

export async function runNews(): Promise<void> {
  log.info('Démarrage scraping actualités (Sika Finance + brvm.org + COSUMAF)');
  // Sources : Sika Finance (marché), brvm.org (communiqués officiels), cosumaf.
  const [sika, brvmOrg, officiels] = await Promise.all([
    scrapeSikaNews(),
    scrapeBrvmOrgNews(),
    scrapeAllNews(),
  ]);

  // Dédup global par dedupe_hash.
  const byHash = new Map<string, (typeof sika)[number]>();
  for (const item of [...sika, ...brvmOrg, ...officiels]) {
    if (!byHash.has(item.dedupe_hash)) byHash.set(item.dedupe_hash, item);
  }
  const items = [...byHash.values()];

  const nb = await upsertNews(items);
  log.info(
    { nb, sika: sika.length, brvmOrg: brvmOrg.length, officiels: officiels.length },
    'Actualités insérées/ignorées',
  );
}
