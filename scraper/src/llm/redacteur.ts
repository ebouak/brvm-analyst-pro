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

/** Charte de rédaction — COPIE de frontend/lib/llm/redaction.ts (à tenir identique). */
export const CHARTE_REDACTION = [
  "STYLE — ton d'analyste financier sobre, en vouvoiement :",
  '- Phrases courtes (25 mots au plus), une idée par phrase, voix active.',
  '- Vocabulaire financier exact ; tout terme technique est expliqué en quelques mots à sa première occurrence.',
  "- Chaque affirmation s'appuie sur un chiffre ou un fait fourni : écrivez ce qui est constaté, jamais ce qui est supposé.",
  "- Aucun adjectif d'emphase ni superlatif non chiffré (exceptionnel, impressionnant, remarquable, spectaculaire, excellent) ; aucun point d'exclamation, aucun emoji.",
  '- Aucune formule creuse (« il convient de noter », « force est de constater », « dans un contexte de », « en effet », « globalement »).',
  '- Une réserve se dit une fois, clairement, au bon endroit ; elle ne se répète pas à chaque phrase.',
].join('\n');

function ajouterAuSysteme(messages: MessageLlm[], bloc: string): MessageLlm[] {
  const i = messages.findIndex((m) => m.role === 'system');
  if (i === -1) return [{ role: 'system', content: bloc }, ...messages];
  return messages.map((m, j) => (j === i ? { ...m, content: `${m.content}\n\n${bloc}` } : m));
}

export function avecFormatFr(messages: MessageLlm[]): MessageLlm[] {
  return ajouterAuSysteme(messages, CONSIGNE_FORMAT_FR);
}

export function avecCharte(messages: MessageLlm[]): MessageLlm[] {
  return ajouterAuSysteme(messages, CHARTE_REDACTION);
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
  /** Charte de rédaction (défaut : oui) ; à couper pour une sortie non lue par un humain. */
  charte?: boolean;
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
          messages: (() => {
            const avecStyle = options.charte === false ? messages : avecCharte(messages);
            return options.formatFr === false ? avecStyle : avecFormatFr(avecStyle);
          })(),
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
