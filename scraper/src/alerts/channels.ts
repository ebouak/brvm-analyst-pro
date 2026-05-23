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
}

export type ChannelName = 'email' | 'telegram' | 'console';

export interface SendResult {
  channel: ChannelName;
  status: 'sent' | 'failed';
  error?: string;
}

/** Envoie via email (Resend HTTP API) si RESEND_API_KEY présent. */
async function sendEmail(n: Notification): Promise<SendResult | null> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERTS_EMAIL_FROM;
  if (!key || !from || !n.to) return null;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: n.to, subject: n.subject, text: n.body }),
    });
    if (!resp.ok) return { channel: 'email', status: 'failed', error: `HTTP ${resp.status}` };
    return { channel: 'email', status: 'sent' };
  } catch (err) {
    return { channel: 'email', status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

/** Envoie via Telegram si TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID présents. */
async function sendTelegram(n: Notification): Promise<SendResult | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
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

  if (results.length === 0) {
    // Fallback console : toujours présent.
    logger.info({ subject: n.subject, body: n.body, code: n.code }, 'NOTIFICATION (console)');
    results.push({ channel: 'console', status: 'sent' });
  }
  return results;
}
