import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { avecCharte, avecFormatFr, type MessageLlm } from '@/lib/llm/redaction';

/**
 * Claude en tête de la rédaction du diagnostic (choix produit du 2026-10-07).
 *
 * Seul le diagnostic passe par ici : un rapport de plus de 2 000 mots, où la
 * rigueur du raisonnement compte plus que la vitesse. Les textes courts
 * intégrés aux pages restent sur la cascade rapide (lib/server/redacteur).
 *
 * API OFFICIELLE uniquement. Un revendeur testé le 2026-10-05 puis le
 * 2026-10-07 (codecraftapi.com) servait ses « claude-opus-5.5 », « gpt-5.5 »
 * et « gemma-2-2b » avec un tokenizer identique, ignorait max_tokens et
 * injectait un prompt système caché d'environ 300 jetons : ce n'est pas Claude,
 * et un prompt ajouté au nôtre défait les garde-fous.
 *
 * Sans clé, renvoie null : la cascade habituelle prend le relais, comme pour
 * tout fournisseur non configuré.
 */
export const MODELE_CLAUDE = 'claude-opus-5-5';

export interface RedactionClaudeEnFlux {
  fournisseur: 'anthropic';
  modele: string;
  fragments: AsyncGenerator<string>;
}

export async function redigerClaudeEnFlux(
  messages: MessageLlm[],
  o: { maxTokens: number; timeoutMs: number; effort?: 'low' | 'medium' | 'high' },
): Promise<RedactionClaudeEnFlux | null> {
  const cle = await resolveApiKey('anthropic');
  if (!cle) return null;

  const complets = avecFormatFr(avecCharte(messages));
  const system = complets.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const conversation = complets
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const client = new Anthropic({ apiKey: cle, timeout: o.timeoutMs, maxRetries: 0 });
  try {
    // Pas de `temperature` (refusée depuis Opus 4.7) ; la réflexion est
    // toujours active sur Opus 5.5 et partage `max_tokens` avec le texte.
    const flux = client.messages.stream({
      model: MODELE_CLAUDE,
      max_tokens: o.maxTokens,
      system,
      messages: conversation,
      output_config: { effort: o.effort ?? 'low' },
    });
    const it = flux[Symbol.asyncIterator]();

    // La cascade ne joue qu'AVANT le premier octet : on attend le premier
    // fragment de texte pour savoir si Claude a bien pris la main.
    let premier: string | null = null;
    while (premier === null) {
      const { done, value } = await it.next();
      if (done) return null;
      if (value.type === 'content_block_delta' && value.delta.type === 'text_delta') premier = value.delta.text;
    }

    async function* fragments(): AsyncGenerator<string> {
      yield premier!;
      let arret: string | null = null;
      for (;;) {
        const { done, value } = await it.next();
        if (done) break;
        if (value.type === 'content_block_delta' && value.delta.type === 'text_delta') yield value.delta.text;
        if (value.type === 'message_delta' && value.delta.stop_reason) arret = value.delta.stop_reason;
      }
      // Un rapport tronqué ou refusé ne doit pas être enregistré comme complet :
      // l'exception fait sortir l'appelant sans écrire le cache.
      if (arret === 'max_tokens' || arret === 'refusal') throw new Error(`claude : arrêt ${arret}`);
    }
    return { fournisseur: 'anthropic', modele: MODELE_CLAUDE, fragments: fragments() };
  } catch (e) {
    console.warn(`[redacteur] anthropic : ${e instanceof Anthropic.APIError ? `HTTP ${e.status}` : (e as Error).name}`);
    return null;
  }
}
