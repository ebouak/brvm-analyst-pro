/**
 * Badge « Nouveau » / « Mis à jour » d'une leçon, d'un module ou d'un cours —
 * PUR, testé (2026-11-23).
 *
 * Le badge naît de la date écrite dans la leçon (`nouveaute.depuis`) et
 * s'éteint seul après DUREE_NOUVEAUTE_JOURS : un « nouveau » permanent finit
 * par ne plus rien dire, et personne n'a à penser à le retirer.
 */

export const DUREE_NOUVEAUTE_JOURS = 45;

export interface Nouveaute {
  type: 'nouveau' | 'mis_a_jour';
  /** AAAA-MM-JJ : mise en ligne. */
  depuis: string;
}

export interface Badge {
  type: Nouveaute['type'];
  libelle: 'Nouveau' | 'Mis à jour';
}

const JOUR_MS = 86_400_000;

export function badgeNouveaute(n: Nouveaute | null | undefined, maintenant: Date): Badge | null {
  if (!n || !/^\d{4}-\d{2}-\d{2}$/.test(n.depuis)) return null;
  const debut = Date.parse(`${n.depuis}T00:00:00Z`);
  if (!Number.isFinite(debut)) return null;
  const jours = (maintenant.getTime() - debut) / JOUR_MS;
  if (jours < 0 || jours > DUREE_NOUVEAUTE_JOURS) return null;
  return n.type === 'nouveau' ? { type: 'nouveau', libelle: 'Nouveau' } : { type: 'mis_a_jour', libelle: 'Mis à jour' };
}

/** Badge d'un ensemble de leçons (module ou cours) : « Nouveau » l'emporte sur « Mis à jour ». */
export function badgeEnsemble(
  lecons: readonly { nouveaute?: Nouveaute | null }[],
  maintenant: Date,
): Badge | null {
  const badges = lecons.map((l) => badgeNouveaute(l.nouveaute, maintenant)).filter((b): b is Badge => b != null);
  return badges.find((b) => b.type === 'nouveau') ?? badges[0] ?? null;
}
