import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../logger.js';
import { parseBrvmPublic, parseBrvmResumeIndices } from './brvmPublic.js';
import { upsertActions, upsertIndices, upsertMarketSummary } from '../persistence/repository.js';
import type { IndiceRow } from '../types.js';

const BRVM_PUBLIC_URL = 'https://www.brvm.org/fr/cours-actions/0';
const BRVM_RESUME_URL = 'https://www.brvm.org/fr/resume';

function fixture(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, '..', '..', 'tests', 'fixtures', name), 'utf8');
}

/** Récupère le HTML des cours actions : réseau, ou fixture locale en mode mock. */
async function getHtml(mock: boolean): Promise<string> {
  if (mock) return fixture('brvm-public.html');
  const resp = await fetch(BRVM_PUBLIC_URL, { signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`brvm.org HTTP ${resp.status}`);
  return resp.text();
}

/** Récupère le HTML de la page « Résumé » (11 indices) : réseau ou fixture mock. */
async function getResumeHtml(mock: boolean): Promise<string> {
  if (mock) return fixture('brvm-resume.html');
  const resp = await fetch(BRVM_RESUME_URL, { signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`brvm.org résumé HTTP ${resp.status}`);
  return resp.text();
}

/**
 * Fusionne les indices : la page « Résumé » (11 indices, plus complète) prime ;
 * on conserve d'éventuels indices de la table « Activités du marché » non couverts.
 */
function mergeIndices(activity: IndiceRow[], resume: IndiceRow[]): IndiceRow[] {
  const byCode = new Map<string, IndiceRow>();
  for (const i of activity) byCode.set(i.code, i);
  for (const i of resume) byCode.set(i.code, i);
  return [...byCode.values()];
}

export async function runIntraday(opts: { mock?: boolean } = {}): Promise<{ nbActions: number; nbIndices: number }> {
  const mock = opts.mock ?? false;
  const today = new Date().toISOString().slice(0, 10);
  const html = await getHtml(mock);
  const snapshot = parseBrvmPublic(html, today);
  snapshot.is_mock = mock;

  if (snapshot.actions.length === 0) {
    throw new Error('intraday : aucune action parsée (page brvm.org inattendue ?)');
  }

  // Indices : on enrichit avec la page « Résumé » (11 indices vs 2 sur la page cours).
  try {
    const resumeHtml = await getResumeHtml(mock);
    const resumeIndices = parseBrvmResumeIndices(resumeHtml);
    if (resumeIndices.length > 0) {
      snapshot.indices = mergeIndices(snapshot.indices, resumeIndices);
    }
  } catch (err) {
    // Non bloquant : on conserve au minimum les indices de la table « Activités du marché ».
    logger.warn({ err: (err as Error).message }, 'intraday : page Résumé indices indisponible');
  }

  let nbSummary = 0;
  if (!mock) {
    await upsertActions(snapshot);
    if (snapshot.indices.length > 0) await upsertIndices(snapshot);
    nbSummary = await upsertMarketSummary(snapshot);
  }
  logger.info(
    { nbActions: snapshot.actions.length, nbIndices: snapshot.indices.length, nbSummary, date: today, mock },
    'intraday terminé',
  );
  return { nbActions: snapshot.actions.length, nbIndices: snapshot.indices.length };
}
