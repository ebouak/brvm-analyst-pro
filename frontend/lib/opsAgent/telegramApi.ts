import 'server-only';

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface TelegramOpsUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    chat?: { id?: number; type?: string };
    from?: { id?: number; username?: string; first_name?: string };
    text?: string;
    voice?: { file_id: string; duration?: number; mime_type?: string; file_size?: number };
    audio?: { file_id: string; duration?: number; mime_type?: string; file_name?: string; file_size?: number };
  };
  callback_query?: {
    id: string;
    from?: { id?: number; username?: string };
    message?: { message_id?: number; chat?: { id?: number; type?: string } };
    data?: string;
  };
}

const MAX_TEXTE_TELEGRAM = 4000;
const MAX_AUDIO_OCTETS = 10 * 1024 * 1024;

function getOpsBotToken(): string | null {
  return process.env.TELEGRAM_OPS_BOT_TOKEN?.trim() || null;
}

export function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tronquerHtml(texte: string): string {
  if (texte.length <= MAX_TEXTE_TELEGRAM) return texte;
  return `${texte.slice(0, MAX_TEXTE_TELEGRAM - 20)}\n\n[… tronqué]`;
}

export async function envoyerMessageOps(
  chatId: number | string,
  htmlText: string,
  opts: { replyMarkup?: InlineKeyboardMarkup; disablePreview?: boolean } = {},
): Promise<{ ok: boolean; messageId?: number }> {
  const token = getOpsBotToken();
  if (!token) {
    console.warn('opsAgent/telegramApi: TELEGRAM_OPS_BOT_TOKEN absent');
    return { ok: false };
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: tronquerHtml(htmlText),
        parse_mode: 'HTML',
        disable_web_page_preview: opts.disablePreview ?? true,
        ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const rep = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };
    if (!rep.ok) {
      console.error('opsAgent/telegramApi: sendMessage refusé', {
        description: rep.description ?? `HTTP ${r.status}`,
      });
      return { ok: false };
    }
    return { ok: true, messageId: rep.result?.message_id };
  } catch (err) {
    console.error('opsAgent/telegramApi: sendMessage impossible', {
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

export async function editerMessageOps(
  chatId: number | string,
  messageId: number,
  htmlText: string,
  opts: { replyMarkup?: InlineKeyboardMarkup } = {},
): Promise<boolean> {
  const token = getOpsBotToken();
  if (!token) return false;

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: tronquerHtml(htmlText),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const rep = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!rep.ok) {
      // « message is not modified » est bénin si deux éditions coïncident.
      if (!String(rep.description ?? '').includes('not modified')) {
        console.warn('opsAgent/telegramApi: editMessageText refusé', {
          description: rep.description ?? `HTTP ${r.status}`,
        });
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function repondreCallbackOps(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
): Promise<boolean> {
  const token = getOpsBotToken();
  if (!token) return false;

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...(text ? { text: text.slice(0, 190) } : {}),
        show_alert: showAlert,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const rep = (await r.json().catch(() => ({}))) as { ok?: boolean };
    return Boolean(rep.ok);
  } catch {
    return false;
  }
}

export async function envoyerPhotoOps(
  chatId: number | string,
  png: Buffer,
  legendeHtml: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<boolean> {
  const token = getOpsBotToken();
  if (!token) return false;

  try {
    const form = new FormData();
    form.set('chat_id', String(chatId));
    form.set('photo', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'westbourse-pulse.png');
    form.set('caption', legendeHtml.slice(0, 1020));
    form.set('parse_mode', 'HTML');
    if (replyMarkup) form.set('reply_markup', JSON.stringify(replyMarkup));

    const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    const rep = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!rep.ok) {
      console.error('opsAgent/telegramApi: sendPhoto refusé', {
        description: rep.description ?? `HTTP ${r.status}`,
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error('opsAgent/telegramApi: sendPhoto impossible', {
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function telechargerFichierTelegramOps(
  fileId: string,
): Promise<{ ok: true; buffer: Buffer; mimeType: string; fileName: string } | { ok: false; raison: string }> {
  const token = getOpsBotToken();
  if (!token) return { ok: false, raison: 'TELEGRAM_OPS_BOT_TOKEN absent.' };

  try {
    const metaRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const meta = (await metaRes.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { file_path?: string; file_size?: number };
    };
    const filePath = meta.result?.file_path;
    if (!meta.ok || !filePath) {
      return { ok: false, raison: 'Impossible de localiser le fichier audio sur Telegram.' };
    }
    if ((meta.result?.file_size ?? 0) > MAX_AUDIO_OCTETS) {
      return { ok: false, raison: 'Note vocale trop volumineuse (max 10 Mo).' };
    }

    const binRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!binRes.ok) {
      return { ok: false, raison: `Téléchargement audio refusé (HTTP ${binRes.status}).` };
    }
    const ab = await binRes.arrayBuffer();
    if (ab.byteLength > MAX_AUDIO_OCTETS) {
      return { ok: false, raison: 'Note vocale trop volumineuse (max 10 Mo).' };
    }
    const ext = filePath.split('.').pop()?.toLowerCase() || 'ogg';
    const mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : 'audio/ogg';
    return {
      ok: true,
      buffer: Buffer.from(ab),
      mimeType,
      fileName: `voice.${ext}`,
    };
  } catch (err) {
    return {
      ok: false,
      raison: err instanceof Error ? err.message : 'Erreur téléchargement Telegram',
    };
  }
}

export async function verifierWebhookOps(): Promise<{
  ok: boolean;
  configured: boolean;
  url?: string;
  pendingUpdates?: number;
  lastError?: string;
}> {
  const token = getOpsBotToken();
  if (!token) return { ok: false, configured: false };

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
      signal: AbortSignal.timeout(6_000),
    });
    const rep = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: {
        url?: string;
        pending_update_count?: number;
        last_error_message?: string;
      };
    };
    if (!rep.ok || !rep.result) return { ok: false, configured: true };
    return {
      ok: Boolean(rep.result.url),
      configured: true,
      url: rep.result.url,
      pendingUpdates: rep.result.pending_update_count,
      lastError: rep.result.last_error_message,
    };
  } catch {
    return { ok: false, configured: true };
  }
}
