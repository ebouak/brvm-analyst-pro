import { describe, it, expect } from 'vitest';
import { majIndice } from './indices';

const base = [
  { code: 'BRVMC', valeur: 300.5, variation_pct: 0.4, libelle: 'BRVM Composite' },
  { code: 'BRVM30', valeur: 150.2, variation_pct: -0.1, libelle: 'BRVM 30' },
];

describe('majIndice', () => {
  it('met à jour valeur et variation, garde les autres champs', () => {
    const r = majIndice(base, { code: 'BRVMC', valeur: 301, variation_pct: 0.57 });
    expect(r.change).toBe(true);
    expect(r.direction).toBe('up');
    expect(r.indices[0]).toEqual({ code: 'BRVMC', valeur: 301, variation_pct: 0.57, libelle: 'BRVM Composite' });
    expect(r.indices[1]).toBe(base[1]);
  });

  it('signale une baisse', () => {
    expect(majIndice(base, { code: 'BRVM30', valeur: 149.9, variation_pct: -0.3 }).direction).toBe('down');
  });

  it('ignore un indice inconnu', () => {
    const r = majIndice(base, { code: 'BRVMPRES', valeur: 120, variation_pct: 1 });
    expect(r.change).toBe(false);
    expect(r.indices).toBe(base);
  });

  it("un null reçu n'efface pas la valeur connue", () => {
    const r = majIndice(base, { code: 'BRVMC', valeur: null, variation_pct: 0.5 });
    expect(r.indices[0]!.valeur).toBe(300.5);
    expect(r.indices[0]!.variation_pct).toBe(0.5);
    expect(r.direction).toBe('none');
  });

  it('rien ne change : même référence, pas de flash', () => {
    const r = majIndice(base, { code: 'BRVMC', valeur: 300.5, variation_pct: 0.4 });
    expect(r.change).toBe(false);
    expect(r.indices).toBe(base);
  });
});
