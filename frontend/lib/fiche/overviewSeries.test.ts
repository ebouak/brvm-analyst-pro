import { describe, it, expect } from 'vitest';
import { seriesParPeriode, sousEchantillonner, debutPeriode } from './overviewSeries';

// Une clôture par jour ouvré du 2019-01-01 au 2026-11-06, cours = rang.
function serie(debut: string, fin: string) {
  const out: { date_marche: string; cours_jour: number | null }[] = [];
  const d = new Date(debut + 'T00:00:00Z');
  let i = 1;
  while (d.toISOString().slice(0, 10) <= fin) {
    const j = d.getUTCDay();
    if (j !== 0 && j !== 6) out.push({ date_marche: d.toISOString().slice(0, 10), cours_jour: i++ });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe('debutPeriode', () => {
  it('calcule les bornes calendaires', () => {
    expect(debutPeriode('1M', '2026-11-06')).toBe('2026-10-06');
    expect(debutPeriode('3M', '2026-11-06')).toBe('2026-08-06');
    expect(debutPeriode('YTD', '2026-11-06')).toBe('2026-01-01');
    expect(debutPeriode('1A', '2026-11-06')).toBe('2025-11-06');
    expect(debutPeriode('5A', '2026-11-06')).toBe('2021-11-06');
    expect(debutPeriode('Max', '2026-11-06')).toBeNull();
  });
});

describe('seriesParPeriode', () => {
  const rows = serie('2019-01-01', '2026-11-06');
  const s = seriesParPeriode(rows, 200);
  const p = (k: string) => s.find((x) => x.periode === k)!;

  it('propose les périodes dans l’ordre, sans 1J', () => {
    expect(s.map((x) => x.periode)).toEqual(['5J', '1M', 'YTD', '3M', '6M', '1A', '5A', 'Max']);
  });

  it('5J part de la clôture d’il y a 5 séances', () => {
    expect(p('5J').points).toHaveLength(6);
    const n = rows.length;
    expect(p('5J').variationPct).toBeCloseTo(((n - (n - 5)) / (n - 5)) * 100, 6);
  });

  it('une période calendaire part de la dernière clôture avant sa borne', () => {
    const ytd = p('YTD');
    expect(ytd.points[0]!.d).toBe('2025-12-31');
    expect(ytd.debut).toBe('2025-12-31');
    expect(ytd.fin).toBe('2026-11-06');
  });

  it('sous-échantillonne sans perdre premier ni dernier point', () => {
    const max = p('Max');
    expect(max.points.length).toBeLessThanOrEqual(200);
    expect(max.points[0]!.d).toBe('2019-01-01');
    expect(max.points.at(-1)!.d).toBe('2026-11-06');
    expect(max.variationPct).toBeCloseTo((rows.length - 1) * 100, 6);
  });

  it('ignore les clôtures nulles ou nulles à zéro, et une période à un seul point', () => {
    const r = [
      { date_marche: '2026-11-04', cours_jour: 0 },
      { date_marche: '2026-11-05', cours_jour: null },
      { date_marche: '2026-11-06', cours_jour: 100 },
    ];
    expect(seriesParPeriode(r)).toEqual([]);
  });

  it('vide sans données', () => {
    expect(seriesParPeriode([])).toEqual([]);
  });
});

describe('sousEchantillonner', () => {
  it('rend tel quel sous le plafond', () => {
    const pts = [{ d: 'a', c: 1 }, { d: 'b', c: 2 }];
    expect(sousEchantillonner(pts, 10)).toEqual(pts);
  });
  it('garde les extrêmes de chaque paquet', () => {
    const pts = Array.from({ length: 100 }, (_, i) => ({ d: String(i).padStart(3, '0'), c: i === 50 ? 999 : i }));
    const r = sousEchantillonner(pts, 20);
    expect(r.length).toBeLessThanOrEqual(20);
    expect(r.some((x) => x.c === 999)).toBe(true);
    expect(r[0]!.d).toBe('000');
    expect(r.at(-1)!.d).toBe('099');
  });
});
