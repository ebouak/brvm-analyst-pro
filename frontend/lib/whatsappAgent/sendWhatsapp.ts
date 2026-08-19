import 'server-only';

/**
 * Envoi WhatsApp TEXTE en réponse à un message entrant (Meta Cloud API).
 * Copie volontaire de scraper/src/alerts/channels.ts:sendWhatsAppRaw — le
 * frontend et le scraper sont deux apps Node découplées (déploiements
 * distincts, Vercel vs GitHub Actions), pas de package partagé. Toute
 * correction à ce comportement doit être reportée des deux côtés.
 *
 * Le texte libre ne passe que dans la fenêtre de 24 h après le dernier
 * message entrant du destinataire — cas normal ici puisqu'on RÉPOND à un
 * message qui vient d'arriver.
 */
export async function sendWhatsAppReply(to: string, body: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    console.error('whatsappAgent/sendWhatsapp: WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID manquant');
    return false;
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        // Limite Cloud API : 4096 caractères par message texte.
        text: { body: body.slice(0, 4096) },
      }),
    });
    if (!resp.ok) {
      console.error('whatsappAgent/sendWhatsapp: échec envoi', { status: resp.status });
      return false;
    }
    return true;
  } catch (err) {
    console.error('whatsappAgent/sendWhatsapp: exception', err instanceof Error ? err.message : String(err));
    return false;
  }
}
