/**
 * Dérivation d'événements de marché à partir de la table `publications`
 * (communiqués, états financiers, avis de convocation, notations… — 4700+ lignes
 * réelles déjà ingérées par la commande `publications`).
 *
 * C'est la source INTERNE et fiable des événements BRVM : chaque publication a
 * une date, un libellé, un type et un code émetteur résolu. On la mappe vers
 * `market_events` (idempotent par dedupe_hash — même formule que le repository),
 * ce qui rend la page Événements exhaustive sans dépendre du scraping calibré
 * des pages brvm.org.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { classifyEventType, guessSentiment } from './classify.js';
import type { MarketEvent, EventType } from './types.js';

interface PublicationRow {
  code: string;
  date_publication: string;
  libelle: string;
  type_publication: string | null;
  source_url: string | null;
  source: string | null;
}

/** Mappe le type de publication vers un type d'événement normalisé. */
function mapEventType(typePublication: string | null, libelle: string): EventType {
  // Le libellé prime pour les cas explicites (dividende, etc.).
  const byTitle = classifyEventType(libelle);
  if (byTitle !== 'autre') return byTitle;
  switch (typePublication) {
    case 'rapport':
    case 'etats_financiers':
    case 'états-financiers-annuels':
      return 'resultats';
    case 'ag':
      return 'assemblee';
    default:
      return 'autre';
  }
}

/** Niveau d'importance heuristique (1-5) pour l'ordonnancement de la page. */
function importanceFor(eventType: EventType): number {
  if (eventType === 'dividende' || eventType === 'resultats') return 3;
  if (eventType === 'assemblee' || eventType === 'admission' || eventType === 'suspension') return 2;
  return 1;
}

/**
 * Charge les publications récentes et les convertit en événements.
 * @param sinceDays fenêtre (jours) à re-synchroniser ; l'upsert idempotent
 *   absorbe les doublons, donc une fenêtre large est sans risque.
 */
export async function deriveEventsFromPublications(sinceDays = 180): Promise<MarketEvent[]> {
  const cfg = getConfig();
  if (cfg.DRY_RUN) return [];
  const sb = getSupabase();

  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
  const { data: pubs, error } = await sb
    .from('publications')
    .select('code, date_publication, libelle, type_publication, source_url, source')
    .gte('date_publication', since)
    .order('date_publication', { ascending: false });
  if (error) {
    logger.warn({ err: error.message }, 'Lecture publications échouée (dérivation événements)');
    return [];
  }
  const rows = (pubs ?? []) as PublicationRow[];
  if (rows.length === 0) return [];

  // Référentiel code → secteur/pays pour enrichir les événements.
  const codes = [...new Set(rows.map((r) => r.code))];
  const { data: instr } = await sb
    .from('brvm_instruments').select('code, secteur, pays').in('code', codes);
  const meta = new Map<string, { secteur: string | null; pays: string | null }>();
  for (const r of (instr ?? []) as { code: string; secteur: string | null; pays: string | null }[]) {
    meta.set(r.code, { secteur: r.secteur, pays: r.pays });
  }

  const events: MarketEvent[] = [];
  for (const p of rows) {
    if (!p.libelle || !p.date_publication) continue;
    const known = meta.has(p.code);
    const eventType = mapEventType(p.type_publication, p.libelle);
    const m = meta.get(p.code);
    events.push({
      event_date: p.date_publication,
      event_datetime: null,
      source: p.source || 'BDFIN',
      source_url: p.source_url,
      source_type: 'publication',
      title: p.libelle,
      summary: null,
      event_type: eventType,
      issuer_name: null,
      instrument_code: known ? p.code : null,
      sector: m?.secteur ?? null,
      country_code: m?.pays ?? null,
      importance_level: importanceFor(eventType),
      sentiment: guessSentiment(p.libelle, null),
      tags: p.type_publication ? [p.type_publication] : null,
      related_codes: known ? [p.code] : [],
    });
  }
  logger.info({ nb: events.length, sinceDays }, 'Événements dérivés des publications');
  return events;
}
