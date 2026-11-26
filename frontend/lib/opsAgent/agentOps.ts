import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callAgentLlm, type ChatMessage } from '@/lib/whatsappAgent/callAgentLlm';
import { echapperHtml, type InlineKeyboardButton } from './telegramApi';
import { OUTILS_OPS, executerOutilOps } from './outilsOps';

const SYSTEM_PROMPT_OPS = `Tu es l'assistant d'orchestration interne WESTBOURSE Ops (usage strictement réservé à l'administrateur fondateur sur Telegram).
Règles strictes :
1. Réponds toujours en français clair, concis et factuel (format adapté à Telegram, sans Markdown complexe — utilise du texte simple et des puces).
2. Ne fabrique JAMAIS de chiffre, de statut ou de log : utilise tes outils pour lire l'état réel avant de répondre.
3. Si une source est illisible ou en erreur, dis-le honnêtement.
4. Quand une action de remédiation est pertinente (ex. relancer un workflow, ouvrir les paiements, voir la carte Pulse), utilise l'outil proposer_action_ops pour attacher un bouton cliquable sous ton message plutôt que de prétendre l'avoir exécutée.
5. Rappelle si besoin que les commandes rapides /tour, /cloture, /boc, /coherence, /pulse, /paiements, /agregats, /contact, /llm, /relancer sont disponibles.`;

export async function repondreAgentOps(
  db: SupabaseClient,
  chatId: number,
  texte: string,
): Promise<{ html: string; boutons: InlineKeyboardButton[][] }> {
  const { data: recent } = await db
    .from('ops_command_runs')
    .select('args, resultat')
    .eq('chat_id', chatId)
    .eq('commande', 'chat_ia')
    .eq('statut', 'succes')
    .order('cree_le', { ascending: false })
    .limit(4);

  const history: ChatMessage[] = [];
  for (const row of ((recent ?? []) as Array<{ args?: { user?: string }; resultat?: { reply?: string } }>).reverse()) {
    if (row.args?.user) history.push({ role: 'user', content: row.args.user });
    if (row.resultat?.reply) history.push({ role: 'assistant', content: row.resultat.reply });
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_OPS },
    ...history,
    { role: 'user', content: texte },
  ];

  const boutons: InlineKeyboardButton[][] = [];
  const reply = await callAgentLlm(
    messages,
    {
      definitions: OUTILS_OPS,
      executer: (nom, args) => executerOutilOps(db, nom, args, boutons),
    },
    { echeance: Date.now() + 45_000 },
  );

  const finalText =
    reply ?? "Je n'ai pas pu joindre les fournisseurs IA pour le diagnostic. Utilisez /tour, /cloture ou /llm.";

  await db
    .from('ops_command_runs')
    .insert({
      chat_id: chatId,
      source: 'telegram',
      commande: 'chat_ia',
      args: { user: texte.slice(0, 1000) },
      statut: reply ? 'succes' : 'echec',
      niveau_risque: 0,
      resultat: { reply: finalText.slice(0, 2000) },
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return {
    html: echapperHtml(finalText),
    boutons: boutons.slice(0, 4),
  };
}
