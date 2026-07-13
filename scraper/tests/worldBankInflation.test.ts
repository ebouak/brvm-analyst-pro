import { describe, it, expect } from 'vitest';
import { parseWorldBankInflation, UEMOA } from '../src/parsers/worldBankInflation.js';

describe('parseWorldBankInflation', () => {
  it('extrait les observations valides', () => {
    const payload = [
      { page: 1, pages: 1, total: 2 },
      [
        { countryiso3code: 'CIV', date: '2024', value: 3.45053028131019 },
        { countryiso3code: 'CIV', date: '2023', value: 4.4 },
      ],
    ];
    expect(parseWorldBankInflation(payload)).toEqual([
      { paysCode: 'CIV', annee: 2024, tauxPct: 3.45 },
      { paysCode: 'CIV', annee: 2023, tauxPct: 4.4 },
    ]);
  });

  it('IGNORE value:null au lieu de le convertir en 0', () => {
    // Une année non encore publiée. Un 0 fabriqué afficherait « inflation nulle »
    // et ferait passer un rendement médiocre pour un bon rendement réel.
    const payload = [
      { page: 1 },
      [
        { countryiso3code: 'SEN', date: '2026', value: null },
        { countryiso3code: 'SEN', date: '2024', value: 0.804503298792438 },
      ],
    ];
    expect(parseWorldBankInflation(payload)).toEqual([
      { paysCode: 'SEN', annee: 2024, tauxPct: 0.8 },
    ]);
  });

  it('résiste à une réponse malformée sans lever', () => {
    expect(parseWorldBankInflation(null)).toEqual([]);
    expect(parseWorldBankInflation([])).toEqual([]);
    expect(parseWorldBankInflation([{ message: 'erreur' }])).toEqual([]);
    expect(parseWorldBankInflation([{}, 'pas un tableau'])).toEqual([]);
    expect(parseWorldBankInflation([{}, [null, 42, { date: 'x' }]])).toEqual([]);
  });

  it('couvre les 8 États membres de l’UEMOA', () => {
    expect(UEMOA).toHaveLength(8);
    expect(UEMOA.map((p) => p.code).sort()).toEqual(
      ['BEN', 'BFA', 'CIV', 'GNB', 'MLI', 'NER', 'SEN', 'TGO'],
    );
  });
});
