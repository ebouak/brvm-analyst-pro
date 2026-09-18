import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import { AFX_SOURCES, parseAfxPage, type AfricanIndexRow } from './africanIndices.js';
import { decrireErreurReseau } from './diagnosticReseau.js';

/**
 * `Crawl-delay: 60` publié par https://afx.kwayisi.org/robots.txt. Les trois
 * pages étaient demandées d'affilée : on attend désormais 60 s entre deux
 * sources. Ce n'est pas qu'une politesse — un site qui publie un délai et le
 * voit ignoré est fondé à bloquer le client.
 */
export const CRAWL_DELAY_MS = 60_000;

/** Pause à observer AVANT la source d'indice `i` (aucune pour la première, ni en mock). */
export function pauseAvantSource(i: number, mock: boolean): number {
  return mock || i === 0 ? 0 : CRAWL_DELAY_MS;
}

/** Adresses résolues pour l'hôte : distingue un DNS en échec d'une connexion refusée. */
async function adressesResolues(url: string): Promise<string> {
  try {
    const res = await lookup(new URL(url).hostname, { all: true });
    return res.map((a) => `${a.address}/v${a.family}`).join(' ');
  } catch (e) {
    return `DNS en échec (${decrireErreurReseau(e).code ?? 'sans code'})`;
  }
}

function fixture(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, '..', '..', 'tests', 'fixtures', name), 'utf8');
}

async function getHtml(url: string, fixtureName: string, mock: boolean): Promise<string> {
  if (mock) return fixture(fixtureName);
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' },
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

  for (const [i, src] of AFX_SOURCES.entries()) {
    const pause = pauseAvantSource(i, mock);
    if (pause > 0) await new Promise((ok) => setTimeout(ok, pause));
    const debut = Date.now();
    try {
      const html = await getHtml(src.url, src.fixture, mock);
      rows.push(parseAfxPage(html, src));
    } catch (err) {
      // `fetch failed` seul ne dit rien : on journalise la cause réseau
      // (err.cause, codes par IP), la durée et les adresses résolues. Rien de
      // secret — l'URL et ses adresses sont publiques.
      const diag = decrireErreurReseau(err);
      const adresses = mock ? 'mock' : await adressesResolues(src.url);
      failures.push(`${src.code}: ${diag.resume}`);
      logger.warn(
        { code: src.code, err: diag.resume, cause: diag.code, tentatives: diag.tentatives, dureeMs: Date.now() - debut, adresses },
        'african : place en échec',
      );
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
