/**
 * Orchestrateur d'ingestion des événements BRVM.
 *  - mode mock : événements fictifs (dev/CI) ;
 *  - mode réel : fetch des pages de listing brvm.org, parsing, résolution
 *    des titres liés via le référentiel, upsert idempotent.
 *
 * L'ingestion est totalement découplée du frontend (§16).
 */
import { createHttpClient } from '../client/http.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { parseEventList } from './parser.js';
import { resolveCodes } from './resolve.js';
import { upsertEvents, loadInstrumentRefs } from './repository.js';
import { buildMockEvents } from './mock.js';
import type { MarketEvent, EventSourceType } from './types.js';

/** Pages de listing à ingérer (calibrer les chemins selon brvm.org). */
const SOURCES: { path: string; type: EventSourceType }[] = [
  { path: '/fr/emetteurs/type-annonces/communiques', type: 'communique' },
  { path: '/fr/marche/avis-et-publications/avis', type: 'avis' },
  { path: '/fr/informations-permanentes', type: 'info_permanente' },
];

const BRVM_BASE = 'https://www.brvm.org';

export interface EventsRunResult {
  status: 'success' | 'failed' | 'mock';
  nb_events: number;
  message: string | null;
}

export async function runEvents(opts: { mock?: boolean } = {}): Promise<EventsRunResult> {
  const cfg = getConfig();
  const useMock = opts.mock || cfg.USE_MOCK;

  try {
    let events: MarketEvent[];
    if (useMock) {
      logger.warn('Mode MOCK événements');
      events = buildMockEvents();
      await upsertEvents(events);
      return { status: 'mock', nb_events: events.length, message: null };
    }

    const refs = await loadInstrumentRefs();
    const http = createHttpClient();
    events = [];
    for (const src of SOURCES) {
      try {
        const resp = await http.get(BRVM_BASE + src.path);
        const parsed = parseEventList(resp.data, src.type, BRVM_BASE);
        for (const e of parsed) e.related_codes = resolveCodes(e, refs);
        events.push(...parsed);
      } catch (err) {
        logger.error(
          { src: src.path, err: err instanceof Error ? err.message : String(err) },
          'Source événements injoignable — on continue',
        );
      }
    }

    const nb = await upsertEvents(events);
    logger.info({ nb }, 'Ingestion événements terminée');
    return { status: 'success', nb_events: nb, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Ingestion événements en échec');
    return { status: 'failed', nb_events: 0, message };
  }
}
