import 'server-only';
import { createHmac } from 'node:crypto';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { normalizePairingCode, PAIRING_TTL_MINUTES } from '@/lib/pairingCodes';
import { passerelleWhatsapp } from './passerelle';
import { MAX_LIAISONS, TABLE_ABSENTE } from './liaisons';

/**
 * Appairage WhatsApp par la passerelle WAHA (lot D, migration 0162).
 *
 * L'abonné génère un code dans ses paramètres et l'envoie DEPUIS son WhatsApp :
 * l'identifiant de conversation qui nous parvient est donc le sien, prouvé —
 * contrairement à un numéro saisi. On le stocke tel quel (…@c.us ou …@lid) :
 * c'est à lui qu'on répond, et WAHA ne fournit pas toujours le numéro.
 *
 * Même discipline que whatsappAgent/redeemPairing.ts (Meta) : consommation
 * ATOMIQUE du code, tentatives limitées par conversation, et au-delà SILENCE
 * (répondre à chaque échec amplifierait l'envoi et exposerait le numéro au
 * bannissement). Ne lève jamais.
 */

const TENTATIVES_MAX = 5;
const FENETRE_S = 10 * 60;

const LIEN_PARAMETRES = 'https://www.westbourse.com/parametres/alertes';

function cleTentatives(chatId: string): string {
  return createHmac('sha256', process.env.WAHA_WEBHOOK_HMAC_KEY ?? 'westbourse-waha').update(`appairage:${chatId}`).digest('hex');
}

/** Numéro E.164 quand l'identifiant le porte (…@c.us), sinon null (…@lid masqué). */
export function telephoneDepuisChatId(chatId: string): string | null {
  const m = /^(\d{8,15})@(c\.us|s\.whatsapp\.net)$/.exec(chatId);
  return m ? `+${m[1]}` : null;
}

export async function appairerWhatsapp(chatId: string, texte: string): Promise<void> {
  const repondre = (t: string) => passerelleWhatsapp().envoyerTexte(chatId, t).catch(() => null);
  try {
    const { allowed } = await checkRateLimit({ route: 'whatsapp-appairage', ip: cleTentatives(chatId), maxHits: TENTATIVES_MAX, windowSeconds: FENETRE_S });
    if (!allowed) {
      console.warn('[whatsapp] tentatives d’appairage limitées — aucune réponse envoyée');
      return;
    }

    const db = getServiceClient();
    const maintenant = new Date().toISOString();
    // Un seul énoncé : deux webhooks concurrents ne peuvent pas consommer le même code.
    const { data: reclame } = await db
      .from('whatsapp_pairing_codes')
      .update({ consumed_at: maintenant })
      .eq('code', normalizePairingCode(texte))
      .is('consumed_at', null)
      .gt('expires_at', maintenant)
      .select('user_id')
      .maybeSingle();

    if (!reclame) {
      await repondre(
        `❌ Code invalide, expiré (${PAIRING_TTL_MINUTES} minutes) ou déjà utilisé.\n\nGénérez-en un nouveau dans vos paramètres :\n${LIEN_PARAMETRES}`,
      );
      return;
    }

    const userId = reclame.user_id as string;
    const DEJA_AILLEURS = 'Ce WhatsApp est déjà lié à un autre compte WESTBOURSE. Déliez-le depuis ce compte, ou écrivez *HUMAIN* pour joindre l’équipe.';

    // Une ligne par WhatsApp lié (0165), au plus MAX_LIAISONS par compte.
    const { data: existant, error: errLecture } = await db.from('whatsapp_liaisons').select('user_id').eq('chat_id', chatId).maybeSingle();
    const tableAbsente = !!errLecture && TABLE_ABSENTE.has(errLecture.code ?? '');
    if (errLecture && !tableAbsente) throw new Error(`liaisons : ${errLecture.code ?? errLecture.message}`);

    if (tableAbsente) {
      // Migration 0165 pas encore appliquée : ancien comportement (un seul WhatsApp).
      const { error } = await db.from('notification_prefs').upsert(
        { user_id: userId, whatsapp_chat_id: chatId, whatsapp_phone: telephoneDepuisChatId(chatId), whatsapp_verifie_at: maintenant },
        { onConflict: 'user_id' },
      );
      if (error) {
        await repondre(error.code === '23505' ? DEJA_AILLEURS : 'La liaison a échoué. Réessayez dans quelques instants.');
        return;
      }
    } else if (existant && existant.user_id !== userId) {
      await repondre(DEJA_AILLEURS);
      return;
    } else if (!existant) {
      const { count } = await db.from('whatsapp_liaisons').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      if ((count ?? 0) >= MAX_LIAISONS) {
        await repondre(`Votre compte a déjà ${MAX_LIAISONS} WhatsApp liés, le maximum. Déliez-en un dans vos paramètres, puis renvoyez un code :\n${LIEN_PARAMETRES}`);
        return;
      }
      const { error } = await db.from('whatsapp_liaisons').insert({ user_id: userId, chat_id: chatId, telephone: telephoneDepuisChatId(chatId) });
      if (error) {
        console.error('[whatsapp] liaison impossible', { code: error.code });
        await repondre(error.code === '23505' ? DEJA_AILLEURS : 'La liaison a échoué. Réessayez dans quelques instants.');
        return;
      }
    }

    // L'envoi volontaire du code EST l'acte de consentement : horodaté ici,
    // au niveau du compte (il vaut pour chaque WhatsApp lié).
    const { error } = await db.from('notification_prefs').upsert(
      { user_id: userId, whatsapp_optin: true, whatsapp_optin_at: maintenant },
      { onConflict: 'user_id' },
    );
    if (error) {
      console.error('[whatsapp] consentement non enregistré', { code: error.code });
      await repondre('La liaison a échoué. Réessayez dans quelques instants.');
      return;
    }

    await repondre(
      [
        '✅ *Votre WhatsApp est lié à votre compte WESTBOURSE.*',
        '',
        '🤖 Pour poser vos questions à l’assistant ici même, activez-le dans vos paramètres :',
        LIEN_PARAMETRES,
        '',
        '💡 Tapez *AIDE* pour les commandes rapides, *HUMAIN* pour écrire à l’équipe.',
      ].join('\n'),
    );
  } catch (e) {
    console.error('[whatsapp] appairage non traité :', (e as Error).message);
  }
}
