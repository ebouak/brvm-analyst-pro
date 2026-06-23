import type { SectorPerf } from '@/lib/sectors';

/**
 * Filtre les perfs sectorielles sur les secteurs favoris de l'utilisateur,
 * en conservant l'ORDRE des favoris (et non l'ordre des perfs). Un favori sans
 * perf correspondante est ignoré. Fonction pure, testable.
 */
export function pickFavoriteSectorPerf(perfs: SectorPerf[], favorites: string[]): SectorPerf[] {
  const byName = new Map(perfs.map((p) => [p.secteur, p]));
  const out: SectorPerf[] = [];
  for (const fav of favorites) {
    const p = byName.get(fav);
    if (p) out.push(p);
  }
  return out;
}
