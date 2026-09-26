/**
 * Sonde réellement les trois fournisseurs LLM (DeepSeek, Mistral, xAI) et
 * alerte par Telegram dès qu'au moins l'un est en panne.
 *
 * POURQUOI UNE SONDE RÉELLE ET NON UNE SIMPLE VÉRIFICATION DE CONFIG : le
 * 2026-09-26, les clés étaient présentes ET valides — c'étaient les noms de
 * MODÈLE des deux fournisseurs de repli qui n'existaient plus. Seul un appel
 * HTTP réel le révèle (voir `evaluerSante.ts` pour les règles de classement).
 */
import { resolveApiKeyForScraper } from '../hebdo/apiKey.js';
import { sendTelegramText } from '../alerts/channels.js';
import { logger } from '../logger.js';
import {
  evaluerSante,
  construireMessageAlerte,
  type Fournisseur,
  type SondageFournisseur,
  type Verdict,
} from './evaluerSante.js';

/**
 * Triplets fournisseur / URL / modèle.
 *
 * DOUBLE DÉLIBÉRÉMENT de `frontend/lib/server/llmModels.ts` — deux paquets TS
 * distincts (scraper/ et frontend/), pas de module partagé entre eux, comme
 * `scraper/src/hebdo/pure/` duplique déjà des modules du frontend. TOUTE
 * CORRECTION de nom de modèle ou d'URL est à reporter DES DEUX CÔTÉS.
 *
 * Valeurs vérifiées par appel HTTP réel le 2026-09-26 — ne pas les changer
 * sans revérifier par un appel réel (`GET /v1/models` chez Mistral et xAI les
 * liste ; ne jamais se fier à la documentation, qui a menti la dernière fois).
 */
export const FOURNISSEURS_LLM: { fournisseur: Fournisseur; url: string; modele: string }[] = [
  { fournisseur: 'deepseek', url: 'https://api.deepseek.com/chat/completions', modele: 'deepseek-chat' },
  { fournisseur: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', modele: 'mistral-small-latest' },
  { fournisseur: 'xai', url: 'https://api.x.ai/v1/chat/completions', modele: 'grok-4.6' },
];

const TIMEOUT_MS = 10_000;

/** Sonde un fournisseur. Ne lève jamais : toute panne devient un `SondageFournisseur`. */
async function sonder(cible: (typeof FOURNISSEURS_LLM)[number]): Promise<SondageFournisseur> {
  const cle = await resolveApiKeyForScraper(cible.fournisseur);
  if (!cle) {
    return { fournisseur: cible.fournisseur, modele: cible.modele, statutHttp: null, cleAbsente: true };
  }
  try {
    const resp = await fetch(cible.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cible.modele, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let detail: string | undefined;
    if (!resp.ok) {
      const texte = await resp.text().catch(() => '');
      detail = texte ? texte.slice(0, 200) : undefined;
    }
    return { fournisseur: cible.fournisseur, modele: cible.modele, statutHttp: resp.status, detail, cleAbsente: false };
  } catch (err) {
    // Timeout (AbortSignal.timeout) ou erreur réseau : statutHttp reste null,
    // classé comme panne par evaluerSante — jamais une clé dans le détail.
    return {
      fournisseur: cible.fournisseur,
      modele: cible.modele,
      statutHttp: null,
      detail: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      cleAbsente: false,
    };
  }
}

export interface RunSanteLlmResult {
  sondages: SondageFournisseur[];
  verdict: Verdict;
  /** true si une alerte de panne a été envoyée (et confirmée) sur Telegram. */
  alerteEnvoyee: boolean;
}

export async function runSanteLlm(): Promise<RunSanteLlmResult> {
  const sondages = await Promise.all(FOURNISSEURS_LLM.map(sonder));
  const verdict = evaluerSante(sondages);

  logger.info(
    {
      niveau: verdict.niveau,
      utilisables: verdict.utilisables,
      etats: verdict.etats.map((e) => ({ fournisseur: e.fournisseur, etat: e.etat })),
    },
    'Santé LLM sondée',
  );

  let alerteEnvoyee = false;
  // Aucun envoi pour un niveau 'sain' : un 429 isolé ne doit rien déclencher,
  // sinon l'alerte deviendrait quotidienne et donc ignorée (voir evaluerSante.ts).
  if (verdict.enPanne.length > 0) {
    const message = construireMessageAlerte(verdict);
    const sujet =
      verdict.niveau === 'total'
        ? 'WESTBOURSE · PANNE TOTALE — plus aucun fournisseur LLM utilisable'
        : 'WESTBOURSE · un fournisseur LLM est en panne';
    // `operateur: true` explicite : ce message vise la conversation de
    // l'exploitant, pas un utilisateur — voir le commentaire de sendTelegram
    // dans src/alerts/channels.ts (aucun repli implicite n'existe).
    const res = await sendTelegramText({ subject: sujet, body: message, operateur: true });
    alerteEnvoyee = res?.status === 'sent';
    if (!alerteEnvoyee) {
      logger.error({ res }, 'Alerte santé LLM non envoyée (Telegram non configuré ou en échec)');
    }
  }

  return { sondages, verdict, alerteEnvoyee };
}
