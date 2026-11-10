// Saisonnalité v2, lot 3 — F5, calendrier des habitudes d'une valeur. PUR, testé.
// À partir des événements datés de `saisonnalite_mensuelle.evenements`.

export type TypeFrise = 'comptes_annuels' | 'comptes_semestriels' | 'convocation_ag' | 'detachement';
export const TYPES_FRISE: TypeFrise[] = ['comptes_annuels', 'comptes_semestriels', 'convocation_ag', 'detachement'];

export interface Habitude {
  type: TypeFrise;
  /** Mois (1-12) où l'événement tombe le plus souvent ; à égalité, le plus tôt. */
  moisHabituel: number;
  /** Années où l'événement est tombé ce mois-là. */
  annees: number;
  /** Années où l'événement a eu lieu au moins une fois. */
  sur: number;
  /** Nombre d'années par mois (index 0 = janvier). */
  parMois: number[];
}

export function habitudes(evenements: { type: string; date: string }[]): Habitude[] {
  const out: Habitude[] = [];
  for (const type of TYPES_FRISE) {
    const evts = evenements.filter((e) => e.type === type);
    if (evts.length === 0) continue;
    const parMoisAnnees = Array.from({ length: 12 }, () => new Set<number>());
    const anneesTotal = new Set<number>();
    for (const e of evts) {
      const annee = Number(e.date.slice(0, 4));
      parMoisAnnees[Number(e.date.slice(5, 7)) - 1]!.add(annee);
      anneesTotal.add(annee);
    }
    const parMois = parMoisAnnees.map((s) => s.size);
    const max = Math.max(...parMois);
    out.push({ type, moisHabituel: parMois.indexOf(max) + 1, annees: max, sur: anneesTotal.size, parMois });
  }
  return out;
}
