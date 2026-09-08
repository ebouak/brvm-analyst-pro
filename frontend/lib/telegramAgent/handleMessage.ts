// frontend/lib/telegramAgent/handleMessage.ts
import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkFeature } from '@/lib/server/featureGate';
import { buildSystemPrompt } from '@/lib/whatsappAgent/systemPrompt';
import { getWatchlistContext } from '@/lib/whatsappAgent/watchlistContext';
import { callAgentLlm, type ChatMessage } from '@/lib/whatsappAgent/callAgentLlm';
import { OUTILS, executerOutil } from '@/lib/agent/outils';
import { sendTelegramReply } from './sendTelegram';

const HISTORY_LIMIT = 10;

/**
 * Traite un message Telegram entrant déjà authentifié (jeton secret d'en-tête
 * vérifié par l'appelant). Ne lève jamais — toute erreur devient un message de
 * repli, pour ne jamais faire échouer le webhook : Telegram rejoue sans fin un
 * webhook qu'il n'a pas vu acquitté.
 *
 * TROIS MODULES SONT RÉUTILISÉS TELS QUELS depuis whatsappAgent :
 * `systemPrompt` (dont l'interdiction du conseil en investissement),
 * `watchlistContext` et `callAgentLlm`. Aucun n'a de dépendance au canal —
 * seuls l'identification de l'utilisateur, l'historique et l'envoi diffèrent.
 * Les dupliquer aurait créé deux garde-fous à maintenir en parallèle, avec la
 * garantie qu'ils finiraient par diverger.
 */
export async function handleIncomingMessage(chatId: number, text: string): Promise<void> {
  const db = getServiceClient();

  // 1. Identification par le chat_id. Contrairement à WhatsApp, ce n'est pas
  //    un identifiant DÉCLARÉ : il n'a pu arriver en base que par un code
  //    d'appairage envoyé depuis cette conversation (migration 0129). La
  //    possession est donc prouvée, pas supposée.
  const { data: prefs, error: prefsError } = await db
    .from('notification_prefs')
    .select('user_id, agent_optin')
    .eq('telegram_chat_id', chatId)
    .eq('telegram_optin', true)
    .maybeSingle();

  if (prefsError) {
    console.error('telegramAgent/handleMessage: lecture notification_prefs impossible', {
      code: prefsError.code,
      message: prefsError.message,
    });
  }

  if (!prefs) {
    await sendTelegramReply(
      chatId,
      "Ce compte Telegram n'est lié à aucun compte WESTBOURSE.\n\n" +
        'Générez un code depuis les paramètres de votre compte, puis envoyez-le-moi ici.',
    );
    return;
  }

  // 2. Consentement à l'agent, distinct de celui des alertes. Volontairement
  //    la MÊME colonne que WhatsApp : c'est le même agent, et exiger deux
  //    consentements pour un seul traitement serait un formalisme sans objet.
  if (!prefs.agent_optin) {
    await sendTelegramReply(
      chatId,
      "L'agent conversationnel n'est pas activé sur votre compte. " +
        'Activez-le dans vos paramètres WESTBOURSE ; vos alertes, elles, arriveront bien ici.',
    );
    return;
  }

  const userId = prefs.user_id as string;

  // 3. Quota par plan. Le code de fonctionnalité reste 'whatsapp_agent' :
  //    c'est le quota de l'agent conversationnel, mal nommé pour raison
  //    historique. Introduire 'telegram_agent' sans l'avoir semé dans
  //    feature_flags refuserait l'accès à tout le monde en silence — le
  //    renommage se fera en même temps que le seed.
  const { data: profile } = await db
    .from('profiles')
    .select('is_premium, email')
    .eq('id', userId)
    .maybeSingle();

  const gate = await checkFeature('whatsapp_agent', {
    id: userId,
    email: (profile?.email as string | null) ?? null,
    isPremium: Boolean(profile?.is_premium),
  });

  if (!gate.allowed) {
    await sendTelegramReply(chatId, gate.reason);
    return;
  }

  // 4. Contexte : historique récent + watchlist enrichie des vraies données de
  //    marché du jour.
  const { data: history } = await db
    .from('telegram_conversations')
    .select('role, contenu')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  const watchlist = await getWatchlistContext(db, userId);

  const chatHistory: ChatMessage[] = (history ?? [])
    .reverse()
    .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.contenu as string }));

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt({ watchlist, canal: 'telegram', outils: true }) },
    ...chatHistory,
    { role: 'user', content: text },
  ];

  // 5. Appel LLM. callAgentLlm échoue silencieusement vers null : une panne des
  //    deux fournisseurs doit être tracée ICI pour rester diagnosticable.
  const reply = await callAgentLlm(messages, {
    definitions: OUTILS,
    executer: (nom, args) => executerOutil(db, userId, nom, args),
  });
  if (!reply) {
    console.error(
      'telegramAgent/handleMessage: callAgentLlm a échoué (DeepSeek et Mistral indisponibles)',
      { userId },
    );
  }
  const finalReply =
    reply ?? "Je n'arrive pas à répondre pour le moment, réessayez dans quelques instants.";

  // 6. Persistance des deux messages.
  await db.from('telegram_conversations').insert([
    { user_id: userId, role: 'user', contenu: text },
    { user_id: userId, role: 'assistant', contenu: finalReply },
  ]);

  // 7. Réponse.
  await sendTelegramReply(chatId, finalReply);
}
