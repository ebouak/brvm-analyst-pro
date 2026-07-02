import { describe, it, expect } from 'vitest';
import { mergeActionRow, flashDirection, type RealtimeActionRow } from './mergeActions';

const base: RealtimeActionRow[] = [
  { code: 'SNTS', cours_jour: 15000, variation_pct: 1.2 },
  { code: 'ETIT', cours_jour: 3000, variation_pct: -0.5 },
];

describe('flashDirection', () => {
  it('up quand le cours monte, down quand il baisse', () => {
    expect(flashDirection(100, 110)).toBe('up');
    expect(flashDirection(110, 100)).toBe('down');
  });
  it('none si égal ou valeur manquante', () => {
    expect(flashDirection(100, 100)).toBe('none');
    expect(flashDirection(null, 100)).toBe('none');
    expect(flashDirection(100, null)).toBe('none');
  });
});

describe('mergeActionRow', () => {
  it('remplace la ligne de même code et calcule la direction', () => {
    const r = mergeActionRow(base, { code: 'SNTS', cours_jour: 15500, variation_pct: 2.0 });
    expect(r.changed).toBe(true);
    expect(r.direction).toBe('up');
    expect(r.rows.find((x) => x.code === 'SNTS')!.cours_jour).toBe(15500);
    expect(r.rows).toHaveLength(2);
  });

  it('ajoute une ligne dont le code est absent (direction none)', () => {
    const r = mergeActionRow(base, { code: 'PALC', cours_jour: 6000, variation_pct: 0 });
    expect(r.changed).toBe(true);
    expect(r.direction).toBe('none');
    expect(r.rows).toHaveLength(3);
  });

  it('ne signale aucun changement si cours et variation identiques (pas de flash inutile)', () => {
    const r = mergeActionRow(base, { code: 'SNTS', cours_jour: 15000, variation_pct: 1.2 });
    expect(r.changed).toBe(false);
    expect(r.direction).toBe('none');
    expect(r.rows).toBe(base); // même référence, aucune re-render inutile
  });

  it('direction down quand le cours baisse', () => {
    const r = mergeActionRow(base, { code: 'ETIT', cours_jour: 2900, variation_pct: -1.0 });
    expect(r.direction).toBe('down');
  });

  it("n'altère jamais le tableau d'entrée (immutabilité)", () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    mergeActionRow(base, { code: 'SNTS', cours_jour: 99999, variation_pct: 9 });
    expect(base).toEqual(snapshot);
  });
});
