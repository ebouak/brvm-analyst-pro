/**
 * Worker brief quotidien : charge les données de la dernière séance,
 * compose le brief (compose.ts, pur), l'archive dans brief_daily et
 * l'envoie sur Telegram (canal existant alerts/channels).
 *
 * Idempotent : si le brief de la séance est déjà envoyé (sent_at non null),
 * le run est un no-op — l'étape peut donc tourner à chaque passage du cron.
 */
import { getSupabase } from '../persistence/supabase.js';
import { dispatch } from '../alerts/channels.js';
import { composeBrief } from './compose.js';
import { logger } from '../logger.js';

export interface BriefRunResult {
  status: 'sent' | 'skipped' | 'no-data' | 'failed';
  dateMarche?: string;
}

export async function runBrief(): Promise<BriefRunResult> {
  const supabase = getSupabase();

  // Dernière séance disponible
  const { data: lastRow, error: lastErr } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) {
    logger.error({ err: lastErr.message }, 'brief: lecture dernière séance impossible');
    return { status: 'failed' };
  }
  if (!lastRow) {
    logger.warn('brief: aucune séance en base');
    return { status: 'no-data' };
  }
  const dateMarche = lastRow.date_marche as string;

  // Déjà envoyé ? (idempotence)
  const { data: existing } = await supabase
    .from('brief_daily')
    .select('sent_at')
    .eq('date_marche', dateMarche)
    .maybeSingle();
  if (existing?.sent_at) {
    logger.info({ dateMarche }, 'brief: déjà envoyé pour cette séance — skip');
    return { status: 'skipped', dateMarche };
  }

  // Données de la séance
  const [{ data: actions }, { data: indices }, { data: news }] = await Promise.all([
    supabase
      .from('brvm_actions_daily')
      .select('code, variation_pct, volume')
      .eq('date_marche', dateMarche),
    supabase
      .from('brvm_indices_daily')
      .select('code, valeur, variation_pct')
      .eq('date_marche', dateMarche),
    supabase
      .from('brvm_news')
      .select('titre')
      .gte('date_publication', dateMarche)
      .order('date_publication', { ascending: false })
      .limit(2),
  ]);

  const contenu = composeBrief({
    dateMarche,
    actions: (actions ?? []) as { code: string; variation_pct: number | null; volume: number | null }[],
    indices: (indices ?? []).map((i) => ({
      code: i.code as string,
      valeur: (i as { valeur?: number | null }).valeur ?? null,
      variation_pct: i.variation_pct as number | null,
    })),
    news: (news ?? []) as { titre: string }[],
    siteUrl: process.env.SITE_URL,
  });

  if (!contenu) {
    logger.warn({ dateMarche }, 'brief: données insuffisantes — pas de brief');
    return { status: 'no-data', dateMarche };
  }

  // Envoi (Telegram si configuré, sinon console — cf. channels.ts)
  const results = await dispatch({ subject: '', body: contenu });
  const sent = results.some((r) => r.status === 'sent') || results.every((r) => r.channel === 'console');

  // Archive (upsert idempotent sur date_marche)
  const { error: upErr } = await supabase.from('brief_daily').upsert(
    {
      date_marche: dateMarche,
      contenu,
      sent_at: sent ? new Date().toISOString() : null,
    },
    { onConflict: 'date_marche' },
  );
  if (upErr) {
    logger.error({ err: upErr.message }, 'brief: échec archivage brief_daily');
    return { status: 'failed', dateMarche };
  }

  logger.info({ dateMarche, channels: results.map((r) => `${r.channel}:${r.status}`) }, 'brief envoyé');
  return { status: 'sent', dateMarche };
}
