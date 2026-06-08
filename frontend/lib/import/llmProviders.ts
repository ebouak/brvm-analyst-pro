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
  "Tu es un expert en analyse financière BRVM/SYSCOHADA. Extrais les fondamentaux " +
  "du document et renvoie UNIQUEMENT un objet JSON valide, sans texte autour.\n\n" +
  "RÈGLE D'UNITÉ CRITIQUE :\n" +
  "1. Lis l'en-tête du tableau (ex : 'En milliers FRANCS CFA' ou 'En millions FCFA').\n" +
  "2. Si le tableau est 'en milliers' : divise chaque montant brut par 1 000 pour obtenir des millions.\n" +
  "   Exemple : tableau en milliers, ligne CA = 197 629 996 → revenue = 197 630 (millions).\n" +
  "3. Si le tableau est 'en millions' : recopie directement.\n" +
  "4. Si le tableau est 'en FCFA bruts' : divise par 1 000 000.\n" +
  "NE recopie PAS le nombre brut du tableau comme résultat : convertis toujours en millions.\n\n" +
  "Champs JSON attendus (tous en MILLIONS de FCFA sauf eps et shares_outstanding) :\n" +
  "  revenue           = Chiffre d'affaires\n" +
  "  net_income        = Résultat net (part du groupe si consolidé)\n" +
  "  equity            = Capitaux propres totaux\n" +
  "  debt_total        = Dettes financières totales (CT + LT)\n" +
  "  cash              = Trésorerie actif\n" +
  "  eps               = Bénéfice par action (FCFA/action, pas en millions)\n" +
  "  dividend_per_share= Dividende par action (FCFA/action, pas en millions)\n" +
  "  shares_outstanding= Nombre d'actions en circulation (unités entières, pas en millions)\n" +
  "Mets null si un champ est absent. Ne renvoie rien d'autre que le JSON.";

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
