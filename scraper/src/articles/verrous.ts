/**
 * Ce qui rend un article publiable sans relecture. Même règle que la vidéo :
 * un verrou qui échoue laisse l'article en brouillon, avec sa raison.
 */
import { SEUIL_VARIATION_ABERRANTE } from '../cloture/plausibilite.js';
import { assertNoForeignNumber } from '../hebdo/polish.js';
import { ecartJours } from './calendrier.js';
import { AVERTISSEMENT } from './redaction.js';
import type { Fait } from './types.js';

export interface ArticleAVerifier {
  titre: string;
  chapo: string;
  corps_md: string;
  sources: unknown[];
  chiffres: number[];
}

export function verifier(
  a: ArticleAVerifier,
  f: Fait,
  ctx: { aujourdhui: string; derniereSeance: string },
): { ok: boolean; manquants: string[] } {
  const v = f.donnees.variation;
  const controles = {
    // Séance de 4 jours au plus : un vendredi lu le mardi suivant passe.
    fraicheur: ecartJours(ctx.derniereSeance, ctx.aujourdhui) <= 4,
    plausible: typeof v !== 'number' || Math.abs(v) <= SEUIL_VARIATION_ABERRANTE,
    chiffres_verifies: assertNoForeignNumber(`${a.titre}\n${a.chapo}\n${a.corps_md}`, a.chiffres),
    source_citee: a.sources.length > 0,
    avertissement: a.corps_md.includes(AVERTISSEMENT),
  };
  const manquants = Object.entries(controles)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  return { ok: manquants.length === 0, manquants };
}
