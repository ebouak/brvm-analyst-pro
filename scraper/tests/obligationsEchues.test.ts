import { describe, it, expect } from 'vitest';
import { exclureEchues } from '../src/scrapers/brvmObligations.js';

describe('exclureEchues', () => {
  const rows = [
    { code: 'TPBF.O2', maturite: '2016-12-31' },
    { code: 'EOA.2025', maturite: '2025-12-31' },
    { code: 'TPCI.2030', maturite: '2030-12-31' },
    { code: 'INCONNUE', maturite: null },
    { code: 'JOUR_MEME', maturite: '2026-11-14' },
  ];
  it('écarte les maturités passées, garde le futur, le jour même et l’inconnu', () => {
    const { gardees, echues } = exclureEchues(rows, '2026-11-14');
    expect(echues.map((r) => r.code)).toEqual(['TPBF.O2', 'EOA.2025']);
    expect(gardees.map((r) => r.code)).toEqual(['TPCI.2030', 'INCONNUE', 'JOUR_MEME']);
  });
});
