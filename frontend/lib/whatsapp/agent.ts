import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkFeature } from '@/lib/server/featureGate';
import { isAdminEmail } from '@/lib/server/admin-emails';
import { buildSystemPrompt } from '@/lib/whatsappAgent/systemPrompt';
import { getWatchlistContext } from '@/lib/whatsappAgent/watchlistContext';
import { callAgentLlm, type ChatMessage } from '@/lib/whatsappAgent/callAgentLlm';
import { OUTILS, executerOutil } from '@/lib/agent/outils';
import { passerelleWhatsapp } from './passerelle';

/**
 * Agent conversationnel WhatsApp par la passerelle WAHA (lot D).
 *
 * L'utilisateur est identifié par son identifiant de conversation PROUVÉ
 * (whatsapp_chat_id, posé seulement après un code d'appairage — migration
 * 0162) : la précondition notée dans CLAUDE.md avant d'ouvrir le portefeuille
 * à WhatsApp est remplie.
 *
 * Mêmes modules que l'agent Telegram (prompt, watchlist, LLM, outils) : un seul
 * garde-fou « pas de conseil ». Ce qui change :
 *   - compte GRATUIT → outils de marché seulement (ni portefeuille ni alertes),
 *     quota d'essai du flag `whatsapp_agent` (3/jour) ;
 *   - Premium (ou administrateur) → tous les outils, quota Premium.
 * La règle est appliquée côté SERVEUR : un compte gratuit ne reçoit pas les
 * définitions d'outils, le modèle ne peut donc pas les appeler.
 * Ne lève jamais.
 */

const HISTORIQUE = 10;
const OUTILS_PREMIUM = new Set(['mon_portefeuille', 'mes_alertes']);
const OUTILS_GRATUITS = OUTILS.filter((o) => !OUTILS_PREMIUM.has(o.function.name));
const LIEN_PREMIUM = 'https://www.westbourse.com/pricing';

/** Le modèle écrit parfois du Markdown (**gras**) : WhatsApp attend *gras*. */
export function versWhatsapp(texte: string): string {
  return texte.replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/^#{1,6}\s+/gm, '').slice(0, 4096);
}

/**
 * Compte lié à cette conversation ET ayant consenti à l'agent, sinon null.
 * Toute erreur (migration 0162 absente…) renvoie null : le message part alors
 * à la console de contact, chez un humain — jamais perdu.
 */
export async function abonneAvecAgent(chatId: string): Promise<string | null> {
  const { data, error } = await getServiceClient()
    .from('notification_prefs')
    .select('user_id')
    .eq('whatsapp_chat_id', chatId)
    .eq('whatsapp_optin', true)
    .eq('agent_optin', true)
    .maybeSingle();
  if (error) {
    console.warn('[whatsapp] recherche de l’abonné impossible :', error.code ?? error.message);
    return null;
  }
  return (data?.user_id as string | undefined) ?? null;
}

export async function repondreAgent(chatId: string, userId: string, texte: string): Promise<void> {
  const envoyer = (t: string) => passerelleWhatsapp().envoyerTexte(chatId, t).catch(() => null);
  try {
    const db = getServiceClient();
    const { data: profil } = await db.from('profiles').select('is_premium, email').eq('id', userId).maybeSingle();
    const email = (profil?.email as string | null) ?? null;
    const premium = Boolean(profil?.is_premium) || isAdminEmail(email);

    const acces = await checkFeature('whatsapp_agent', { id: userId, email, isPremium: Boolean(profil?.is_premium) });
    if (!acces.allowed) {
      await envoyer(
        premium
          ? acces.reason
          : `${acces.reason}\n\n⭐ *Premium* : 100 questions par jour, votre portefeuille et vos alertes ici même.\n${LIEN_PREMIUM}\n\n💡 Les commandes rapides restent illimitées : tapez *AIDE*.`,
      );
      return;
    }

    const { data: historique } = await db
      .from('whatsapp_conversations')
      .select('role, contenu')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORIQUE);
    // La watchlist n'est donnée qu'aux comptes Premium, comme le portefeuille.
    const watchlist = premium ? await getWatchlistContext(db, userId) : [];

    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt({ watchlist, canal: 'whatsapp', outils: true, premium }) },
      ...(historique ?? []).reverse().map((h) => ({ role: h.role as 'user' | 'assistant', content: h.contenu as string })),
      { role: 'user', content: texte },
    ];

    const reponse = await callAgentLlm(messages, {
      definitions: premium ? OUTILS : OUTILS_GRATUITS,
      executer: (nom, args) =>
        // Double verrou : même si le modèle inventait un appel, un compte gratuit
        // n'obtient jamais ces données.
        !premium && OUTILS_PREMIUM.has(nom)
          ? Promise.resolve({ erreur: 'Réservé aux abonnés Premium.' })
          : executerOutil(db, userId, nom, args),
    });
    if (!reponse) console.error('[whatsapp] agent : tous les fournisseurs LLM ont échoué');
    const finale = reponse ? versWhatsapp(reponse) : 'Je n’arrive pas à répondre pour le moment. Réessayez dans quelques instants, ou tapez *HUMAIN*.';

    await db.from('whatsapp_conversations').insert([
      { user_id: userId, role: 'user', contenu: texte },
      { user_id: userId, role: 'assistant', contenu: finale },
    ]);
    await envoyer(finale);
  } catch (e) {
    console.error('[whatsapp] agent non traité :', (e as Error).message);
  }
}
