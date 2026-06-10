import { scrapeAllNews } from './brvmNews.js';
import { upsertNews } from '../persistence/repository.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runNews' });

export async function runNews(): Promise<void> {
  log.info('Démarrage scraping actualités BRVM + COSUMAF');
  const items = await scrapeAllNews();
  const nb = await upsertNews(items);
  log.info({ nb }, 'Actualités insérées/ignorées');
}
