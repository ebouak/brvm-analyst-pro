// frontend/lib/whatsappAgent/redeemPairing.ts
import 'server-only';
import { createHmac } from 'node:crypto';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { normalizePairingCode, PAIRING_TTL_MINUTES } from './pairing';
import { sendWhatsAppReply } from './sendWhatsapp';

/**
 * Limitation des tentatives d'appairage. Clé : le NUMÉRO ÉMETTEUR, pas l'IP —
 * l'IP appelante est toujours celle de Meta, donc sans pouvoir discriminant.
 *
 * Ce qu'on protège n'est pas le secret du code (30 bits d'entropie, ≈ 5,4×10⁸
 * tentatives en moyenne : le devinement est irréaliste) mais l'amplification :
 * chaque échec déclenche un message WhatsApp sortant, facturé et comptabilisé
 * par Meta vers un numéro non engagé — ce qui dégrade la *quality rating* du
 * numéro professionnel et peut faire chuter son tier de messagerie, cassant
 * briefs et alertes pour TOUS les utilisateurs.
 *
 * Un utilisateur légitime lit un code à l'écran et le recopie une fois : il
 * n'approche jamais ce seuil.
 */
const PAIRING_MAX_ATTEMPTS = 5;
const PAIRING_WINDOW_SECONDS = 10 * 60;
const PAIRING_RATE_ROUTE = 'whatsapp-pairing';

/**
 * Clé de rate-limit dérivée du numéro. `rate_limit_hits` n'est pas déclarée
 * comme contenant des données personnelles (migration 0065) : on n'y écrit
 * jamais le numéro en clair.
 *
 * HMAC et non simple SHA-256 : l'espace des numéros E.164 fait ~10^10
 * combinaisons, qu'un GPU parcourt en quelques secondes — un hash nu serait
 * trivialement réversible, donc encore une donnée personnelle au sens du
 * RGPD (pseudonymisation, pas anonymisation). Avec une clé secrète, le
 * brute-force est impossible sans compromettre d'abord le secret.
 *
 * WHATSAPP_APP_SECRET est nécessairement défini ici : le webhook rejette en
 * 401 avant d'appeler cette fonction s'il manque. Le repli n'existe que pour
 * ne jamais réduire la clé à une chaîne vide si l'ordre d'appel changeait.
 */
function pairingRateKey(fromE164: string): string {
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'westbourse-pairing';
  return createHmac('sha256', secret).update(fromE164).digest('hex');
}

/**
 * Consomme un code d'appairage envoyé par l'utilisateur depuis SON WhatsApp :
 * c'est ce qui prouve la possession du numéro (le numéro vient de Meta, pas
 * d'une saisie manuelle). Ne lève jamais — toute erreur devient un message
 * de repli, pour ne pas faire échouer le webhook.
 */
export async function redeemPairingCode(fromE164: string, rawText: string): Promise<void> {
  // Au-delà du seuil : on CESSE DE RÉPONDRE (retour silencieux) plutôt que de
  // répondre « code inconnu ». Répondre quand même laisserait l'amplification
  // intacte — c'est précisément le message sortant qui coûte.
  const { allowed } = await checkRateLimit({
    route: PAIRING_RATE_ROUTE,
    ip: pairingRateKey(fromE164),
    maxHits: PAIRING_MAX_ATTEMPTS,
    windowSeconds: PAIRING_WINDOW_SECONDS,
  });
  if (!allowed) {
    // Pas de numéro dans le log : seul le fait de la coupure est journalisé.
    console.warn('whatsappAgent/redeemPairing: tentatives d’appairage limitées — aucune réponse envoyée');
    return;
  }

  const db = getServiceClient();
  const code = normalizePairingCode(rawText);

  // Consommation ATOMIQUE (un seul énoncé) : un check-then-act en deux temps
  // laisserait deux invocations serverless concurrentes — le webhook traite en
  // waitUntil, la concurrence est réelle — passer toutes les deux le contrôle
  // avant que l'une n'écrive consumed_at (TOCTOU). Le `where` porte les trois
  // conditions ; 0 ligne renvoyée = code inconnu, expiré ou déjà consommé.
  const { data: claimed } = await db
    .from('whatsapp_pairing_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('code', code)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('user_id')
    .maybeSingle();

  if (!claimed) {
    await sendWhatsAppReply(
      fromE164,
      `Code invalide, expiré (${PAIRING_TTL_MINUTES} minutes) ou déjà utilisé. Générez-en un nouveau depuis les paramètres de votre compte WESTBOURSE.`,
    );
    return;
  }

  const userId = claimed.user_id as string;

  // Le numéro vient de Meta : aucune faute de frappe possible, et la
  // possession est prouvée par l'envoi lui-même.
  const { error: linkError } = await db
    .from('notification_prefs')
    .upsert({ user_id: userId, whatsapp_phone: fromE164, whatsapp_optin: true }, { onConflict: 'user_id' });

  if (linkError) {
    // 23505 = l'index unique de 0127 : ce numéro appartient déjà à un autre compte.
    const dejaPris = linkError.code === '23505';
    console.error('whatsappAgent/redeemPairing: liaison impossible', { code: linkError.code, message: linkError.message });
    await sendWhatsAppReply(
      fromE164,
      dejaPris
        ? "Ce numéro est déjà lié à un autre compte WESTBOURSE. Contactez le support si vous pensez qu'il s'agit d'une erreur."
        : "La liaison a échoué. Réessayez dans quelques instants.",
    );
    return;
  }

  // Pas de second `update consumed_at` ici : le code a déjà été consommé
  // atomiquement plus haut, au moment de la réclamation.
  await sendWhatsAppReply(
    fromE164,
    "✅ Numéro lié à votre compte WESTBOURSE. Activez maintenant l'agent conversationnel dans vos paramètres pour pouvoir me poser des questions.",
  );
}
