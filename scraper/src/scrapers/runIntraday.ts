import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../logger.js';
import { parseBrvmPublic } from './brvmPublic.js';
import { upsertActions } from '../persistence/repository.js';

const BRVM_PUBLIC_URL = 'https://www.brvm.org/fr/cours-actions/0';

/** Récupère le HTML : réseau, ou fixture locale en mode mock. */
async function getHtml(mock: boolean): Promise<string> {
  if (mock) {
    const here = dirname(fileURLToPath(import.meta.url));
    return readFileSync(join(here, '..', '..', 'tests', 'fixtures', 'brvm-public.html'), 'utf8');
  }
  const resp = await fetch(BRVM_PUBLIC_URL, { signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`brvm.org HTTP ${resp.status}`);
  return resp.text();
}

export async function runIntraday(opts: { mock?: boolean } = {}): Promise<{ nbActions: number }> {
  const mock = opts.mock ?? false;
  const today = new Date().toISOString().slice(0, 10);
  const html = await getHtml(mock);
  const snapshot = parseBrvmPublic(html, today);
  snapshot.is_mock = mock;

  if (snapshot.actions.length === 0) {
    throw new Error('intraday : aucune action parsée (page brvm.org inattendue ?)');
  }

  if (!mock) {
    await upsertActions(snapshot);
  }
  logger.info({ nbActions: snapshot.actions.length, date: today, mock }, 'intraday terminé');
  return { nbActions: snapshot.actions.length };
}
