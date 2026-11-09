/** Repères du graphique de séance : heures de la séance, repères de prix, heure du dernier relevé. */

const DEBUT = 9 * 60 + 15;

export function libelleHeure(m: number): string {
  const h = Math.floor(m / 60), mn = m % 60;
  return mn === 0 ? `${h} h` : `${h} h ${String(mn).padStart(2, '0')}`;
}

/** Séance BRVM : 9 h 15 → 15 h 45 (heure d'Abidjan = UTC). */
export function reperesHoraires(): { m: number; libelle: string }[] {
  return [DEBUT, 11 * 60, 13 * 60, 15 * 60 + 45].map((m) => ({ m, libelle: libelleHeure(m) }));
}

/** Bas, milieu (s'il est entier et distinct) et haut de la fenêtre de prix. */
export function reperesPrix(bas: number, haut: number): { valeur: number }[] {
  if (haut <= bas) return [{ valeur: bas }];
  const milieu = (bas + haut) / 2;
  return Number.isInteger(milieu) && milieu !== bas && milieu !== haut
    ? [{ valeur: bas }, { valeur: milieu }, { valeur: haut }]
    : [{ valeur: bas }, { valeur: haut }];
}

export function heureReleve(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return libelleHeure(d.getUTCHours() * 60 + d.getUTCMinutes());
}

/**
 * Avant la première transaction, brvm.org affiche le cours de la veille : ces relevés ne prouvent
 * aucun cours échangé. On ne garde que ceux à partir du premier dont le volume cumulé est > 0.
 * Sans transaction, la liste est vide.
 */
export function depuisPremiereTransaction<T extends { captured_at: string; volume: number | null }>(points: T[]): T[] {
  const tries = [...points].sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at));
  const i = tries.findIndex((p) => (p.volume ?? 0) > 0);
  return i < 0 ? [] : tries.slice(i);
}
