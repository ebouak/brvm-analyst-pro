import 'server-only';
import { createHmac } from 'node:crypto';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { isAdminEmail } from '@/lib/server/admin-emails';
import { passerelleWhatsapp } from '@/lib/whatsapp/passerelle';
import { sendTelegramPhoto, sendTelegramReply } from '@/lib/telegramAgent/sendTelegram';
import { telechargerRecap } from './telecharger';
import { compteConsentant } from '@/lib/whatsapp/liaisons';

/**
 * Commande RECAP sur WhatsApp ou Telegram (spec 2026-10-24-recap-portefeuille).
 *
 * L'abonné est identifié par son identifiant de conversation PROUVÉ par code
 * d'appairage (whatsapp_chat_id, 0162 ; telegram_chat_id, 0129) : jamais par
 * un numéro déclaré, sans quoi un tiers pourrait recevoir le portefeuille
 * d'un autre. Réservé Premium (le bouton du site, lui, est gratuit).
 * 10 demandes / heure / conversation ; au-delà, silence. Ne lève jamais.
 */
const LIMITE_HEURE = 10;
const SITE = 'https://www.westbourse.com';

type Canal = 'whatsapp' | 'telegram';

/** `origine` : l'URL du site qui a reçu le webhook (l'image y est rendue par la route Edge). */
export async function traiterDemandeRecap(canal: Canal, destinataire: string | number, origine: string): Promise<void> {
  const wa = canal === 'whatsapp';
  const texte = (t: string) =>
    wa ? passerelleWhatsapp().envoyerTexte(String(destinataire), t).catch(() => null) : sendTelegramReply(destinataire, t.replace(/\*/g, ''));
  try {
    const cle = createHmac('sha256', process.env.WAHA_WEBHOOK_HMAC_KEY ?? 'westbourse-recap').update(`recap:${canal}:${destinataire}`).digest('hex');
    const { allowed } = await checkRateLimit({ route: 'recap-demande', ip: cle, maxHits: LIMITE_HEURE, windowSeconds: 3600 });
    if (!allowed) return;

    const db = getServiceClient();
    // WhatsApp : n'importe lequel des WhatsApp liés au compte (0165).
    const prefs = wa
      ? await compteConsentant(db, String(destinataire)).then((u) => (u ? { user_id: u } : null))
      : (
          await db.from('notification_prefs').select('user_id')
            .eq('telegram_chat_id', destinataire).eq('telegram_optin', true).maybeSingle()
        ).data;
    if (!prefs) {
      await texte(`🔗 La récap de votre portefeuille demande de lier ce ${wa ? 'WhatsApp' : 'Telegram'} à votre compte : générez un code dans vos paramètres, puis envoyez-le ici.\n${SITE}/parametres/alertes`);
      return;
    }
    const userId = prefs.user_id as string;

    const { data: profil } = await db.from('profiles').select('is_premium, email').eq('id', userId).maybeSingle();
    if (!profil?.is_premium && !isAdminEmail((profil?.email as string | null) ?? null)) {
      await texte(`⭐ *La récap par message est réservée aux abonnés Premium.*\nSur le site, elle est gratuite : bouton « Mon récap en image » sur ${SITE}/portefeuille\n\nPremium : ${SITE}/pricing`);
      return;
    }

    const recap = await telechargerRecap(userId, origine);
    if (recap.etat === 'vide') {
      await texte(`Votre portefeuille est vide pour l'instant. Ajoutez vos positions sur ${SITE}/portefeuille`);
      return;
    }
    if (recap.etat === 'panne') {
      console.error('[recap] image indisponible (secret, site ou rendu)');
      await texte(`La récap est momentanément indisponible. Réessayez dans quelques minutes, ou consultez-la sur ${SITE}/portefeuille`);
      return;
    }
    const png = recap.png;
    const legende = 'Votre récap WESTBOURSE. Information de marché, pas un conseil en investissement.';
    const ok = wa
      ? (await passerelleWhatsapp().envoyerImage(String(destinataire), png, legende)).ok
      : await sendTelegramPhoto(destinataire, png, legende);
    if (!ok) console.warn(`[recap] image non envoyée (${canal})`);
  } catch (e) {
    console.error('[recap] demande non traitée :', (e as Error).message);
  }
}
