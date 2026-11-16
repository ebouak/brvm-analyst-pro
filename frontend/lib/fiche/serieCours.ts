/**
 * Séries du graphique de cours de la fiche valeur (`components/PriceChart.tsx`).
 *
 * Règle : aucun chiffre inventé. Ce graphique ne reçoit que la clôture et le
 * volume ; il trace donc une COURBE de clôture, jamais de bougie. Une bougie
 * fabriquée (ouverture = clôture de la veille, plus haut / plus bas à ±0,1 %)
 * afficherait une ouverture et des extrêmes qui n'ont pas existé. Les vraies
 * bougies, quand la base porte l'ouverture et les extrêmes, vivent dans le
 * graphique avancé (`/actions/[code]/graphique`, `lib/graphique/donnees.ts`).
 *
 * Logique pure : aucune lecture de base.
 */

export interface PointCours {
  date: string;
  close: number | null;
  volume: number | null;
}

/** Point de la courbe : une séance dont la clôture est connue. */
export interface PointCourbe {
  date: string;
  valeur: number;
}

const prixValide = (x: number | null | undefined): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x > 0;

/** Courbe de clôture : seules les séances dont la clôture existe (et est > 0). */
export function serieCloture(points: readonly PointCours[]): PointCourbe[] {
  return points.filter((p) => prixValide(p.close)).map((p) => ({ date: p.date, valeur: p.close as number }));
}

/** Barres de volume : seules les séances dont le volume est connu. Un volume absent n'est pas un zéro. */
export function serieVolume(points: readonly PointCours[]): PointCourbe[] {
  return points
    .filter((p) => typeof p.volume === 'number' && Number.isFinite(p.volume) && p.volume >= 0)
    .map((p) => ({ date: p.date, valeur: p.volume as number }));
}

/** Lundi (ISO) de la semaine d'une date AAAA-MM-JJ, calculé en UTC. */
export function lundiDeLaSemaine(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Agrégation hebdomadaire : clôture = dernière clôture connue de la semaine,
 * volume = somme des volumes connus, `null` si aucun ne l'est (jamais un zéro
 * fabriqué). Une semaine sans aucune clôture est omise.
 */
export function agregerHebdo(points: readonly PointCours[]): PointCours[] {
  const parSemaine = new Map<string, { close: number | null; volumes: number[] }>();
  for (const p of [...points].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!prixValide(p.close)) continue;
    const cle = lundiDeLaSemaine(p.date);
    let s = parSemaine.get(cle);
    if (!s) parSemaine.set(cle, (s = { close: null, volumes: [] }));
    s.close = p.close;
    if (typeof p.volume === 'number' && Number.isFinite(p.volume)) s.volumes.push(p.volume);
  }
  return [...parSemaine.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({
      date,
      close: s.close,
      volume: s.volumes.length ? s.volumes.reduce((a, b) => a + b, 0) : null,
    }));
}
