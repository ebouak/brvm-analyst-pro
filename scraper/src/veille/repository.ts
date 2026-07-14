import { createClient } from '@supabase/supabase-js';
import { logger } from '../logger.js';
import type { VeilleDigestRow, VeilleJobRun } from './types.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

/**
 * Upsert veille digest rows into the database
 * Handles deduplication via title+source+date_marche
 */
export async function upsertVeilleDigest(
  digests: VeilleDigestRow[],
  dateMarche: Date
): Promise<void> {
  if (digests.length === 0) {
    logger.info('No veille digests to upsert');
    return;
  }

  const dateStr = dateMarche.toISOString().split('T')[0];

  try {
    const rows = digests.map((d) => ({
      date_marche: dateStr,
      source: d.source,
      category: d.category || null,
      title: d.title,
      summary: d.summary || null,
      url: d.url || null,
      relevance_score: d.relevance_score || null,
      sentiment: d.sentiment || 'neutral',
      tags: d.tags || [],
      full_content: d.full_content || {},
      is_critical: d.is_critical || false,
    }));

    // Dédoublonnage sur la clé de conflit (title, source, date_marche) : Postgres
    // refuse deux lignes de même clé dans un seul upsert (« ON CONFLICT DO UPDATE
    // cannot affect row a second time »). Les flux RSS partagent parfois un même
    // article (ex. RFI Afrique / RFI Économie).
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      const k = `${r.title}|${r.source}|${r.date_marche}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const { error } = await supabase
      .from('brvm_veille_digest')
      .upsert(deduped, {
        onConflict: 'title,source,date_marche', // Natural key for dedup
      });

    if (error) {
      logger.error(
        { error, digestCount: digests.length },
        'Failed to upsert veille digests'
      );
      throw error;
    }

    // Un upsert SANS `.select()` renvoie `data: null` : l'ancien log affichait donc
    // « stored: 0 » à chaque exécution réussie — il mentait. On journalise ce qu'on
    // a réellement envoyé (l'erreur ayant déjà levé, ces lignes SONT écrites).
    logger.info(
      { stored: deduped.length, total: digests.length },
      'Veille digests stored'
    );
  } catch (err) {
    logger.error(
      { err, digestCount: digests.length },
      'Error upserting veille digests'
    );
    throw err;
  }
}

/**
 * Record a veille job run for monitoring
 */
export async function recordVeilleJobRun(run: VeilleJobRun): Promise<void> {
  try {
    const { error } = await supabase
      .from('brvm_veille_job_runs')
      .insert([
        {
          date_marche: run.date_marche,
          source: run.source,
          status: run.status,
          items_fetched: run.items_fetched,
          items_stored: run.items_stored,
          errors_count: run.errors_count,
          error_message: run.error_message || null,
          duration_ms: run.duration_ms,
          metadata: run.metadata || {},
        },
      ]);

    if (error) {
      logger.error(
        { error, source: run.source },
        'Failed to record veille job run'
      );
      throw error;
    }

    logger.info(
      { source: run.source, status: run.status, duration: run.duration_ms },
      'Veille job run recorded'
    );
  } catch (err) {
    logger.error(
      { err, source: run.source },
      'Error recording veille job run'
    );
    throw err;
  }
}

/**
 * Create a veille alert from a digest entry
 */
export async function createVeilleAlert(
  digestId: number,
  alertType: string,
  severity: string,
  description: string,
  recommendedAction?: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('brvm_veille_alerts')
      .insert([
        {
          digest_id: digestId,
          alert_type: alertType,
          severity,
          description,
          recommended_action: recommendedAction || null,
        },
      ]);

    if (error) {
      logger.error(
        { error, digestId },
        'Failed to create veille alert'
      );
      throw error;
    }

    logger.info(
      { digestId, alertType, severity },
      'Veille alert created'
    );
  } catch (err) {
    logger.error(
      { err, digestId },
      'Error creating veille alert'
    );
    throw err;
  }
}

/**
 * Fetch recent veille digests by source
 */
export async function getRecentVeilleDigests(
  source?: string,
  limit: number = 50
): Promise<VeilleDigestRow[]> {
  try {
    let query = supabase
      .from('brvm_veille_digest')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (source) {
      query = query.eq('source', source);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error, source },
        'Failed to fetch veille digests'
      );
      throw error;
    }

    return data || [];
  } catch (err) {
    logger.error(
      { err, source },
      'Error fetching veille digests'
    );
    return [];
  }
}

/**
 * Fetch critical veille alerts
 */
export async function getCriticalVeilleAlerts(
  limit: number = 20
): Promise<
  Array<{
    id: number;
    digest_id: number;
    alert_type: string;
    severity: string;
    description: string;
    recommended_action: string;
  }>
> {
  try {
    const { data, error } = await supabase
      .from('brvm_veille_alerts')
      .select('*')
      .eq('acknowledged_at', null) // Unacknowledged only
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(
        { error },
        'Failed to fetch critical veille alerts'
      );
      throw error;
    }

    return data || [];
  } catch (err) {
    logger.error(
      { err },
      'Error fetching critical veille alerts'
    );
    return [];
  }
}

/**
 * Acknowledge a veille alert
 */
export async function acknowledgeVeilleAlert(
  alertId: number,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('brvm_veille_alerts')
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', alertId);

    if (error) {
      logger.error(
        { error, alertId },
        'Failed to acknowledge veille alert'
      );
      throw error;
    }

    logger.info(
      { alertId, userId },
      'Veille alert acknowledged'
    );
  } catch (err) {
    logger.error(
      { err, alertId },
      'Error acknowledging veille alert'
    );
    throw err;
  }
}
