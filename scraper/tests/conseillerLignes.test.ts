import { describe, it, expect } from 'vitest';
import { lignesFacteurs, tierDe, verifierEcriture, MOTEUR_VERSION } from '../src/conseiller/lignes.js';

const sc = (t: number | null, r: number | null) => ({ valorisation: null, qualite: null, rendement: null, tendance: t, risque: r });

describe('tierDe', () => {
  it('découpe en tiers', () => {
    expect(tierDe(0.5)).toBe('haut');
    expect(tierDe(1 / 3)).toBe('haut');
    expect(tierDe(0)).toBe('milieu');
    expect(tierDe(-1 / 3)).toBe('bas');
    expect(tierDe(null)).toBeNull();
  });
});

describe('lignesFacteurs', () => {
  it('produit une ligne par valeur avec tiers et effectifs par famille', () => {
    const scores = new Map([['A', sc(0.8, -0.5)], ['B', sc(-0.8, null)]]);
    const classes = new Map([['A', 'B' as const], ['B', null]]);
    const l = lignesFacteurs('2026-11-06', scores, classes);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ date_marche: '2026-11-06', code: 'A', classe_liquidite: 'B', moteur_version: MOTEUR_VERSION });
    expect(l[0]!.tiers).toEqual({ valorisation: null, qualite: null, rendement: null, tendance: 'haut', risque: 'bas' });
    expect(l[0]!.effectifs).toEqual({ valorisation: 0, qualite: 0, rendement: 0, tendance: 2, risque: 1 });
    expect(l[1]!.classe_liquidite).toBeNull();
  });
});

describe('verifierEcriture', () => {
  const ligne = (code: string, t: number | null) => lignesFacteurs('2026-11-06', new Map([[code, sc(t, t)]]), new Map([[code, 'A' as const]]))[0]!;
  it('accepte un lot complet sur la bonne séance', () => {
    const lot = Array.from({ length: 47 }, (_, i) => ligne(`V${i}`, 0.5));
    expect(verifierEcriture(lot, '2026-11-06', 48)).toEqual([]);
  });
  it('refuse une mauvaise séance', () => {
    expect(verifierEcriture([ligne('A', 0.5)], '2026-11-07', 1)[0]).toMatch(/séance/);
  });
  it('refuse un lot trop court (moins que cotées − 2)', () => {
    const lot = Array.from({ length: 40 }, (_, i) => ligne(`V${i}`, 0.5));
    expect(verifierEcriture(lot, '2026-11-06', 48).join(' ')).toMatch(/lignes/);
  });
  it('refuse plus de 30 % de lignes entièrement nulles', () => {
    const lot = [...Array.from({ length: 30 }, (_, i) => ligne(`V${i}`, 0.5)), ...Array.from({ length: 18 }, (_, i) => ligne(`N${i}`, null))];
    expect(verifierEcriture(lot, '2026-11-06', 48).join(' ')).toMatch(/nulles/);
  });
});
