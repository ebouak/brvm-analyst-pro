/**
 * Worker « brief:whatsapp » — envoie la note de conjoncture du jour aux
 * utilisateurs ayant opté pour WhatsApp (notification_prefs, consentement
 * explicite RGPD). Idempotent : notifications_log fait foi (pas de renvoi).
 *
 * Production : template Meta pré-approuvé `daily_brief` ({{1}}=date, {{2}}=texte).
 * Repli : texte libre (fenêtre 24 h) si le template échoue. Sans secrets Meta,
 * les envois renvoient null → run 'success' avec 0 envoi (jamais bloquant).
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { sendWhatsAppTemplate, sendWhatsAppRaw } from '../alerts/channels.js';

export interface BriefWhatsappRunResult {
  status: 'success' | 'failed' | 'mock' | 'no-brief';
  dateMarche: string | null;
  recipients: number;
  sent: number;
  skippedAlreadySent: number;
  message: string | null;
}

export interface WhatsappPref {
  user_id: string;
  whatsapp_phone: string | null;
  whatsapp_optin: boolean;
  brief_whatsapp: boolean;
}

/** Destinataires valides : opt-in + brief activé + numéro E.164 plausible. */
export function selectRecipients(prefs: WhatsappPref[]): { user_id: string; phone: string }[] {
  return prefs
    .filter((p) => p.whatsapp_optin && p.brief_whatsapp && p.whatsapp_phone)
    .map((p) => ({ user_id: p.user_id, phone: p.whatsapp_phone!.trim() }))
    .filter((p) => /^\+\d{8,15}$/.test(p.phone));
}

/**
 * Corps du brief pour WhatsApp : ≤ maxLen caractères (marge variable template),
 * coupe proprement à la fin d'une phrase quand c'est possible.
 */
export function formatBriefForWhatsApp(contenu: string, maxLen = 950): string {
  const clean = contenu.trim();
  if (clean.length <= maxLen) return clean;
  const slice = clean.slice(0, maxLen);
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'));
  return (lastStop > maxLen * 0.6 ? slice.slice(0, lastStop + 1) : slice.trimEnd()) + ' …';
}

/** Marqueur d'idempotence journalisé dans notifications_log.message. */
export function briefMarker(dateMarche: string): string {
  return `Brief ${dateMarche} (WhatsApp)`;
}

export async function runBriefWhatsapp(
  opts: { mock?: boolean } = {},
): Promise<BriefWhatsappRunResult> {
  const cfg = getConfig();
  if (opts.mock || cfg.USE_MOCK) {
    const body = formatBriefForWhatsApp('BRVM stable. Volumes en hausse sur SNTS. '.repeat(40));
    logger.warn({ preview: body.slice(0, 80), len: body.length }, 'Mode MOCK brief:whatsapp — aucun envoi');
    return { status: 'mock', dateMarche: null, recipients: 1, sent: 1, skippedAlreadySent: 0, message: null };
  }

  try {
    const sb = getSupabase();

    // 1. Brief du jour (dernière note archivée).
    const { data: briefRow, error: bErr } = await sb
      .from('brief_daily')
      .select('date_marche, contenu')
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bErr) throw new Error(`Lecture brief_daily : ${bErr.message}`);
    if (!briefRow?.contenu) {
      logger.info('brief:whatsapp — aucun brief à envoyer');
      return { status: 'no-brief', dateMarche: null, recipients: 0, sent: 0, skippedAlreadySent: 0, message: null };
    }
    const dateMarche = briefRow.date_marche as string;
    const body = formatBriefForWhatsApp(briefRow.contenu as string);
    const marker = briefMarker(dateMarche);

    // 2. Destinataires opt-in.
    const { data: prefsRaw, error: pErr } = await sb
      .from('notification_prefs')
      .select('user_id, whatsapp_phone, whatsapp_optin, brief_whatsapp')
      .eq('whatsapp_optin', true)
      .eq('brief_whatsapp', true);
    if (pErr) throw new Error(`Lecture notification_prefs : ${pErr.message}`);
    const recipients = selectRecipients((prefsRaw ?? []) as WhatsappPref[]);
    if (recipients.length === 0) {
      return { status: 'success', dateMarche, recipients: 0, sent: 0, skippedAlreadySent: 0, message: 'aucun opt-in' };
    }

    // 3. Idempotence : qui a déjà reçu CE brief ?
    const { data: logs } = await sb
      .from('notifications_log')
      .select('user_id')
      .eq('channel', 'whatsapp')
      .eq('message', marker)
      .in('user_id', recipients.map((r) => r.user_id));
    const dejaEnvoye = new Set(((logs ?? []) as { user_id: string }[]).map((l) => l.user_id));

    // 4. Envois (template d'abord, repli texte), journalisation.
    let sent = 0;
    for (const r of recipients) {
      if (dejaEnvoye.has(r.user_id)) continue;
      let res = await sendWhatsAppTemplate(r.phone, 'daily_brief', [dateMarche, body]);
      if (res?.status !== 'sent') {
        res = (await sendWhatsAppRaw(r.phone, `Brief BRVM du ${dateMarche}\n\n${body}`)) ?? res;
      }
      if (!res) continue; // secrets Meta absents : rien à journaliser.
      if (res.status === 'sent') sent++;
      if (!cfg.DRY_RUN) {
        await sb.from('notifications_log').insert({
          user_id: r.user_id,
          alert_id: null,
          code: null,
          channel: 'whatsapp',
          message: marker,
          status: res.status,
        });
      }
    }

    logger.info(
      { dateMarche, recipients: recipients.length, sent, deja: dejaEnvoye.size },
      'brief:whatsapp terminé',
    );
    return {
      status: 'success',
      dateMarche,
      recipients: recipients.length,
      sent,
      skippedAlreadySent: dejaEnvoye.size,
      message: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'brief:whatsapp en échec');
    return { status: 'failed', dateMarche: null, recipients: 0, sent: 0, skippedAlreadySent: 0, message };
  }
}
