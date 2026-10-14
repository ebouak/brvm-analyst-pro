import { describe, it, expect } from 'vitest';
import { performanceJour } from './performanceJour';

const lignes = [
  { code: 'SNTS', quantite: 100, cours: 45000, variationPct: 0.04, dateMarche: '2026-10-12' },
  { code: 'TTLC', quantite: 300, cours: 3000, variationPct: 4.53, dateMarche: '2026-10-12' },
];
const indiceOk = { variationPct: -0.26, dateMarche: '2026-10-12' };

describe('performanceJour', () => {
  it('variation pondérée par la valeur de la veille, comparée à l indice de la même séance', () => {
    const r = performanceJour(lignes, { variationPct: -0.26, dateMarche: '2026-10-12' });
    const veille = 100 * (45000 / 1.0004) + 300 * (3000 / 1.0453); // jour = 5 400 000
    expect(r.portefeuillePct).toBeCloseTo((5_400_000 / veille - 1) * 100, 6);
    expect(r.variationFcfa).toBeCloseTo(5_400_000 - veille, 4);
    expect(r.indicePct).toBe(-0.26);
    expect(r.comparable).toBe(true);
    expect(r.dateMarche).toBe('2026-10-12');
    expect(r.raison).toBeNull();
  });

  it('indice d une autre séance : non comparable, l indice n est pas affiché', () => {
    const r = performanceJour(lignes, { variationPct: -0.26, dateMarche: '2026-10-09' });
    expect(r.comparable).toBe(false);
    expect(r.indicePct).toBeNull();
    expect(r.portefeuillePct).not.toBeNull();
    expect(r.raison).toBe("l'indice ne porte pas sur la même séance");
  });

  it('un cours absent : rien n est calculé, la raison est donnée', () => {
    const r = performanceJour([...lignes, { code: 'BOAN', quantite: 10, cours: null, variationPct: null, dateMarche: null }], null);
    expect(r.portefeuillePct).toBeNull();
    expect(r.raison).toContain('BOAN');
  });

  it('positions de séances différentes : non comparable', () => {
    const r = performanceJour([lignes[0]!, { ...lignes[1]!, dateMarche: '2026-10-09' }], { variationPct: 0, dateMarche: '2026-10-12' });
    expect(r.portefeuillePct).toBeNull();
    expect(r.comparable).toBe(false);
  });

  it('aucune position : rien à calculer', () => {
    const r = performanceJour([], { variationPct: -0.26, dateMarche: '2026-10-12' });
    expect(r.portefeuillePct).toBeNull();
    expect(r.comparable).toBe(false);
  });

  it('liquidités ignorées : elles n ont pas de cours et ne bloquent rien', () => {
    const sans = performanceJour(lignes, indiceOk);
    const avec = performanceJour(
      [...lignes, { code: 'LIQUIDITES', quantite: 250000, cours: null, variationPct: null, dateMarche: null }],
      indiceOk,
    );
    expect(avec.portefeuillePct).not.toBeNull();
    expect(avec.portefeuillePct).toBeCloseTo(sans.portefeuillePct!, 10);
    expect(avec.comparable).toBe(true);
  });

  it('seulement des liquidités : aucune position', () => {
    const r = performanceJour(
      [{ code: 'LIQUIDITES', quantite: 250000, cours: null, variationPct: null, dateMarche: null }],
      indiceOk,
    );
    expect(r.portefeuillePct).toBeNull();
    expect(r.raison).toBe('aucune position');
  });

  it('variation <= -100 : rien n est calculé, la raison nomme le code', () => {
    const r = performanceJour([...lignes, { code: 'XXXX', quantite: 5, cours: 100, variationPct: -100, dateMarche: '2026-10-12' }], indiceOk);
    expect(r.portefeuillePct).toBeNull();
    expect(r.variationFcfa).toBeNull();
    expect(r.raison).toContain('XXXX');
  });

  it('cours non fini : rien n est calculé, la raison nomme le code', () => {
    const r = performanceJour([...lignes, { code: 'YYYY', quantite: 5, cours: NaN, variationPct: 1, dateMarche: '2026-10-12' }], indiceOk);
    expect(r.portefeuillePct).toBeNull();
    expect(r.raison).toContain('YYYY');
  });

  it('quantité NaN ou nulle : ligne ignorée', () => {
    const base = performanceJour(lignes, indiceOk);
    const nan = performanceJour([...lignes, { code: 'AAAA', quantite: NaN, cours: null, variationPct: null, dateMarche: null }], indiceOk);
    const zero = performanceJour([...lignes, { code: 'BBBB', quantite: 0, cours: null, variationPct: null, dateMarche: null }], indiceOk);
    expect(nan).toEqual(base);
    expect(zero).toEqual(base);
  });

  it('indice null : portefeuille calculé, non comparable, indice indisponible', () => {
    const r = performanceJour(lignes, null);
    expect(r.portefeuillePct).not.toBeNull();
    expect(r.comparable).toBe(false);
    expect(r.indicePct).toBeNull();
    expect(r.raison).toBe('indice indisponible');
  });

  it('indice à variation NaN : même traitement que indice absent', () => {
    const r = performanceJour(lignes, { variationPct: NaN, dateMarche: '2026-10-12' });
    expect(r.portefeuillePct).not.toBeNull();
    expect(r.comparable).toBe(false);
    expect(r.indicePct).toBeNull();
    expect(r.raison).toBe('indice indisponible');
  });
});
