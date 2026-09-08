// frontend/lib/telegramAgent/sendTelegram.ts
import 'server-only';

/**
 * Envoi d'un message Telegram à une conversation précise.
 *
 * Différence importante avec WhatsApp : Telegram n'a ni gabarit à faire
 * approuver, ni fenêtre de 24 h, ni facturation au message. Un envoi est donc
 * toujours possible dès qu'on connaît le chat_id — d'où l'absence ici de la
 * mécanique « gabarit puis repli en texte libre » de sendWhatsapp.ts.
 *
 * Ne lève jamais : le webhook doit répondre 200 à Telegram quoi qu'il arrive,
 * faute de quoi Telegram rejoue le message indéfiniment.
 */
export async function sendTelegramReply(chatId: number | string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('telegramAgent/sendTelegram: TELEGRAM_BOT_TOKEN absent');
    return false;
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        // Pas de parse_mode : le texte vient d'un LLM et peut contenir des
        // astérisques ou des underscores. En Markdown, Telegram rejetterait le
        // message ENTIER pour une entité mal fermée — l'utilisateur ne
        // recevrait alors rien du tout.
        disable_web_page_preview: true,
      }),
    });
    const rep = await r.json().catch(() => ({}));
    if (!rep.ok) {
      /* Seule la description est relayée, jamais l'URL appelée : elle
         contient le jeton du bot. */
      console.error('telegramAgent/sendTelegram: envoi refusé', {
        description: rep.description ?? `HTTP ${r.status}`,
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error('telegramAgent/sendTelegram: envoi impossible', {
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
