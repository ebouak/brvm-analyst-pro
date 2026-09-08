/**
 * Canaux de notification pluggables. Chaque canal lit sa config en variables
 * d'environnement. En l'absence de config, on retombe sur le canal "console"
 * (log), de sorte que le worker fonctionne toujours en dev/CI sans secret.
 *
 * Aucune dépendance externe : email via API HTTP (Resend), Telegram via Bot API,
 * tous deux par fetch. Si non configurés -> console.
 */
import { logger } from '../logger.js';

export interface Notification {
  to?: string | null;        // email destinataire (si email)
  subject: string;
  body: string;
  code?: string | null;
  /**
   * Conversation Telegram destinataire (notification_prefs.telegram_chat_id).
   * Absent = aucun envoi Telegram, SAUF si `operateur` est vrai.
   */
  telegramChatId?: number | string | null;
  /**
   * Message d'exploitation destiné à l'administrateur, et non à un
   * utilisateur : seul cas où TELEGRAM_CHAT_ID (la conversation de
   * l'exploitant) est un destinataire légitime. Doit être posé
   * EXPLICITEMENT — voir le commentaire de sendTelegram.
   */
  operateur?: boolean;
}

export type ChannelName = 'email' | 'telegram' | 'whatsapp' | 'console';

export interface SendResult {
  channel: ChannelName;
  status: 'sent' | 'failed';
  error?: string;
}

/**
 * Envoie via email (Resend HTTP API) si RESEND_API_KEY présent.
 *
 * Destinataire : `n.to` pour les alertes personnelles (une par utilisateur) ;
 * à défaut `ALERTS_EMAIL_TO`, l'adresse d'exploitation — c'est elle qui reçoit
 * les notifications de worker sans utilisateur cible (publication hebdo,
 * rapports mensuels). Sans l'un ni l'autre on ne devine pas : on rend `null`
 * et `dispatch` retombe sur la console.
 */
export async function sendEmail(n: Notification): Promise<SendResult | null> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERTS_EMAIL_FROM;
  const to = n.to || process.env.ALERTS_EMAIL_TO;
  if (!key || !from || !to) return null;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: n.subject, text: n.body }),
    });
    if (!resp.ok) {
      // Resend explique la cause dans le corps (domaine non vérifié, from
      // refusé…). Sans lui on ne voit qu'un « HTTP 403 » indiagnosticable.
      const detail = await resp.text().catch(() => '');
      return {
        channel: 'email',
        status: 'failed',
        error: `HTTP ${resp.status}${detail ? ` — ${detail.slice(0, 300)}` : ''}`,
      };
    }
    return { channel: 'email', status: 'sent' };
  } catch (err) {
    return { channel: 'email', status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Envoie via Telegram à la conversation DESTINATAIRE.
 *
 * DÉFAUT CORRIGÉ ICI (migration 0129) : cette fonction lisait un unique
 * process.env.TELEGRAM_CHAT_ID — celui de l'exploitant. Toute alerte
 * d'utilisateur partait donc dans la conversation de l'administrateur, jamais
 * dans la sienne, alors que /parametres/alertes annonçait « notifications par
 * email (et Telegram si configuré) ».
 *
 * Il n'y a VOLONTAIREMENT aucun repli vers TELEGRAM_CHAT_ID quand
 * telegramChatId est absent : un repli silencieux reproduirait exactement le
 * défaut. Un message sans destinataire n'est pas envoyé. Seuls les messages
 * d'exploitation, qui posent `operateur: true` en toute connaissance de
 * cause, visent la conversation de l'administrateur.
 */
async function sendTelegram(n: Notification): Promise<SendResult | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = n.telegramChatId ?? (n.operateur ? process.env.TELEGRAM_CHAT_ID : null);
  if (!token || !chatId) return null;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `${n.subject}\n${n.body}` }),
    });
    if (!resp.ok) return { channel: 'telegram', status: 'failed', error: `HTTP ${resp.status}` };
    return { channel: 'telegram', status: 'sent' };
  } catch (err) {
    return { channel: 'telegram', status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

/** Config Cloud API commune (token + numéro d'envoi). null si non configurée. */
function whatsAppConfig(): { token: string; phoneId: string } | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return null;
  return { token, phoneId };
}

/**
 * Envoi WhatsApp TEXTE à un destinataire E.164 (Meta Cloud API).
 * NB : le texte libre ne passe que dans la fenêtre de 24 h après le dernier
 * message entrant du destinataire ; hors fenêtre → template (ci-dessous).
 */
export async function sendWhatsAppRaw(to: string, body: string): Promise<SendResult | null> {
  const cfg = whatsAppConfig();
  if (!cfg || !to) return null;
  try {
    const resp = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        // Limite Cloud API : 4096 caractères par message texte.
        text: { body: body.slice(0, 4096) },
      }),
    });
    if (!resp.ok) return { channel: 'whatsapp', status: 'failed', error: `HTTP ${resp.status}` };
    return { channel: 'whatsapp', status: 'sent' };
  } catch (err) {
    return { channel: 'whatsapp', status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Envoi WhatsApp via TEMPLATE pré-approuvé Meta (messages à l'initiative de
 * l'entreprise, hors fenêtre 24 h — cas normal du brief/alertes).
 * `params` remplit les variables {{1}}, {{2}}… du corps du template.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  params: string[],
  languageCode = 'fr',
): Promise<SendResult | null> {
  const cfg = whatsAppConfig();
  if (!cfg || !to) return null;
  try {
    const resp = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              // Variables texte : Meta refuse les retours ligne et > 1024 car./variable.
              parameters: params.map((p) => ({
                type: 'text',
                text: p.replace(/\s+/g, ' ').slice(0, 1024),
              })),
            },
          ],
        },
      }),
    });
    if (!resp.ok) return { channel: 'whatsapp', status: 'failed', error: `HTTP ${resp.status}` };
    return { channel: 'whatsapp', status: 'sent' };
  } catch (err) {
    return { channel: 'whatsapp', status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Canal WhatsApp GLOBAL historique (destinataire opérateur WHATSAPP_TO) —
 * conservé pour le dispatch multi-canaux existant.
 */
export async function sendWhatsApp(n: Notification): Promise<SendResult | null> {
  const to = process.env.WHATSAPP_TO;
  if (!to) return null;
  const body = n.subject ? `${n.subject}\n${n.body}` : n.body;
  return sendWhatsAppRaw(to, body);
}

/**
 * Diffuse une notification sur tous les canaux configurés.
 * Renvoie la liste des résultats (au moins "console").
 */
export async function dispatch(n: Notification): Promise<SendResult[]> {
  const results: SendResult[] = [];
  const email = await sendEmail(n);
  if (email) results.push(email);
  const tg = await sendTelegram(n);
  if (tg) results.push(tg);
  const wa = await sendWhatsApp(n);
  if (wa) results.push(wa);

  if (results.length === 0) {
    // Fallback console : toujours présent.
    logger.info({ subject: n.subject, body: n.body, code: n.code }, 'NOTIFICATION (console)');
    results.push({ channel: 'console', status: 'sent' });
  }
  return results;
}
