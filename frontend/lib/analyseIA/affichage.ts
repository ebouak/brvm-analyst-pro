/** Libellés fixes d'« Analyse par IA » (module PUR, client). */
import type { Provenance } from './types';

export const AVERTISSEMENT_ANALYSE =
  'Les réponses sont générées à partir des données de WESTBOURSE. Elles ne sont pas vérifiées par un humain : comparez-les avec d’autres sources. Ce n’est pas un conseil en investissement ni une recommandation personnalisée.';

export function libelleProvenance(p: Provenance): string {
  return p === 'jev'
    ? 'Réponse Jev · type-safe · données WESTBOURSE, sans rédaction par IA'
    : 'Réponse rédigée par IA à partir des données WESTBOURSE';
}

/** Texte copié : la réponse, sa provenance et ses sources, jamais sans elles. */
export function texteACopier(reponse: string, p: Provenance | null, sources: string[]): string {
  return [reponse.trim(), p ? libelleProvenance(p) : null, sources.length ? `Sources : ${sources.join(' ; ')}` : null, AVERTISSEMENT_ANALYSE]
    .filter(Boolean)
    .join('\n\n');
}
