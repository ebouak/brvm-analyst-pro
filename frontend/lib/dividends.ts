export interface DividendRow {
  id: string;
  code: string;
  designation: string | null;
  secteur: string | null;
  pays: string | null;
  exercice: number | null;
  ex_date: string | null;
  payment_date: string | null;
  montant: number;
  cours_jour: number | null;
  rendement_pct: number | null;
}

export function computeYield(montant: number, cours: number | null): number | null {
  if (cours == null || cours <= 0) return null;
  return (montant / cours) * 100;
}

export function groupByYear(rows: DividendRow[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of rows) {
    if (row.exercice == null) continue;
    map.set(row.exercice, (map.get(row.exercice) ?? 0) + row.montant);
  }
  return map;
}
