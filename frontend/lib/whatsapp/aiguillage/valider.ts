import { estIntention, type Intention } from './intentions';
import { QUESTION_INTENTION } from './requete';

export interface AiguillageValide {
  intention: Intention;
  probabilites: Partial<Record<Intention, number>>;
  societes: Record<string, number>;
}

const proba = (p: unknown): p is number => typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1;

/** Réponse complète et cohérente, sinon null (le message suit alors le chemin actuel). */
export function validerAiguillage(brut: unknown, codes: readonly string[]): AiguillageValide | null {
  if (!brut || typeof brut !== 'object') return null;
  const answers = (brut as { answers?: unknown }).answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const a = answers as Record<string, unknown>;

  const choix = a[QUESTION_INTENTION] as { type?: unknown; choice?: unknown; probabilities?: unknown } | undefined;
  if (!choix || choix.type !== 'choice' || !estIntention(choix.choice)) return null;
  if (!choix.probabilities || typeof choix.probabilities !== 'object') return null;
  const probabilites: Partial<Record<Intention, number>> = {};
  for (const [k, p] of Object.entries(choix.probabilities as Record<string, unknown>)) {
    if (!estIntention(k) || !proba(p)) return null;
    probabilites[k] = p;
  }
  if (probabilites[choix.choice] === undefined) return null;

  const attendus = new Set(codes);
  const societes: Record<string, number> = {};
  for (const [cle, rep] of Object.entries(a)) {
    if (cle === QUESTION_INTENTION) continue;
    if (!attendus.has(cle)) return null;
    const r = rep as { type?: unknown; noul?: unknown };
    if (r?.type !== 'noul' || !proba(r.noul)) return null;
    societes[cle] = r.noul;
  }
  if (Object.keys(societes).length !== attendus.size) return null;
  return { intention: choix.choice, probabilites, societes };
}
