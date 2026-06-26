import { scrapeAllNews } from './brvmNews.js';
import { scrapeSikaNews } from './sikaNews.js';
import { scrapeBrvmOrgNews } from './brvmOrgNews.js';
import { upsertNews } from '../persistence/repository.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runNews' });

export async function runNews(): Promise<void> {
  log.info('Démarrage scraping actualités (brvm.org PRIORITAIRE + Sika Finance + COSUMAF)');
  // Sources : brvm.org (officiel), Sika Finance (marché), cosumaf.
  // Prioriser brvm.org : 20 articles ; Sika max 5 (complémentaire).
  const [brvmOrg, sika, officiels] = await Promise.all([
    scrapeBrvmOrgNews(),
    scrapeSikaNews(),
    scrapeAllNews(),
  ]);

  // Dédup global par dedupe_hash — brvm.org en priorité, complété par Sika puis officiels.
  const byHash = new Map<string, (typeof brvmOrg)[number]>();
  for (const item of [...brvmOrg, ...sika, ...officiels]) {
    if (!byHash.has(item.dedupe_hash)) byHash.set(item.dedupe_hash, item);
  }
  const items = [...byHash.values()];

  const nb = await upsertNews(items);
  log.info(
    { nb, brvmOrg: brvmOrg.length, sika: sika.length, officiels: officiels.length },
    'Actualités insérées/ignorées',
  );
}
