/**
 * Types partagés + ordre de cascade + prompt + parseur JSON tolérant pour
 * l'extraction LLM des fondamentaux. Utilisé par le client (orchestration) et
 * le serveur (appel API). Aucune clé ici.
 */
import type { FundamentalExtraction } from './validate';

export type Provider = 'deepseek' | 'mistral' | 'grok';

/** Ordre de priorité (texte) : DeepSeek d'abord. */
export const TEXT_PROVIDERS: Provider[] = ['deepseek', 'mistral', 'grok'];
/** Voie vision (PDF scannés) : DeepSeek exclu (pas de vision). */
export const VISION_PROVIDERS: Provider[] = ['mistral', 'grok'];

export interface ExtractRequest {
  mode: 'text' | 'vision';
  symbol: string;
  year: number;
  text?: string; // mode text
  images?: string[]; // mode vision : data URLs PNG
}

export interface ExtractResponse {
  provider: Provider;
  data: FundamentalExtraction;
}

/** Prompt système commun (règles d'unité éprouvées). */
export const SYSTEM_PROMPT =
  "Tu es un expert en analyse financière. À partir du document d'états financiers, " +
  'extrais les fondamentaux et renvoie UNIQUEMENT un JSON valide (aucun texte autour). ' +
  'Valeurs en MILLIONS de FCFA sauf eps (FCFA/action) et shares_outstanding (unités). ' +
  "Repère l'unité réelle du tableau (en millions / en milliers / en FCFA) et convertis " +
  'tout en MILLIONS (milliers÷1000, FCFA bruts÷1000000). Ignore les chiffres marketing ' +
  "(infographies, 'X milliards' narratif). Prends les lignes du compte de résultat et du " +
  'bilan consolidés. net_income = résultat net part du groupe sinon consolidé. ' +
  'Champs JSON: revenue, net_income, equity, debt_total, cash, eps, dividend_per_share, ' +
  'shares_outstanding. Mets null si non trouvé.';

export function userPrompt(symbol: string, year: number, text?: string): string {
  const head = `Société: ${symbol}. Exercice: ${year}.`;
  return text ? `${head}\n\nTexte du rapport:\n${text}` : head;
}

/** Extrait le premier objet JSON d'une réponse LLM (tolère le texte autour). */
export function parseLlmJson(raw: string): Record<string, unknown> | null {
  // 1) tentative directe
  try {
    return JSON.parse(raw);
  } catch {
    /* continue */
  }
  // 2) bloc entre la première { et la dernière }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}
