import { describe, it, expect } from 'vitest';
import { plageSurFenetre } from './plages';

const rows = [
  { date_marche: '2024-12-26', cours_jour: 405 },
  { date_marche: '2025-11-06', cours_jour: 925 },
  { date_marche: '2025-11-07', cours_jour: 975 },
  { date_marche: '2026-04-08', cours_jour: 3895 },
  { date_marche: '2026-05-01', cours_jour: 0 },
  { date_marche: '2026-11-06', cours_jour: 1950 },
];

describe('plageSurFenetre', () => {
  it('52 semaines : fenêtre de 365 jours inclusive (STAC : 925, pas 405)', () => {
    const p = plageSurFenetre(rows, '2026-11-06', 365, 1950)!;
    expect(p.bas).toBe(925);
    expect(p.dateBas).toBe('2025-11-06');
    expect(p.haut).toBe(3895);
    expect(p.dateHaut).toBe('2026-04-08');
    expect(p.position).toBeCloseTo((1950 - 925) / (3895 - 925), 4);
  });
  it('2 ans : reprend le plus bas de décembre 2024', () => {
    expect(plageSurFenetre(rows, '2026-11-06', 730, 1950)!.bas).toBe(405);
  });
  it('ignore les zéros et rend null sans donnée', () => {
    expect(plageSurFenetre([{ date_marche: '2026-11-06', cours_jour: 0 }], '2026-11-06', 365, 1950)).toBeNull();
  });
});
