import 'server-only';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { MODELE_LLM, URL_LLM } from '@/lib/server/llmModels';
import { avecCharte, avecFormatFr, LecteurSse, type MessageLlm } from '@/lib/llm/redaction';

/**
 * Cascade UNIQUE de rédaction : DeepSeek → Gemini Flash → Grok.
 *
 * Avant ce module, chaque route portait sa propre liste de fournisseurs, en
 * dur, et elles avaient divergé (Mistral seul ici, Grok absent là). Mesuré le
 * 2026-10-05 sur un même commentaire : DeepSeek 1,9 s en bon français,
 * Gemini 3.8 Flash 1 s une fois la réflexion bridée, Grok 4.6 correct mais
 * 65 s. Mistral sort de la rédaction : son palier gratuit répond 429 presque
 * toujours, il ne servait de repli qu'en apparence.
 *
 * L'ordre ne dit pas « le meilleur d'abord » : sur des données fournies et des
 * consignes strictes, les trois écrivent un texte équivalent. Il dit « le plus
 * rapide et le moins cher d'abord, deux secours réels derrière ».
 */
export type FournisseurRedaction = 'deepseek' | 'gemini' | 'xai';

export const CASCADE_REDACTION: readonly FournisseurRedaction[] = ['deepseek', 'gemini', 'xai'];

export interface Redacteur {
  fournisseur: FournisseurRedaction;
  modele: string;
  url: string;
  cle: string;
}

export interface OptionsRedaction {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Ajoute la consigne de nombres à la française (défaut : oui). */
  formatFr?: boolean;
  /**
   * Ajoute la charte de rédaction (lib/llm/redaction, défaut : oui). À couper
   * seulement pour une sortie qui n'est pas lue par un humain (routage JSON).
   */
  charte?: boolean;
  /** Demande une sortie JSON (`response_format: json_object`). */
  json?: boolean;
  /**
   * Garde-fou appliqué à la sortie. Une sortie refusée fait passer au
   * fournisseur SUIVANT plutôt que d'échouer : un autre modèle peut respecter
   * la règle que le premier a enfreinte.
   */
  accepter?: (texte: string) => boolean;
  /**
   * Sous-ensemble de la cascade, dans son ordre. Pour un texte attendu dans une
   * page, Grok (65 s mesurées) ferait attendre le lecteur : mieux vaut le repli
   * déterministe.
   */
  fournisseurs?: readonly FournisseurRedaction[];
}

export interface Redaction {
  texte: string;
  fournisseur: FournisseurRedaction;
  modele: string;
}

/** Fournisseurs dont la clé est configurée, dans l'ordre de la cascade. */
export async function redacteursDisponibles(
  fournisseurs: readonly FournisseurRedaction[] = CASCADE_REDACTION,
): Promise<Redacteur[]> {
  const ordre = CASCADE_REDACTION.filter((f) => fournisseurs.includes(f));
  const cles = await Promise.all(ordre.map((f) => resolveApiKey(f)));
  return ordre.flatMap((f, i) => {
    const cle = cles[i];
    return cle ? [{ fournisseur: f, modele: MODELE_LLM[f], url: URL_LLM[f], cle }] : [];
  });
}

/** Paramètres propres à un fournisseur, à fusionner dans le corps de requête. */
export function parametresFournisseur(f: FournisseurRedaction): Record<string, unknown> {
  // Sans ce réglage, Gemini 3.8 Flash consomme `max_tokens` en réflexion et
  // rend une réponse tronquée (mesuré : 12 jetons utiles sur 300).
  return f === 'gemini' ? { reasoning_effort: 'low' } : {};
}

function consignes(messages: MessageLlm[], o: OptionsRedaction): MessageLlm[] {
  const avecStyle = o.charte === false ? messages : avecCharte(messages);
  return o.formatFr === false ? avecStyle : avecFormatFr(avecStyle);
}

function corps(r: Redacteur, messages: MessageLlm[], o: OptionsRedaction, stream: boolean) {
  return JSON.stringify({
    model: r.modele,
    messages: consignes(messages, o),
    max_tokens: o.maxTokens ?? 1500,
    temperature: o.temperature ?? 0.3,
    ...(o.json ? { response_format: { type: 'json_object' } } : {}),
    ...(stream ? { stream: true } : {}),
    ...parametresFournisseur(r.fournisseur),
  });
}

/**
 * Rédaction complète (non diffusée). Renvoie null si aucun fournisseur n'a
 * produit un texte accepté — à l'appelant de retomber sur son texte
 * déterministe.
 */
export async function rediger(
  messages: MessageLlm[],
  options: OptionsRedaction = {},
): Promise<Redaction | null> {
  for (const r of await redacteursDisponibles(options.fournisseurs)) {
    try {
      const resp = await fetch(r.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${r.cle}` },
        body: corps(r, messages, options, false),
        signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
      });
      if (!resp.ok) {
        console.warn(`[redacteur] ${r.fournisseur} HTTP ${resp.status}`);
        continue;
      }
      const j = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
      };
      const texte = j.choices?.[0]?.message?.content?.trim();
      // Une réponse coupée par la limite de jetons n'est pas un texte : elle
      // s'arrête au milieu d'une phrase et passerait les garde-fous.
      if (!texte || j.choices?.[0]?.finish_reason === 'length') continue;
      if (options.accepter && !options.accepter(texte)) {
        console.warn(`[redacteur] ${r.fournisseur} : sortie refusée par le garde-fou`);
        continue;
      }
      return { texte, fournisseur: r.fournisseur, modele: r.modele };
    } catch (e) {
      console.warn(`[redacteur] ${r.fournisseur} : ${(e as Error).name}`);
    }
  }
  return null;
}

export interface RedactionEnFlux {
  fournisseur: FournisseurRedaction;
  modele: string;
  fragments: AsyncGenerator<string>;
}

/**
 * Rédaction diffusée. La cascade ne joue qu'AVANT le premier octet : une fois
 * qu'un fournisseur a accepté la requête, le texte part vers le lecteur et ne
 * peut plus être repris par un autre.
 */
export async function redigerEnFlux(
  messages: MessageLlm[],
  options: OptionsRedaction = {},
): Promise<RedactionEnFlux | null> {
  for (const r of await redacteursDisponibles(options.fournisseurs)) {
    try {
      const resp = await fetch(r.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${r.cle}` },
        body: corps(r, messages, options, true),
        signal: AbortSignal.timeout(options.timeoutMs ?? 110_000),
      });
      if (!resp.ok || !resp.body) {
        console.warn(`[redacteur] ${r.fournisseur} HTTP ${resp.status}`);
        continue;
      }
      const corpsFlux = resp.body;
      async function* fragments() {
        const lecteur = corpsFlux.getReader();
        const dec = new TextDecoder();
        const sse = new LecteurSse();
        while (!sse.fini) {
          const { done, value } = await lecteur.read();
          if (done) {
            yield* sse.terminer();
            break;
          }
          yield* sse.lire(dec.decode(value, { stream: true }));
        }
        await lecteur.cancel().catch(() => undefined);
      }
      return { fournisseur: r.fournisseur, modele: r.modele, fragments: fragments() };
    } catch (e) {
      console.warn(`[redacteur] ${r.fournisseur} : ${(e as Error).name}`);
    }
  }
  return null;
}
