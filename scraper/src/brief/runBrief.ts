/**
 * Worker note de conjoncture : charge les données de la dernière séance,
 * construit les données structurées + le texte (compose.ts, pur), archive
 * dans brief_daily (contenu + data jsonb) et envoie sur Telegram —
 * en photo (image OG de la note) avec légende, repli texte simple.
 *
 * Idempotent : si la note de la séance est déjà envoyée (sent_at non null),
 * no-op — sauf avec { force: true } (CLI : brief --force).
 */
import { getSupabase } from '../persistence/supabase.js';
import { dispatch, sendWhatsApp } from '../alerts/channels.js';
import { buildBriefData, composeBriefText } from './compose.js';
import { generateBriefAudio } from './tts.js';
import { logger } from '../logger.js';

export interface BriefRunResult {
  status: 'sent' | 'skipped' | 'no-data' | 'failed';
  dateMarche?: string;
}

const SITE_URL = process.env.SITE_URL ?? 'https://frontend-zeta-ten-22.vercel.app';

/** Envoie la note en photo Telegram (image OG) ; retourne false si non configuré/échec. */
async function sendTelegramPhoto(caption: string, imageUrl: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: caption.slice(0, 1024) }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function runBrief(opts: { force?: boolean } = {}): Promise<BriefRunResult> {
  const supabase = getSupabase();

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

  if (!opts.force) {
    const { data: existing } = await supabase
      .from('brief_daily')
      .select('sent_at')
      .eq('date_marche', dateMarche)
      .maybeSingle();
    if (existing?.sent_at) {
      logger.info({ dateMarche }, 'brief: déjà envoyé pour cette séance — skip');
      return { status: 'skipped', dateMarche };
    }
  }

  const [{ data: actions }, { data: indices }, { data: news }, { data: summary }] = await Promise.all([
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
      .select('titre, source, source_url')
      .gte('date_publication', dateMarche)
      .order('date_publication', { ascending: false })
      .limit(4),
    supabase
      .from('brvm_market_summary')
      .select('valeur_transactions, capitalisation_actions, capitalisation_obligations')
      .eq('date_marche', dateMarche)
      .maybeSingle(),
  ]);

  const data = buildBriefData({
    dateMarche,
    actions: (actions ?? []) as { code: string; variation_pct: number | null; volume: number | null }[],
    indices: (indices ?? []).map((i) => ({
      code: i.code as string,
      valeur: (i as { valeur?: number | null }).valeur ?? null,
      variation_pct: i.variation_pct as number | null,
    })),
    news: (news ?? []) as { titre: string; source: string | null; source_url: string | null }[],
    marketSummary: summary ?? null,
    siteUrl: SITE_URL,
  });

  if (!data) {
    logger.warn({ dateMarche }, 'brief: données insuffisantes — pas de note');
    return { status: 'no-data', dateMarche };
  }

  const contenu = composeBriefText(data, SITE_URL);

  // Envoi : photo (image OG de la note) en priorité, sinon texte via dispatch.
  const imageUrl = `${SITE_URL}/api/og/brief?date=${dateMarche}`;
  let sent = await sendTelegramPhoto(contenu, imageUrl);
  if (!sent) {
    const results = await dispatch({ subject: '', body: contenu });
    sent = results.some((r) => r.status === 'sent') || results.every((r) => r.channel === 'console');
  } else {
    // Telegram photo OK → dispatch n'est pas appelé : on pousse quand même le
    // brief texte sur WhatsApp (canal n°1 en Afrique de l'Ouest), s'il est
    // configuré. Non bloquant : le brief est déjà considéré envoyé.
    const wa = await sendWhatsApp({ subject: '', body: contenu });
    if (wa) logger.info({ status: wa.status, error: wa.error }, 'brief: envoi WhatsApp');
  }

  // Brief AUDIO (TTS) — inactif sans OPENAI_API_KEY, jamais bloquant.
  const audioUrl = await generateBriefAudio(supabase, contenu, dateMarche);

  const { error: upErr } = await supabase.from('brief_daily').upsert(
    {
      date_marche: dateMarche,
      contenu,
      data,
      audio_url: audioUrl,
      sent_at: sent ? new Date().toISOString() : null,
    },
    { onConflict: 'date_marche' },
  );
  if (upErr) {
    logger.error({ err: upErr.message }, 'brief: échec archivage brief_daily');
    return { status: 'failed', dateMarche };
  }

  logger.info({ dateMarche, sent }, 'note de conjoncture archivée');
  return { status: 'sent', dateMarche };
}
