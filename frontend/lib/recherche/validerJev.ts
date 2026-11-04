import { CLE_GLOBALE } from './jev';
import type { ResultatJevValide } from './types';

const probabilite = (reponse: unknown): number | null => {
  if (!reponse || typeof reponse !== 'object') return null;
  const r = reponse as { type?: unknown; noul?: unknown };
  if (r.type !== 'noul' || typeof r.noul !== 'number' || !Number.isFinite(r.noul) || r.noul < 0 || r.noul > 1) return null;
  return r.noul;
};

/**
 * Une réponse du fournisseur n'est utilisée que si elle est COMPLÈTE et
 * COHÉRENTE : chaque code attendu, aucun autre, aucune variante de casse,
 * chaque probabilité finie dans [0, 1]. Sinon : null, et la route se replie.
 */
export function validerReponseJev(brut: unknown, codes: readonly string[]): ResultatJevValide | null {
  if (!brut || typeof brut !== 'object') return null;
  const { answers, model } = brut as { answers?: unknown; model?: unknown };
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const attendus = new Set(codes);
  const vus = new Set<string>();
  const scores: Record<string, number> = {};
  let globale: number | null = null;
  for (const [cle, reponse] of Object.entries(answers as Record<string, unknown>)) {
    const p = probabilite(reponse);
    if (p === null) return null;
    if (cle === CLE_GLOBALE) {
      globale = p;
      continue;
    }
    if (!attendus.has(cle)) return null;
    const k = cle.toUpperCase();
    if (vus.has(k)) return null;
    vus.add(k);
    scores[cle] = p;
  }
  if (globale === null || vus.size !== attendus.size) return null;
  return { scores, pertinenceGlobale: globale, modele: typeof model === 'string' ? model : 'inconnu' };
}
