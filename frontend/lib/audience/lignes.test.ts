import { describe, it, expect } from 'vitest';
import { lireContinents, lirePays, sousTotalUemoa, delta, fmtDelta, fmtDuree, pivoterTendance, nombre, lireClics, lireSessions } from './lignes';

describe('lecture des lignes', () => {
  it('nombre refuse l\'illisible', () => { expect(nombre('12')).toBe(12); expect(nombre('x')).toBe(0); expect(nombre(null)).toBe(0); });
  it('Afrique en tête quel que soit le volume', () => {
    const c = lireContinents([['EU', 'Europe', 90, 100], ['AF', 'Africa', 10, 12], [null, null, 5, 5]]);
    expect(c.map((x) => x.nom)).toEqual(['Afrique', 'Europe', 'Inconnu']);
  });
  it('sous-total UEMOA = pays UEMOA seulement', () => {
    const p = lirePays([['CI', "Côte d'Ivoire", 10, 20], ['SN', 'Senegal', 5, 6], ['MA', 'Morocco', 7, 9]]);
    expect(sousTotalUemoa(p)).toEqual({ personnes: 15, sessions: 26, pays: 2 });
    expect(p[0].nom).toBe("Côte d'Ivoire");
  });
  it('delta : null sans référence, jamais infini', () => {
    expect(delta(110, 100)).toBeCloseTo(10);
    expect(delta(5, 0)).toBeNull();
    expect(delta(5, null)).toBeNull();
    expect(delta(0, 10)).toBe(-100);
  });
  it('formats', () => {
    expect(fmtDelta(10.4)).toBe('+10 %'); expect(fmtDelta(-3)).toBe('-3 %'); expect(fmtDelta(null)).toBe('n/d');
    expect(fmtDuree(75)).toBe('1 min 15 s'); expect(fmtDuree(null)).toBe('—');
  });
  it('tendance pivotée : zéros explicites et Afrique d\'abord', () => {
    const { donnees, continents } = pivoterTendance([
      { semaine: '2026-10-05', continent: 'Europe', personnes: 9 },
      { semaine: '2026-10-05', continent: 'Afrique', personnes: 2 },
      { semaine: '2026-10-12', continent: 'Europe', personnes: 4 },
    ]);
    expect(continents).toEqual(['Afrique', 'Europe']);
    expect(donnees[1]).toEqual({ semaine: '2026-10-12', Europe: 4, Afrique: 0 });
  });
  it('les libellés de clic sont gardés tels quels', () => {
    expect(lireClics([['fermeture (✕)', 3, 2]])[0].libelle).toBe('fermeture (✕)');
  });
  it('sessions sans donnée : moyennes nulles, pas zéro', () => {
    const s = lireSessions([0, null, null, null]);
    expect(s.dureeMoyenneS).toBeNull();
  });
});
