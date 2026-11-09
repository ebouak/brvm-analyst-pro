import type { Donnees, Serie, FamilleComptable, ComptesAnnuels, Dividende } from '../src/conseiller/types.js';

/** Calendrier de n séances ouvrées consécutives à partir du 2020-01-01 (dates ISO). */
export function calendrier(n: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(2020, 0, 1));
  while (out.length < n) {
    const j = d.getUTCDay();
    if (j !== 0 && j !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Série à partir de cours ; volume 1000 sauf aux indices listés dans `figees`. */
export function serie(dates: string[], cours: number[], figees: number[] = []): Serie {
  const volumes = cours.map((_, i) => (figees.includes(i) ? 0 : 1000));
  return {
    dates: [...dates],
    cours: [...cours],
    volumes,
    valeurs: cours.map((c, i) => c * volumes[i]!),
    variations: cours.map((c, i) => (i === 0 ? null : (c / cours[i - 1]! - 1) * 100)),
    pos: new Map(dates.map((d, i) => [d, i])),
  };
}

/** Univers de valeurs ; la valeur k a une tendance de `pentes[k]` % par séance. */
export function univers(nbSeances: number, pentes: number[], famille: FamilleComptable = 'general'): Donnees {
  const cal = calendrier(nbSeances);
  const series = new Map<string, Serie>();
  const familles = new Map<string, FamilleComptable>();
  pentes.forEach((p, k) => {
    const code = `V${String(k).padStart(2, '0')}`;
    const cours = cal.map((_, i) => 1000 * (1 + p / 100) ** i);
    series.set(code, serie(cal, cours));
    familles.set(code, famille);
  });
  return { calendrier: cal, series, comptes: [] as ComptesAnnuels[], dividendes: [] as Dividende[], familles, ruptures: new Map(), titres: new Map() };
}
