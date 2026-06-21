// Notifications des BASCULES de recommandation du Conseiller, multi-canal :
// Telegram, WhatsApp (Meta Cloud API) et Email (Resend). Diffusion vers les
// canaux OPÉRATEUR configurés par variables d'environnement (pas d'envoi par
// utilisateur → pas de consentement RGPD requis). Chaque canal est facultatif
// et tolérant aux pannes : un canal absent ou en échec n'empêche pas les autres.
// (sendEmail est importé paresseusement pour garder les formateurs purs testables.)

export interface AdvisorFlip {
  code: string;
  from: string;
  to: string;
  conviction: number;
}

const VERB: Record<string, string> = { acheter: 'Acheter', conserver: 'Conserver', vendre: 'Vendre' };
const label = (a: string) => VERB[a] ?? a;

/** Message texte (Telegram/WhatsApp) — pur, testable. */
export function formatFlipText(flips: AdvisorFlip[], date: string): string {
  const lines = flips
    .slice(0, 20)
    .map((f) => `• ${f.code} : ${label(f.from)} → ${label(f.to)} (conviction ${f.conviction}%)`);
  const extra = flips.length > 20 ? `\n… et ${flips.length - 20} autre(s).` : '';
  return `🔔 WESTBOURSE — ${flips.length} changement(s) de recommandation (${date})\n\n${lines.join('\n')}${extra}`;
}

/** Corps HTML (Email) — pur, testable. */
export function formatFlipHtml(flips: AdvisorFlip[], date: string): string {
  const rows = flips
    .map(
      (f) =>
        `<tr><td style="padding:4px 10px;font-weight:600">${f.code}</td>` +
        `<td style="padding:4px 10px;color:#888">${label(f.from)} → <b>${label(f.to)}</b></td>` +
        `<td style="padding:4px 10px;text-align:right">${f.conviction}%</td></tr>`,
    )
    .join('');
  return `<div style="font-family:system-ui,sans-serif">
    <h2>🔔 ${flips.length} changement(s) de recommandation</h2>
    <p style="color:#666">Séance du ${date}</p>
    <table style="border-collapse:collapse">${rows}</table>
    <p style="color:#999;font-size:12px;margin-top:16px">Aide à la décision — exécutez via votre SGI. Performances passées ne préjugent pas des performances futures.</p>
  </div>`;
}

interface ChannelResult { channel: string; ok: boolean; error?: string }

async function notifyTelegram(text: string): Promise<ChannelResult | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return { channel: 'telegram', ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { channel: 'telegram', ok: false, error: (e as Error).message };
  }
}

async function notifyWhatsApp(text: string): Promise<ChannelResult | null> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const to = process.env.WHATSAPP_TO;
  if (!token || !phoneId || !to) return null;
  // NB : l'envoi texte libre ne fonctionne que dans la fenêtre de 24 h. Pour des
  // notifications proactives hors fenêtre, basculer sur un modèle (template) approuvé.
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    return { channel: 'whatsapp', ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { channel: 'whatsapp', ok: false, error: (e as Error).message };
  }
}

async function notifyEmailOps(flips: AdvisorFlip[], date: string): Promise<ChannelResult | null> {
  const to = process.env.ALERTS_OPS_EMAIL;
  if (!to) return null;
  const { sendEmail } = await import('@/lib/server/email');
  const r = await sendEmail({
    to,
    subject: `🔔 ${flips.length} changement(s) de recommandation — ${date}`,
    html: formatFlipHtml(flips, date),
  });
  return { channel: 'email', ok: r.ok, error: r.error };
}

/**
 * Diffuse les bascules vers tous les canaux opérateur configurés.
 * Sans aucune config, ne fait rien (retour vide). Tolérant aux pannes.
 */
export async function notifyFlips(flips: AdvisorFlip[], date: string): Promise<ChannelResult[]> {
  if (flips.length === 0) return [];
  const text = formatFlipText(flips, date);
  const results = await Promise.all([
    notifyTelegram(text),
    notifyWhatsApp(text),
    notifyEmailOps(flips, date),
  ]);
  return results.filter((r): r is ChannelResult => r !== null);
}
