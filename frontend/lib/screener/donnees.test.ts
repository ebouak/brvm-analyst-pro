import { describe, it, expect } from 'vitest';
import { dernierSignalParCode, dernierDividendeParCode, rsiParCode, ratioVolumeParCode } from './donnees';
import { applyFilters, exclusFauteDeDonnee, type ActionRow } from './filters';

describe('dernierSignalParCode', () => {
  it('prend le signal de la veille quand la séance du jour n’est pas encore notée', () => {
    const m = dernierSignalParCode(
      [
        { code: 'SNTS', date_marche: '2026-11-11', score_total: 0.1 },
        { code: 'SNTS', date_marche: '2026-11-12', score_total: 0.2 },
      ],
      '2026-11-13',
    );
    expect(m.get('SNTS')?.score_total).toBe(0.2);
  });
  it('ignore un signal postérieur à la date de cotation', () => {
    const m = dernierSignalParCode([{ code: 'X', date_marche: '2026-11-14', score_total: 1 }], '2026-11-13');
    expect(m.has('X')).toBe(false);
  });
});

describe('dernierDividendeParCode', () => {
  it('écarte les lignes sans exercice ou à montant nul', () => {
    const m = dernierDividendeParCode([
      { code: 'ABJC', montant: 121, exercice: null },
      { code: 'ABJC', montant: 201.52, exercice: 2025 },
      { code: 'BOAN', montant: 0, exercice: 2025 },
      { code: 'BOAN', montant: 209.25, exercice: 2024 },
    ]);
    expect(m.get('ABJC')?.montant).toBe(201.52);
    expect(m.get('BOAN')?.exercice).toBe(2024);
  });
});

describe('rsiParCode', () => {
  it('RSI à 100 sur une hausse continue, absent sous 15 clôtures', () => {
    const hausse = Array.from({ length: 30 }, (_, i) => ({ code: 'A', date_marche: `2026-10-${String(i + 1).padStart(2, '0')}`, cours_jour: 100 + i }));
    const court = Array.from({ length: 10 }, (_, i) => ({ code: 'B', date_marche: `2026-10-${String(i + 1).padStart(2, '0')}`, cours_jour: 100 + i }));
    const m = rsiParCode([...hausse, ...court]);
    expect(m.get('A')).toBe(100);
    expect(m.has('B')).toBe(false);
  });
  it('trie les dates elles-mêmes', () => {
    const lignes = [
      { code: 'A', date_marche: '2026-10-02', cours_jour: 90 },
      ...Array.from({ length: 20 }, (_, i) => ({ code: 'A', date_marche: `2026-09-${String(i + 1).padStart(2, '0')}`, cours_jour: 100 + i })),
    ];
    // La dernière clôture (02/10) est une baisse : le RSI doit descendre sous 100.
    expect(rsiParCode(lignes).get('A')!).toBeLessThan(100);
  });
});

const ligne = (p: Partial<ActionRow>): ActionRow => ({
  code: 'X', cours_jour: 1, variation_pct: 0, rsi: null, volume: 1, score_signal: null, secteur: null, rendement_dividende: null, ...p,
});

describe('applyFilters : une donnée absente ne passe plus un filtre actif', () => {
  const actions = [ligne({ code: 'A', rsi: 25 }), ligne({ code: 'B', rsi: 55 }), ligne({ code: 'C', rsi: null })];
  it('RSI < 30 ne renvoie que la valeur survendue', () => {
    expect(applyFilters(actions, { rsiMax: 30 }).map((a) => a.code)).toEqual(['A']);
  });
  it('compte les valeurs écartées faute de donnée', () => {
    expect(exclusFauteDeDonnee(actions, { rsiMax: 30 })).toBe(1);
    expect(exclusFauteDeDonnee(actions, {})).toBe(0);
  });
  it('sans filtre, tout reste', () => {
    expect(applyFilters(actions, {}).length).toBe(3);
  });
});

describe('ratioVolumeParCode', () => {
  it('rapporte la dernière séance à la moyenne des précédentes', () => {
    const lignes = Array.from({ length: 21 }, (_, i) => ({ code: 'A', date_marche: `2026-10-${String(i + 1).padStart(2, '0')}`, volume: i === 20 ? 300 : 100 }));
    expect(ratioVolumeParCode(lignes).get('A')).toBe(3);
  });
  it('absent avec trop peu d’historique', () => {
    expect(ratioVolumeParCode([{ code: 'A', date_marche: '2026-10-01', volume: 5 }]).has('A')).toBe(false);
  });
});
