import { scrapeAllNews } from './brvmNews.js';
import { scrapeSikaNews } from './sikaNews.js';
import { scrapeBrvmOrgNews } from './brvmOrgNews.js';
import { upsertNews } from '../persistence/repository.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runNews' });

export async function runNews(): Promise<void> {
  log.info('Démarrage scraping actualités (brvm.org officiel + Sika Finance marché + COSUMAF)');
  // brvm.org = communiqués officiels BRVM (publication rare, liens directs brvm.org)
  // Sika Finance = actualités marché quotidiennes (liens sikafinance.com, source complémentaire)
  // Dédup : brvm.org résolu en premier → jamais écrasé par Sika
  const [brvmOrg, sika, officiels] = await Promise.all([
    scrapeBrvmOrgNews(),
    scrapeSikaNews(),
    scrapeAllNews(),
  ]);

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
