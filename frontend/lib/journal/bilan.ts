/**
 * Bilan a posteriori d'une thèse clôturée — calcul PUR.
 *
 * L'écart est CALCULÉ à partir du cours de clôture figé, jamais saisi.
 * `verdictCoherent` compare le verdict de l'utilisateur au mouvement réel — il
 * SIGNALE une incohérence sans jamais réécrire le choix de l'utilisateur.
 *
 * Voir docs/superpowers/specs/2026-07-26-journal-decision-design.md
 */
import type { Stance } from '@/lib/theses/status';

export interface BilanInput {
  stance: Stance;
  coursReference: number | null;
  objectif: number | null;
  coursCloture: number;
}

export interface Bilan {
  performancePct: number | null;      // (clôture - référence) / référence
  objectifAtteint: 'oui' | 'non' | 'sans-objet';
  verdictCoherent: boolean | null;    // null = non évalué (verdict non « jouee », ou pas de référence)
}

export function computeBilan(i: BilanInput, verdict: string): Bilan {
  const performancePct =
    i.coursReference != null && i.coursReference !== 0
      ? (i.coursCloture - i.coursReference) / i.coursReference
      : null;

  // Objectif atteint selon le sens de la thèse : un achat vise plus haut, une
  // vente vise plus bas. « conserver » n'a pas d'objectif directionnel ici.
  let objectifAtteint: Bilan['objectifAtteint'] = 'sans-objet';
  if (i.objectif != null) {
    if (i.stance === 'achat') objectifAtteint = i.coursCloture >= i.objectif ? 'oui' : 'non';
    else if (i.stance === 'vente') objectifAtteint = i.coursCloture <= i.objectif ? 'oui' : 'non';
  }

  // Cohérence évaluée UNIQUEMENT pour un verdict « jouee » (l'utilisateur affirme
  // que sa thèse s'est réalisée) et si l'on a une performance à comparer.
  // « invalidee » / « abandonnee » : l'utilisateur reconnaît lui-même l'issue,
  // rien à contredire.
  let verdictCoherent: boolean | null = null;
  if (verdict === 'jouee' && performancePct != null) {
    if (i.stance === 'achat') verdictCoherent = performancePct > 0;
    else if (i.stance === 'vente') verdictCoherent = performancePct < 0;
    else verdictCoherent = true; // « conserver » : pas de direction à contredire
  }

  return { performancePct, objectifAtteint, verdictCoherent };
}
