/**
 * Orchestrateur d'un run de scraping (séance courante ou date donnée).
 *
 * Pipeline :
 *   login -> scrape -> validate (qualité) -> persist -> log scrape_runs
 * avec :
 *   - retry réseau (au niveau http.ts)
 *   - fallback mock si BDFIN indisponible (et USE_MOCK / option)
 *   - journalisation systématique dans scrape_runs, même en cas d'échec
 *   - idempotence par (code, date) côté repository
 */
import { createHttpClient } from '../client/http.js';
import { login } from '../client/auth.js';
import { scrapeLatest, scrapeDate } from '../scrapers/activitesMarche.js';
import { validateSnapshot } from '../utils/validators.js';
import {
  persistSnapshot,
  logScrapeRun,
  hashAlreadySeen,
} from '../persistence/repository.js';
import { buildMockSnapshot } from '../mock/fixtures.js';
import { getConfig, assertRealRunReady } from '../config.js';
import { logger } from '../logger.js';
import type { MarketSnapshot, ScrapeStatus, MarketDate } from '../types.js';

export interface RunOptions {
  /** Date ISO ciblée ; si absent, séance courante. */
  date?: MarketDate;
  /** Force le mode mock pour ce run. */
  mock?: boolean;
}

export interface RunResult {
  status: ScrapeStatus;
  nb_actions: number;
  nb_obligations: number;
  nb_indices: number;
  date_marche: MarketDate | null;
  message: string | null;
}

export async function runDaily(opts: RunOptions = {}): Promise<RunResult> {
  const cfg = getConfig();
  const useMock = opts.mock || cfg.USE_MOCK;
  const source = useMock ? 'mock' : cfg.BDFIN_BASE_URL + cfg.BDFIN_MARKET_PATH;
  const started_at = new Date().toISOString();

  let snapshot: MarketSnapshot | null = null;
  let status: ScrapeStatus = 'failed';
  let message: string | null = null;

  try {
    if (useMock) {
      logger.warn('Mode MOCK : données fictives, pas d’appel BDFIN');
      snapshot = buildMockSnapshot(opts.date);
      status = 'mock';
    } else {
      assertRealRunReady(cfg);
      snapshot = await scrapeReal(opts);
    }

    // Contrôle qualité.
    const { issues, cleaned, hasErrors } = validateSnapshot(snapshot);
    for (const issue of issues) {
      const log = issue.level === 'error' ? logger.error : logger.warn;
      log.call(logger, { issue }, 'Problème qualité');
    }
    if (hasErrors && cfg.QUALITY_STRICT) {
      throw new Error(
        `Validation qualité échouée (QUALITY_STRICT=true) : ${issues.length} problème(s).`,
      );
    }
    snapshot = cleaned;

    // Anti-doublon de séance par hash (sauf mock).
    if (!useMock && (await hashAlreadySeen(snapshot.hash_source, snapshot.date_marche))) {
      logger.warn(
        { hash: snapshot.hash_source },
        'Hash source déjà enregistré pour cette date — séance probablement non mise à jour',
      );
    }

    // Persistance.
    const counts = await persistSnapshot(snapshot);
    if (!useMock) {
      status = hasErrors ? 'partial' : 'success';
    }

    const result: RunResult = {
      status,
      ...counts,
      date_marche: snapshot.date_marche,
      message,
    };

    await logScrapeRun({
      source,
      started_at,
      finished_at: new Date().toISOString(),
      status,
      nb_actions: counts.nb_actions,
      nb_obligations: counts.nb_obligations,
      nb_indices: counts.nb_indices,
      message_erreur: message,
      hash_source: snapshot.hash_source,
      date_marche: snapshot.date_marche,
    });

    logger.info({ result }, 'Run terminé');
    return result;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
    status = 'failed';
    logger.error({ err: message }, 'Run en échec');

    await logScrapeRun({
      source,
      started_at,
      finished_at: new Date().toISOString(),
      status,
      nb_actions: snapshot?.actions.length ?? 0,
      nb_obligations: snapshot?.obligations.length ?? 0,
      nb_indices: snapshot?.indices.length ?? 0,
      message_erreur: message,
      hash_source: snapshot?.hash_source ?? null,
      date_marche: snapshot?.date_marche ?? opts.date ?? null,
    });

    return {
      status,
      nb_actions: 0,
      nb_obligations: 0,
      nb_indices: 0,
      date_marche: opts.date ?? null,
      message,
    };
  }
}

/** Scrape réel avec login ; fallback mock si la source est injoignable. */
async function scrapeReal(opts: RunOptions): Promise<MarketSnapshot> {
  const http = createHttpClient();
  try {
    await login(http);
    return opts.date
      ? await scrapeDate(http, opts.date)
      : await scrapeLatest(http);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, 'Scrape réel impossible');
    throw err;
  }
}
