/**
 * Envois WhatsApp PERSONNELS par la passerelle WAHA (lot E, spec
 * docs/superpowers/specs/2026-10-24-whatsapp-lot-e-design.md).
 *
 * Destinataire : `notification_prefs.whatsapp_chat_id`, identifiant PROUVÉ par
 * code d'appairage (migration 0162) — jamais un numéro saisi. Aucun repli vers
 * un autre destinataire : sans identifiant, pas d'envoi.
 *
 * Rythme : une passerelle non officielle qui enchaîne des dizaines de messages
 * en rafale ressemble à un robot de spam, ce qui fait bannir un numéro.
 * `pauseEntreEnvois` espace chaque envoi de 2 à 4 s, au hasard.
 * Ne lève jamais : un destinataire en échec ne prive pas les suivants.
 */

export interface ResultatWaha {
  ok: boolean;
  erreur?: string;
}

export function wahaConfiguree(): boolean {
  return Boolean(process.env.WAHA_URL && process.env.WAHA_API_KEY);
}

async function appeler(chemin: string, corps: Record<string, unknown>, delaiMs: number): Promise<ResultatWaha> {
  const url = process.env.WAHA_URL?.replace(/\/+$/, '');
  const cle = process.env.WAHA_API_KEY;
  if (!url || !cle) return { ok: false, erreur: 'WAHA_URL ou WAHA_API_KEY absent' };
  try {
    const r = await fetch(`${url}/api/${chemin}`, {
      method: 'POST',
      headers: { 'X-Api-Key': cle, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: process.env.WAHA_SESSION || 'default', ...corps }),
      signal: AbortSignal.timeout(delaiMs),
    });
    // Le corps d'erreur de WAHA ne contient pas la clé ; on n'en garde que le début.
    if (!r.ok) return { ok: false, erreur: `HTTP ${r.status} ${(await r.text()).slice(0, 160)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, erreur: (e as Error).name === 'TimeoutError' ? 'passerelle injoignable (délai dépassé)' : 'passerelle injoignable' };
  }
}

export function envoyerTexteWaha(chatId: string, texte: string): Promise<ResultatWaha> {
  return appeler('sendText', { chatId, text: texte.slice(0, 4096), linkPreview: true }, 15_000);
}

/** Document (PDF) envoyé en base64 : le bucket des dossiers est privé, la passerelle ne peut pas le télécharger. */
export function envoyerDocumentWaha(
  chatId: string,
  doc: { octets: Buffer; nom: string; mimetype?: string },
  legende?: string,
): Promise<ResultatWaha> {
  return appeler(
    'sendFile',
    {
      chatId,
      file: { mimetype: doc.mimetype ?? 'application/pdf', filename: doc.nom, data: doc.octets.toString('base64') },
      ...(legende ? { caption: legende.slice(0, 1024) } : {}),
    },
    60_000,
  );
}

export function pauseEntreEnvois(): Promise<void> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return Promise.resolve();
  return new Promise((r) => setTimeout(r, 2000 + Math.floor(Math.random() * 2000)));
}
