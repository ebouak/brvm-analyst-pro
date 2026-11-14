import { describe, expect, it } from 'vitest';
import { dureeFr, placement, type DividendePlacement, type PointSerie } from './placement';

/** Une clôture par mois, le 15, sur `n` mois à partir de `debut` (AAAA-MM), cours = f(i). */
function mensuelle(debut: string, n: number, f: (i: number) => number): PointSerie[] {
  const [a, m] = debut.split('-').map(Number) as [number, number];
  const out: PointSerie[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(a, m - 1 + i, 15, 12));
    out.push({ date: d.toISOString().slice(0, 10), close: f(i) });
  }
  return out;
}

const div = (d: Partial<DividendePlacement>): DividendePlacement => ({
  exercice: null, montant: null, ex_date: null, payment_date: null, base_fiscale: null, ...d,
});

describe('placement', () => {
  // 61 mois : 2021-10-15 → 2026-10-15, cours 1000 → 2500 (linéaire).
  const serie = mensuelle('2021-10', 61, (i) => 1000 + (i * 1500) / 60);

  it('valorise le titre seul : cours final / cours de départ, sans dividendes', () => {
    const r = placement({ investi: 1_000_000, serie, serieIndice: [], dividendes: [], tauxIrvm: 0.12 })!;
    expect(r.date_depart).toBe('2021-10-15');
    expect(r.date_fin).toBe('2026-10-15');
    expect(r.periode_reduite).toBe(false);
    expect(r.titres).toBeCloseTo(1000, 6);
    expect(r.valeur_cours).toBeCloseTo(2_500_000, 3);
    expect(r.variation_cours).toBeCloseTo(1.5, 9);
    expect(r.dividendes_nets).toBe(0);
    expect(r.valeur_totale).toBeCloseTo(2_500_000, 3);
    expect(r.rendement_total).toBeCloseTo(1.5, 9);
  });

  it('un dividende NET est compté tel quel, un BRUT est diminué de l’impôt', () => {
    const r = placement({
      investi: 1_000_000,
      serie,
      serieIndice: [],
      tauxIrvm: 0.1,
      dividendes: [
        div({ exercice: 2022, montant: 100, ex_date: '2023-06-01', base_fiscale: 'net' }),
        div({ exercice: 2023, montant: 100, ex_date: '2024-06-01', base_fiscale: 'brut' }),
      ],
    })!;
    // 1000 titres : 100 net + 90 (100 brut − 10 %) = 190 par titre.
    expect(r.nb_dividendes).toBe(2);
    expect(r.dividendes_nets).toBeCloseTo(190_000, 6);
    expect(r.valeur_totale).toBeCloseTo(2_500_000 + 190_000, 3);
  });

  it('une base fiscale inconnue (ou un brut sans taux) n’est pas supposée : le dividende est écarté et compté', () => {
    const r = placement({
      investi: 1_000_000,
      serie,
      serieIndice: [],
      tauxIrvm: null,
      dividendes: [
        div({ exercice: 2022, montant: 100, ex_date: '2023-06-01', base_fiscale: 'inconnu' }),
        div({ exercice: 2023, montant: 100, ex_date: '2024-06-01', base_fiscale: 'brut' }),
      ],
    })!;
    expect(r.nb_dividendes).toBe(0);
    expect(r.dividendes_nets).toBe(0);
    expect(r.dividendes_exclus_base).toBe(2);
  });

  it('un détachement avant l’achat ou après la fin n’est pas compté', () => {
    const r = placement({
      investi: 1_000_000,
      serie,
      serieIndice: [],
      tauxIrvm: 0.1,
      dividendes: [
        div({ exercice: 2020, montant: 100, ex_date: '2021-05-01', base_fiscale: 'net' }),
        div({ exercice: 2021, montant: 100, ex_date: '2021-10-15', base_fiscale: 'net' }), // le jour de l'achat : déjà détaché
        div({ exercice: 2026, montant: 100, ex_date: '2026-11-30', base_fiscale: 'net' }),
      ],
    })!;
    expect(r.nb_dividendes).toBe(0);
  });

  it('sans date : rattaché à l’année suivant l’exercice seulement si cette année est entièrement dans la période', () => {
    const r = placement({
      investi: 1_000_000,
      serie,
      serieIndice: [],
      tauxIrvm: 0.1,
      dividendes: [
        div({ exercice: 2021, montant: 100, base_fiscale: 'net' }), // versé en 2022 : dedans
        div({ exercice: 2022, montant: 100, base_fiscale: 'net' }), // 2023 : dedans
        div({ exercice: 2020, montant: 100, base_fiscale: 'net' }), // 2021 : année de départ, ambigu
        div({ exercice: 2025, montant: 100, base_fiscale: 'net' }), // 2026 : année de fin, ambigu
      ],
    })!;
    expect(r.nb_dividendes).toBe(2);
    expect(r.dividendes_nets).toBeCloseTo(200_000, 6);
    expect(r.dividendes_non_dates).toBe(2);
  });

  it('un seul dividende par exercice, celui qui porte une date l’emporte ; les zéros sont ignorés', () => {
    const r = placement({
      investi: 1_000_000,
      serie,
      serieIndice: [],
      tauxIrvm: 0.1,
      dividendes: [
        div({ exercice: 2022, montant: 100, base_fiscale: 'net' }),
        div({ exercice: 2022, montant: 100, ex_date: '2023-06-01', base_fiscale: 'net' }),
        div({ exercice: 2023, montant: 0, ex_date: '2024-06-01', base_fiscale: 'net' }),
      ],
    })!;
    expect(r.nb_dividendes).toBe(1);
  });

  it('historique plus court que cinq ans : prend la plus longue période et le dit', () => {
    const courte = mensuelle('2024-10', 25, (i) => 2000 + i * 10); // 24 mois
    const r = placement({ investi: 1_000_000, serie: courte, serieIndice: [], dividendes: [], tauxIrvm: 0.1 })!;
    expect(r.periode_reduite).toBe(true);
    expect(r.date_depart).toBe(courte[0]!.date);
    expect(r.annees_visees).toBe(5);
  });

  it('moins de six mois de cotation : null, jamais un rendement de quelques semaines', () => {
    const tresCourte = mensuelle('2026-07', 4, (i) => 100 + i);
    expect(placement({ investi: 1_000_000, serie: tresCourte, serieIndice: [], dividendes: [], tauxIrvm: 0.1 })).toBeNull();
    expect(placement({ investi: 1_000_000, serie: [], serieIndice: [], dividendes: [], tauxIrvm: 0.1 })).toBeNull();
  });

  it('indice dont l’historique commence APRÈS le départ : pas de comparaison, la raison est dite', () => {
    const indice = mensuelle('2026-05', 6, (i) => 400 + i);
    const r = placement({ investi: 1_000_000, serie, serieIndice: indice, dividendes: [], tauxIrvm: 0.1 })!;
    expect(r.variation_indice).toBeNull();
    expect(r.indice_raison).toMatch(/ne commence que le 15\/05\/2026/);
  });

  it('indice couvrant la période : variation entre les deux dates', () => {
    const indice = mensuelle('2021-09', 62, (i) => 200 + i * 2); // couvre dès septembre 2021
    const r = placement({ investi: 1_000_000, serie, serieIndice: indice, dividendes: [], tauxIrvm: 0.1 })!;
    expect(r.indice_raison).toBeNull();
    // départ 2021-10-15 = indice[1] = 202 ; fin 2026-10-15 = indice[61] = 322
    expect(r.variation_indice).toBeCloseTo(322 / 202 - 1, 9);
  });

  it('les clôtures nulles ou négatives sont écartées avant tout calcul', () => {
    const sale = [...serie];
    sale[10] = { date: sale[10]!.date, close: 0 };
    const r = placement({ investi: 1_000_000, serie: sale, serieIndice: [], dividendes: [], tauxIrvm: 0.1 })!;
    expect(Number.isFinite(r.valeur_cours)).toBe(true);
  });
});

describe('dureeFr', () => {
  it('années et mois, accords compris', () => {
    expect(dureeFr(365.25 * 5)).toBe('5 ans');
    expect(dureeFr(365.25 * 4 + 335)).toBe('4 ans et 11 mois');
    expect(dureeFr(365.25 * 1)).toBe('1 an');
    expect(dureeFr(250)).toBe('8 mois');
    expect(dureeFr(3)).toBe('moins d’un mois');
  });
});
