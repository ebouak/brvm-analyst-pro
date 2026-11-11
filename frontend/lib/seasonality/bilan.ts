// Saisonnalité v2, lot 4 — F11, bilan public. PUR, testé.
// Lit `saisonnalite_bilans` (profils figés au début du mois, puis réalisé).
// Les valeurs d'un même mois bougent ensemble : 49 valeurs ne font pas
// 49 observations. On compte donc des MOIS (conseil fable-advisor, 2026-11-11).

export const PCT_MIN_MOIS = 5;

export interface LigneBilan { code: string; annee: number; mois: number; verdict: string; tenue: boolean | null; realise: number | null }
export type StatutMois = 'en_cours' | 'tenu' | 'non_tenu' | 'sans_objet';
export interface MoisBilan { annee: number; mois: number; profils: number; comptees: number; tenues: number; statut: StatutMois }

export function resumeBilans(lignes: LigneBilan[]): { mois: MoisBilan[]; moisClos: number; moisTenus: number; pourcentage: number | null } {
  const parMois = new Map<string, LigneBilan[]>();
  for (const l of lignes) {
    const cle = `${l.annee}-${String(l.mois).padStart(2, '0')}`;
    if (!parMois.has(cle)) parMois.set(cle, []);
    parMois.get(cle)!.push(l);
  }
  const mois: MoisBilan[] = [...parMois.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, ls]) => {
      const realises = ls.filter((l) => l.realise != null);
      const comptees = ls.filter((l) => l.tenue != null);
      const tenues = comptees.filter((l) => l.tenue).length;
      const statut: StatutMois = realises.length === 0 ? 'en_cours'
        : comptees.length === 0 ? 'sans_objet'
        : tenues * 2 > comptees.length ? 'tenu' : 'non_tenu';
      return { annee: ls[0]!.annee, mois: ls[0]!.mois, profils: ls.length, comptees: comptees.length, tenues, statut };
    });
  const clos = mois.filter((m) => m.statut === 'tenu' || m.statut === 'non_tenu');
  const moisTenus = clos.filter((m) => m.statut === 'tenu').length;
  return { mois, moisClos: clos.length, moisTenus, pourcentage: clos.length >= PCT_MIN_MOIS ? moisTenus / clos.length : null };
}
