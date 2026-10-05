/**
 * Cascade UNIQUE de rédaction côté scraper : DeepSeek → Gemini Flash → Grok.
 *
 * ⚠️ COPIE de `frontend/lib/server/redacteur.ts` et `frontend/lib/llm/redaction.ts`
 * (deux paquets TypeScript distincts, sans module partagé — même règle que
 * `src/hebdo/pure/`). Noms de modèles et URL à corriger DES DEUX CÔTÉS, et
 * dans `src/sante/runSanteLlm.ts`.
 *
 * Mistral sort de la rédaction : son palier gratuit répond 429 presque
 * toujours. Gemini est appelé avec `reasoning_effort: 'low'` — sans lui, il
 * dépense `max_tokens` en réflexion et rend une réponse tronquée (mesuré le
 * 2026-10-05 : 12 jetons utiles sur 300).
 */

export type FournisseurRedaction = 'deepseek' | 'gemini' | 'xai';

export const CASCADE_REDACTION: readonly FournisseurRedaction[] = ['deepseek', 'gemini', 'xai'];

export const MODELE_REDACTION: Record<FournisseurRedaction, string> = {
  deepseek: 'deepseek-chat',
  gemini: 'gemini-3.8-flash',
  xai: 'grok-4.6',
};

export const URL_REDACTION: Record<FournisseurRedaction, string> = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  xai: 'https://api.x.ai/v1/chat/completions',
};

export interface MessageLlm {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const CONSIGNE_FORMAT_FR =
  'Écris tous les nombres au format français : virgule décimale (12,5 %), ' +
  'espace entre les milliers (12 500 FCFA). Jamais de point décimal.';

export function avecFormatFr(messages: MessageLlm[]): MessageLlm[] {
  const i = messages.findIndex((m) => m.role === 'system');
  if (i === -1) return [{ role: 'system', content: CONSIGNE_FORMAT_FR }, ...messages];
  return messages.map((m, j) => (j === i ? { ...m, content: `${m.content}\n\n${CONSIGNE_FORMAT_FR}` } : m));
}

export function parametresFournisseur(f: FournisseurRedaction): Record<string, unknown> {
  return f === 'gemini' ? { reasoning_effort: 'low' } : {};
}

export interface OptionsRedaction {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Consigne de nombres à la française (défaut : oui). */
  formatFr?: boolean;
  json?: boolean;
  /** Garde-fou : une sortie refusée fait passer au fournisseur suivant. */
  accepter?: (texte: string) => boolean;
  fournisseurs?: readonly FournisseurRedaction[];
  /** Pour signaler un refus ou une panne dans le journal de l'appelant. */
  journal?: (evenement: { fournisseur: FournisseurRedaction; raison: string }) => void;
}

export interface Redaction {
  texte: string;
  fournisseur: FournisseurRedaction;
  modele: string;
}

/**
 * Renvoie le premier texte accepté, ou null — à l'appelant de retomber sur son
 * texte déterministe. `resoudreCle` est injecté : le scraper lit l'env puis la
 * table api_keys, les tests passent une fonction en mémoire.
 */
export async function rediger(
  messages: MessageLlm[],
  resoudreCle: (fournisseur: string) => Promise<string | null>,
  options: OptionsRedaction = {},
  fetchFn: typeof fetch = fetch,
): Promise<Redaction | null> {
  const ordre = CASCADE_REDACTION.filter((f) => (options.fournisseurs ?? CASCADE_REDACTION).includes(f));
  for (const f of ordre) {
    const cle = await resoudreCle(f);
    if (!cle) continue;
    try {
      const resp = await fetchFn(URL_REDACTION[f], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
        body: JSON.stringify({
          model: MODELE_REDACTION[f],
          messages: options.formatFr === false ? messages : avecFormatFr(messages),
          max_tokens: options.maxTokens ?? 1500,
          temperature: options.temperature ?? 0.3,
          ...(options.json ? { response_format: { type: 'json_object' } } : {}),
          ...parametresFournisseur(f),
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
      });
      if (!resp.ok) {
        options.journal?.({ fournisseur: f, raison: `HTTP ${resp.status}` });
        continue;
      }
      const j = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
      };
      const texte = j.choices?.[0]?.message?.content?.trim();
      if (!texte || j.choices?.[0]?.finish_reason === 'length') {
        options.journal?.({ fournisseur: f, raison: 'réponse vide ou tronquée' });
        continue;
      }
      if (options.accepter && !options.accepter(texte)) {
        options.journal?.({ fournisseur: f, raison: 'refusée par le garde-fou' });
        continue;
      }
      return { texte, fournisseur: f, modele: MODELE_REDACTION[f] };
    } catch (e) {
      options.journal?.({ fournisseur: f, raison: e instanceof Error ? e.name : 'erreur' });
    }
  }
  return null;
}
