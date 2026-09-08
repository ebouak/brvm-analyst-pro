// frontend/lib/whatsappAgent/callAgentLlm.ts
import 'server-only';
import { resolveApiKey } from '@/lib/server/apiKeys';
import type { DefinitionOutil } from '@/lib/agent/outils';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /* Champs du protocole d'outils (compatible OpenAI, supporté par DeepSeek et
     Mistral). Absents des messages ordinaires. */
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface BoiteAOutils {
  definitions: DefinitionOutil[];
  executer: (nom: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Nombre maximal d'allers-retours modèle ↔ outils pour UN message utilisateur.
 * Borne stricte et non négociable : sans elle, un modèle qui boucle sur un
 * outil renvoyant toujours la même chose consommerait des appels payants
 * jusqu'au délai d'expiration de la fonction. Trois tours suffisent largement
 * — « mon portefeuille et le cours de SNTS » en demande deux.
 */
const MAX_TOURS = 3;

/**
 * Cascade DeepSeek → Mistral, même motif que callLlm dans
 * app/api/import-batch/route.ts — adapté à une conversation multi-tour.
 *
 * Le second paramètre est FACULTATIF : sans lui, le comportement est
 * exactement celui d'avant (un aller-retour, aucun outil). C'est ce qui permet
 * d'activer les outils sur Telegram sans rien changer au chemin WhatsApp, qui
 * est en production et que je ne peux pas éprouver ici.
 */
export async function callAgentLlm(
  messages: ChatMessage[],
  outils?: BoiteAOutils,
): Promise<string | null> {
  const providers = [
    {
      key: await resolveApiKey('deepseek'),
      url: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
    },
    {
      key: await resolveApiKey('mistral'),
      url: 'https://api.mistral.ai/v1/chat/completions',
      model: 'mistral-large-latest',
    },
  ].filter((p) => p.key);

  for (const p of providers) {
    try {
      /* Chaque fournisseur repart de la conversation d'origine : un historique
         d'outils à moitié construit par un fournisseur tombé en panne serait
         incohérent pour le suivant. */
      const fil: ChatMessage[] = [...messages];

      for (let tour = 0; tour < MAX_TOURS; tour++) {
        const r = await fetch(p.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
          body: JSON.stringify({
            model: p.model,
            temperature: 0.3,
            messages: fil,
            ...(outils ? { tools: outils.definitions, tool_choice: 'auto' } : {}),
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!r.ok) break; // fournisseur suivant

        const j = (await r.json()) as { choices?: Array<{ message?: ChatMessage }> };
        const msg = j.choices?.[0]?.message;
        if (!msg) break;

        const appels = msg.tool_calls;
        if (!outils || !appels || appels.length === 0) {
          if (msg.content) return msg.content;
          break;
        }

        // Le message de l'assistant PORTANT les appels doit être réinjecté tel
        // quel : les fournisseurs rejettent un résultat d'outil orphelin.
        fil.push(msg);

        for (const appel of appels) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(appel.function.arguments || '{}');
          } catch {
            /* Arguments illisibles : on exécute quand même avec un objet vide,
               l'outil répondra « erreur » plutôt que de faire échouer le tour. */
          }
          const resultat = await outils.executer(appel.function.name, args);
          fil.push({
            role: 'tool',
            tool_call_id: appel.id,
            content: JSON.stringify(resultat),
          });
        }
      }
    } catch {
      /* fournisseur suivant */
    }
  }
  return null;
}
