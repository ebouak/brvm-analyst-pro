import { scrapeAllNews } from './brvmNews.js';
import { scrapeBrvmOrgNews } from './brvmOrgNews.js';
import { upsertNews } from '../persistence/repository.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runNews' });

export async function runNews(): Promise<void> {
  log.info('Démarrage scraping actualités (brvm.org officiel + COSUMAF)');
  // Sources officielles uniquement : brvm.org (média center), cosumaf (régulateur).
  // Sika Finance supprimé (agrégateur, liens externes).
  const [brvmOrg, officiels] = await Promise.all([
    scrapeBrvmOrgNews(),
    scrapeAllNews(),
  ]);

  // Dédup global par dedupe_hash — brvm.org en priorité, complété par COSUMAF.
  const byHash = new Map<string, (typeof brvmOrg)[number]>();
  for (const item of [...brvmOrg, ...officiels]) {
    if (!byHash.has(item.dedupe_hash)) byHash.set(item.dedupe_hash, item);
  }
  const items = [...byHash.values()];

  const nb = await upsertNews(items);
  log.info(
    { nb, brvmOrg: brvmOrg.length, officiels: officiels.length },
    'Actualités insérées/ignorées',
  );
}
