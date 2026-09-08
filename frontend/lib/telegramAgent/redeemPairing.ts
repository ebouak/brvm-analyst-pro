// frontend/lib/telegramAgent/redeemPairing.ts
import 'server-only';
import { createHmac } from 'node:crypto';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { normalizePairingCode, PAIRING_TTL_MINUTES } from '@/lib/pairingCodes';
import { sendTelegramReply } from './sendTelegram';

/**
 * Limitation des tentatives d'appairage. Clé : le CHAT ÉMETTEUR, pas l'IP —
 * l'IP appelante est toujours celle de Telegram, donc sans pouvoir
 * discriminant.
 *
 * Ce qu'on protège diffère du cas WhatsApp, et il faut le dire : Telegram ne
 * facture rien et n'attribue aucune *quality rating*, donc l'argument « chaque
 * échec coûte un message et dégrade le numéro » ne s'applique PAS ici. Ce qui
 * reste : empêcher qu'un compte automatisé transforme le bot en générateur de
 * réponses, et borner les écritures en base par un émetteur non identifié. Le
 * seuil est le même, la raison est plus modeste.
 *
 * Le code lui-même n'a pas besoin d'être protégé du devinement : 30 bits
 * d'entropie sur une fenêtre de 15 minutes.
 */
const PAIRING_MAX_ATTEMPTS = 5;
const PAIRING_WINDOW_SECONDS = 10 * 60;
const PAIRING_RATE_ROUTE = 'telegram-pairing';

/**
 * Clé de rate-limit dérivée du chat_id. `rate_limit_hits` n'est pas déclarée
 * comme contenant des données personnelles (migration 0065) : on n'y écrit
 * donc jamais l'identifiant en clair.
 *
 * HMAC et non simple SHA-256 : les chat_id Telegram sont des entiers, un
 * espace qu'un GPU parcourt instantanément. Un hash nu serait trivialement
 * réversible, donc encore une donnée personnelle au sens du RGPD
 * (pseudonymisation, pas anonymisation).
 */
function pairingRateKey(chatId: number): string {
  const secret =
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'westbourse-pairing';
  return createHmac('sha256', secret).update(String(chatId)).digest('hex');
}

/**
 * Consomme un code d'appairage envoyé par l'utilisateur depuis SA conversation
 * Telegram : c'est ce qui prouve la possession du compte Telegram, le chat_id
 * venant de Telegram lui-même et non d'une saisie. Ne lève jamais — toute
 * erreur devient un message de repli, pour ne pas faire échouer le webhook.
 */
export async function redeemPairingCode(chatId: number, rawText: string): Promise<void> {
  // Au-delà du seuil : retour silencieux plutôt que « code inconnu ». Répondre
  // laisserait l'amplification intacte.
  const { allowed } = await checkRateLimit({
    route: PAIRING_RATE_ROUTE,
    ip: pairingRateKey(chatId),
    maxHits: PAIRING_MAX_ATTEMPTS,
    windowSeconds: PAIRING_WINDOW_SECONDS,
  });
  if (!allowed) {
    // Pas d'identifiant dans le log : seul le fait de la coupure est journalisé.
    console.warn('telegramAgent/redeemPairing: tentatives limitées — aucune réponse envoyée');
    return;
  }

  const db = getServiceClient();
  const code = normalizePairingCode(rawText);

  // Consommation ATOMIQUE (un seul énoncé) : un check-then-act en deux temps
  // laisserait deux invocations concurrentes — le webhook traite en waitUntil,
  // la concurrence est réelle — passer toutes les deux le contrôle avant que
  // l'une n'écrive consumed_at (TOCTOU). Le `where` porte les trois
  // conditions ; 0 ligne = code inconnu, expiré ou déjà consommé.
  const { data: claimed } = await db
    .from('telegram_pairing_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('code', code)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('user_id')
    .maybeSingle();

  if (!claimed) {
    await sendTelegramReply(
      chatId,
      `Code invalide, expiré (${PAIRING_TTL_MINUTES} minutes) ou déjà utilisé. Générez-en un nouveau depuis les paramètres de votre compte WESTBOURSE.`,
    );
    return;
  }

  const userId = claimed.user_id as string;

  // telegram_optin_at horodaté ICI : l'appairage EST l'acte de consentement,
  // l'utilisateur envoyant volontairement le code depuis son Telegram. Sans
  // cela la date resterait nulle jusqu'à ce qu'il coche une autre case — le
  // consentement RGPD serait actif sans date prouvable.
  const { error: linkError } = await db.from('notification_prefs').upsert(
    {
      user_id: userId,
      telegram_chat_id: chatId,
      telegram_optin: true,
      telegram_optin_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (linkError) {
    // 23505 = index unique de la migration 0129 : cette conversation Telegram
    // est déjà rattachée à un autre compte.
    const dejaPris = linkError.code === '23505';
    console.error('telegramAgent/redeemPairing: liaison impossible', {
      code: linkError.code,
      message: linkError.message,
    });
    await sendTelegramReply(
      chatId,
      dejaPris
        ? "Ce compte Telegram est déjà lié à un autre compte WESTBOURSE. Contactez le support si vous pensez qu'il s'agit d'une erreur."
        : 'La liaison a échoué. Réessayez dans quelques instants.',
    );
    return;
  }

  // Pas de second `update consumed_at` : le code a déjà été consommé
  // atomiquement plus haut, au moment de la réclamation.
  await sendTelegramReply(
    chatId,
    '✅ Telegram lié à votre compte WESTBOURSE.\n\n' +
      'Vous recevrez ici les alertes que vous avez définies. Pour me poser des ' +
      "questions sur le marché, activez l'agent conversationnel dans vos paramètres.",
  );
}
