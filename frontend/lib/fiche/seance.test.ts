import { describe, it, expect } from 'vitest';
import { reperesHoraires, reperesPrix, heureReleve, depuisPremiereTransaction } from './seance';

describe('reperesHoraires', () => {
  it('quatre repères de la séance, en heures françaises', () => {
    expect(reperesHoraires().map((r) => r.libelle)).toEqual(['9 h 15', '11 h', '13 h', '15 h 45']);
  });
  it('minutes depuis minuit, croissantes', () => {
    expect(reperesHoraires().map((r) => r.m)).toEqual([555, 660, 780, 945]);
  });
});

describe('reperesPrix', () => {
  it('bas, milieu, haut', () => expect(reperesPrix(1000, 1200).map((r) => r.valeur)).toEqual([1000, 1100, 1200]));
  it('deux repères si bas et haut sont proches du milieu entier', () => expect(reperesPrix(1000, 1001).map((r) => r.valeur)).toEqual([1000, 1001]));
  it('un seul si cours plat', () => expect(reperesPrix(500, 500).map((r) => r.valeur)).toEqual([500]));
});

describe('heureReleve', () => {
  it('heure du dernier relevé (UTC = heure de la BRVM)', () => expect(heureReleve('2026-11-06T14:32:10Z')).toBe('14 h 32'));
  it('invalide', () => expect(heureReleve('n/a')).toBeNull());
});

describe('depuisPremiereTransaction', () => {
  const p = (h: string, volume: number | null) => ({ captured_at: `2026-11-06T${h}:00Z`, volume });
  it('écarte les relevés sans volume et garde le premier avec volume', () => {
    const r = depuisPremiereTransaction([p('09:30', 0), p('09:15', null), p('09:45', 120), p('10:00', 300)]);
    expect(r.map((x) => x.volume)).toEqual([120, 300]);
  });
  it('trie par heure avant de chercher', () => {
    const r = depuisPremiereTransaction([p('10:00', 300), p('09:15', 0), p('09:45', 120)]);
    expect(r[0]!.volume).toBe(120);
  });
  it('aucune transaction : rien', () => {
    expect(depuisPremiereTransaction([p('09:15', 0), p('09:30', null)])).toEqual([]);
    expect(depuisPremiereTransaction([])).toEqual([]);
  });
});
