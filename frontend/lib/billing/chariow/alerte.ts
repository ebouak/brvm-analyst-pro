import 'server-only';

/**
 * Alerte d'EXPLOITATION (conversation Telegram de l'exploitant,
 * TELEGRAM_CHAT_ID) pour un paiement qui demande un regard humain : vente
 * orpheline, montant incohérent, licence révoquée.
 *
 * Aucune donnée client : ni nom, ni email, ni téléphone — seulement des
 * références (sal_…, identifiant de transaction) et le motif.
 * Un canal non configuré est ignoré ; l'alerte ne fait jamais échouer le webhook.
 */
export async function alerterExploitant(texte: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('chariow/alerte (sans canal) :', texte);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `💳 Chariow — ${texte}`.slice(0, 900) }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
  } catch {
    // L'URL porte le jeton du bot : on ne journalise pas l'erreur brute.
    console.warn('chariow/alerte : envoi Telegram impossible');
  }
}
