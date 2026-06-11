import { scrapeAllNews } from './brvmNews.js';
import { scrapeSikaNews } from './sikaNews.js';
import { upsertNews } from '../persistence/repository.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runNews' });

export async function runNews(): Promise<void> {
  log.info('Démarrage scraping actualités (Sika Finance + BRVM + COSUMAF)');
  // Sika Finance est la source primaire calibrée ; brvm.org/cosumaf en complément.
  const [sika, officiels] = await Promise.all([scrapeSikaNews(), scrapeAllNews()]);

  // Dédup global par dedupe_hash (Sika prioritaire).
  const byHash = new Map<string, (typeof sika)[number]>();
  for (const item of [...sika, ...officiels]) {
    if (!byHash.has(item.dedupe_hash)) byHash.set(item.dedupe_hash, item);
  }
  const items = [...byHash.values()];

  const nb = await upsertNews(items);
  log.info({ nb, sika: sika.length, officiels: officiels.length }, 'Actualités insérées/ignorées');
}
