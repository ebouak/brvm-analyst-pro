import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import { AFX_SOURCES, parseAfxPage, type AfricanIndexRow } from './africanIndices.js';

function fixture(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, '..', '..', 'tests', 'fixtures', name), 'utf8');
}

async function getHtml(url: string, fixtureName: string, mock: boolean): Promise<string> {
  if (mock) return fixture(fixtureName);
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WestbourseBot/1.0; +https://www.westbourse.com)' },
  });
  if (!resp.ok) throw new Error(`AFX HTTP ${resp.status} (${url})`);
  return resp.text();
}

/**
 * Collecte les indices pan-africains (GSE Ghana, NGX Nigeria, NSE Kenya)
 * depuis AFX et upsert idempotent dans african_indices_daily (code, date_marche).
 * Chaque place est indépendante : l'échec d'une page n'empêche pas les autres.
 */
export async function runAfricanIndices(opts: { mock?: boolean } = {}): Promise<{ nb: number; failures: string[] }> {
  const mock = opts.mock ?? false;
  const rows: AfricanIndexRow[] = [];
  const failures: string[] = [];

  for (const src of AFX_SOURCES) {
    try {
      const html = await getHtml(src.url, src.fixture, mock);
      rows.push(parseAfxPage(html, src));
    } catch (err) {
      failures.push(`${src.code}: ${(err as Error).message}`);
      logger.warn({ code: src.code, err: (err as Error).message }, 'african : place en échec');
    }
  }

  if (rows.length === 0) {
    throw new Error(`african : aucune place collectée — ${failures.join(' ; ')}`);
  }

  if (!mock) {
    const sb = getSupabase();
    const { error } = await sb
      .from('african_indices_daily')
      .upsert(rows, { onConflict: 'code,date_marche' });
    if (error) throw new Error(`african : upsert échoué — ${error.message}`);
  }

  logger.info(
    { nb: rows.length, codes: rows.map((r) => `${r.code}@${r.date_marche}`), failures, mock },
    'african terminé',
  );
  return { nb: rows.length, failures };
}
