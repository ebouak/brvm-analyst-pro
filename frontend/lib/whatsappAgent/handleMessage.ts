// frontend/lib/whatsappAgent/handleMessage.ts
import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkFeature } from '@/lib/server/featureGate';
import { buildSystemPrompt } from './systemPrompt';
import { getWatchlistContext } from './watchlistContext';
import { callAgentLlm, type ChatMessage } from './callAgentLlm';
import { sendWhatsAppReply } from './sendWhatsapp';

const HISTORY_LIMIT = 10;

/**
 * Traite un message WhatsApp entrant déjà authentifié (signature Meta
 * vérifiée par l'appelant). Ne lève jamais — toute erreur se traduit par un
 * message de repli envoyé à l'utilisateur (ou un no-op silencieux si même
 * l'envoi échoue), pour ne jamais faire échouer le webhook côté Meta.
 */
export async function handleIncomingMessage(fromE164: string, text: string): Promise<void> {
  const db = getServiceClient();

  // 1. Identification par téléphone vérifié.
  const { data: prefs } = await db
    .from('notification_prefs')
    .select('user_id, agent_optin')
    .eq('whatsapp_phone', fromE164)
    .eq('whatsapp_optin', true)
    .maybeSingle();

  if (!prefs) {
    await sendWhatsAppReply(
      fromE164,
      "Ce numéro n'est associé à aucun compte WESTBOURSE vérifié. Activez WhatsApp dans les paramètres de votre compte pour utiliser l'agent.",
    );
    return;
  }

  // 2. Consentement distinct de l'opt-in brief/alertes.
  if (!prefs.agent_optin) {
    await sendWhatsAppReply(
      fromE164,
      "L'agent conversationnel n'est pas activé sur votre compte. Activez-le dans les paramètres WhatsApp de votre compte WESTBOURSE.",
    );
    return;
  }

  const userId = prefs.user_id as string;

  // 3. Quota par plan (réutilise featureGate.ts existant).
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
    await sendWhatsAppReply(fromE164, gate.reason);
    return;
  }

  // 4. Contexte : historique récent + watchlist ENRICHIE (vraies données de
  //    marché du jour pour chaque code suivi, pas seulement les codes bruts).
  const { data: history } = await db
    .from('whatsapp_conversations')
    .select('role, contenu')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  const watchlist = await getWatchlistContext(db, userId);

  const chatHistory: ChatMessage[] = (history ?? [])
    .reverse()
    .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.contenu as string }));

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt({ watchlist }) },
    ...chatHistory,
    { role: 'user', content: text },
  ];

  // 5. Appel LLM. callAgentLlm ne logue rien en interne (les deux providers
  //    échouent silencieusement vers null) — contrairement au pattern de
  //    référence (callLlm dans import-batch/route.ts) dont l'appelant logue
  //    toujours l'échec, une panne totale des deux providers doit être
  //    tracée ICI pour rester diagnosticable en production (signalé par la
  //    review qualité de la Task 7).
  const reply = await callAgentLlm(messages);
  if (!reply) {
    console.error('whatsappAgent/handleMessage: callAgentLlm a échoué (DeepSeek et Mistral indisponibles)', { userId });
  }
  const finalReply = reply ?? "Je n'arrive pas à répondre pour le moment, réessayez dans quelques instants.";

  // 6. Persistance (les deux messages).
  await db.from('whatsapp_conversations').insert([
    { user_id: userId, role: 'user', contenu: text },
    { user_id: userId, role: 'assistant', contenu: finalReply },
  ]);

  // 7. Réponse.
  await sendWhatsAppReply(fromE164, finalReply);
}
