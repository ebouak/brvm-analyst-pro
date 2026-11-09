import { decider } from './decision.js';
import { scoresFamilles } from './facteurs.js';
import { classeA } from './liquiditeGlissante.js';
import type { Indice } from './indice.js';
import type { Decision, Donnees } from './types.js';

/**
 * FONCTION UNIQUE appelée par le banc ET par le futur job quotidien (spec §6).
 * Décisions de toutes les valeurs cotées à `date`, avec les seules données
 * antérieures ou égales à `date`. Triées par code (sortie déterministe).
 */
export function evaluerSeance(d: Donnees, ind: Indice, date: string, univers?: (code: string) => boolean): Decision[] {
  const scores = scoresFamilles(d, ind, date, univers);
  const out: Decision[] = [];
  for (const [code, sc] of [...scores].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const classe = classeA(d.series.get(code)!, d.calendrier, date);
    out.push({ code, date, scores: sc, ...decider(sc, classe) });
  }
  return out;
}
