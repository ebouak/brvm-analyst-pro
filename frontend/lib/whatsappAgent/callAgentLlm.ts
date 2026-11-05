// frontend/lib/whatsappAgent/callAgentLlm.ts
import 'server-only';
import { parametresFournisseur, redacteursDisponibles } from '@/lib/server/redacteur';
import type { DefinitionOutil } from '@/lib/agent/outils';
import { delaiAppel } from './delai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /* Champs du protocole d'outils (compatible OpenAI : DeepSeek, Gemini, Grok).
     Absents des messages ordinaires. */
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
 * Cascade commune DeepSeek → Gemini → Grok (lib/server/redacteur), adaptée à
 * une conversation multi-tour.
 *
 * Le message de l'assistant portant des appels d'outils est réinjecté TEL QUEL
 * (plus bas) : Gemini y range une signature de pensée et refuse le tour
 * suivant si on la retire — mesuré le 2026-10-05.
 *
 * Le second paramètre est FACULTATIF : sans lui, le comportement est
 * exactement celui d'avant (un aller-retour, aucun outil). C'est ce qui permet
 * d'activer les outils sur Telegram sans rien changer au chemin WhatsApp, qui
 * est en production et que je ne peux pas éprouver ici.
 */
export interface OptionsAgentLlm {
  /**
   * Instant (ms epoch) au-delà duquel plus aucun appel n'est lancé. Chaque
   * appel reçoit le temps restant (≤ 60 s) au lieu de 30 s fixes — voir delai.ts.
   */
  echeance?: number;
}

export async function callAgentLlm(
  messages: ChatMessage[],
  outils?: BoiteAOutils,
  options: OptionsAgentLlm = {},
): Promise<string | null> {
  const providers = (await redacteursDisponibles()).map((r) => ({
    nom: r.fournisseur,
    key: r.cle,
    url: r.url,
    model: r.modele,
    extra: parametresFournisseur(r.fournisseur),
  }));

  for (const p of providers) {
    try {
      /* Chaque fournisseur repart de la conversation d'origine : un historique
         d'outils à moitié construit par un fournisseur tombé en panne serait
         incohérent pour le suivant. */
      const fil: ChatMessage[] = [...messages];

      for (let tour = 0; tour < MAX_TOURS; tour++) {
        const delai = delaiAppel(Date.now(), options.echeance);
        if (delai === null) {
          console.warn(`[agent-llm] échéance atteinte avant ${p.nom} (tour ${tour + 1})`);
          return null;
        }
        const r = await fetch(p.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
          body: JSON.stringify({
            model: p.model,
            temperature: 0.3,
            messages: fil,
            ...p.extra,
            ...(outils ? { tools: outils.definitions, tool_choice: 'auto' } : {}),
          }),
          signal: AbortSignal.timeout(delai),
        });
        // Chaque abandon est journalisé (fournisseur + raison, jamais la clé) :
        // un repli qui échoue en silence ne se voit que le jour où il sert.
        if (!r.ok) {
          console.warn(`[agent-llm] ${p.nom} : HTTP ${r.status}`);
          break; // fournisseur suivant
        }

        const j = (await r.json()) as { choices?: Array<{ message?: ChatMessage }> };
        const msg = j.choices?.[0]?.message;
        if (!msg) {
          console.warn(`[agent-llm] ${p.nom} : réponse sans message`);
          break;
        }

        const appels = msg.tool_calls;
        if (!outils || !appels || appels.length === 0) {
          if (msg.content) return msg.content;
          console.warn(`[agent-llm] ${p.nom} : réponse vide`);
          break;
        }
        if (tour === MAX_TOURS - 1) console.warn(`[agent-llm] ${p.nom} : ${MAX_TOURS} tours d'outils sans réponse`);

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
    } catch (e) {
      const nom = (e as Error).name;
      console.warn(`[agent-llm] ${p.nom} : ${nom === 'TimeoutError' || nom === 'AbortError' ? 'délai dépassé' : `erreur (${nom})`}`);
    }
  }
  return null;
}
