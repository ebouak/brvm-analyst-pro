/** Persistance des événements (idempotente par dedupe_hash). */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { sha256 } from '../utils/hash.js';
import type { MarketEvent } from './types.js';

export function dedupeHash(e: MarketEvent): string {
  return sha256(`${e.source_type}|${e.event_date}|${e.title}|${e.source_url ?? ''}`);
}

export async function upsertEvents(events: MarketEvent[]): Promise<number> {
  const cfg = getConfig();
  if (events.length === 0) return 0;

  if (cfg.DRY_RUN) {
    logger.warn({ count: events.length }, 'DRY_RUN — events non écrits');
    return events.length;
  }
  const sb = getSupabase();

  for (const e of events) {
    const hash = dedupeHash(e);
    const { data, error } = await sb
      .from('market_events')
      .upsert(
        {
          event_date: e.event_date,
          event_datetime: e.event_datetime,
          source: e.source,
          source_url: e.source_url,
          source_type: e.source_type,
          title: e.title,
          summary: e.summary,
          event_type: e.event_type,
          issuer_name: e.issuer_name,
          instrument_code: e.instrument_code,
          sector: e.sector,
          country_code: e.country_code,
          importance_level: e.importance_level,
          sentiment: e.sentiment,
          tags: e.tags,
          dedupe_hash: hash,
        },
        { onConflict: 'dedupe_hash' },
      )
      .select('id')
      .single();
    if (error) {
      logger.error({ err: error.message, title: e.title }, 'Upsert event échoué');
      continue;
    }
    const eventId = data?.id as string | undefined;
    if (eventId && e.related_codes.length > 0) {
      const pivot = e.related_codes.map((code) => ({
        event_id: eventId,
        instrument_code: code,
        relation_type: code === e.instrument_code ? 'emetteur' : 'concerne',
      }));
      const { error: pe } = await sb
        .from('market_event_instruments')
        .upsert(pivot, { onConflict: 'event_id,instrument_code' });
      if (pe) logger.warn({ err: pe.message }, 'Upsert pivot échoué');
    }
  }
  return events.length;
}

export async function loadInstrumentRefs(): Promise<
  { code: string; designation: string }[]
> {
  const cfg = getConfig();
  if (cfg.DRY_RUN) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('brvm_instruments')
    .select('code, designation')
    .eq('type', 'action');
  if (error) {
    logger.warn({ err: error.message }, 'Référentiel indisponible');
    return [];
  }
  return (data ?? []) as { code: string; designation: string }[];
}
