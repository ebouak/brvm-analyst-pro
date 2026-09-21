import { describe, it, expect } from 'vitest';
import { memeSeanceQuePrecedente, type LigneComparable } from '../src/scrapers/preuveDeSeance.js';

const seance = (n: number, f: (i: number) => Partial<LigneComparable> = () => ({})): LigneComparable[] =>
  Array.from({ length: n }, (_, i) => ({ code: `C${i}`, cours_jour: 1000 + i, variation_pct: (i % 5) - 2, volume: 100 + i, ...f(i) }));

describe('memeSeanceQuePrecedente — la preuve vient de la donnée, pas de l’horloge', () => {
  it('47/47 identiques (le lundi 21/09 à 09:01) : même séance, ne rien écrire', () => {
    const v = memeSeanceQuePrecedente(seance(47), seance(47));
    expect(v.memeSeance).toBe(true);
    expect(v.identiques).toBe(47);
  });
  it('une seule ligne a bougé : séance nouvelle', () => {
    const v = memeSeanceQuePrecedente(seance(47, (i) => (i === 3 ? { volume: 999 } : {})), seance(47));
    expect(v.memeSeance).toBe(false);
    expect(v.identiques).toBe(46);
  });
  it('séance sans échanges : volumes nuls ≠ volumes de la veille → nouvelle', () => {
    const v = memeSeanceQuePrecedente(seance(47, () => ({ volume: 0, variation_pct: 0 })), seance(47));
    expect(v.memeSeance).toBe(false);
  });
  it('trop peu de lignes comparables : on ne conclut pas', () => {
    expect(memeSeanceQuePrecedente(seance(5), seance(5)).memeSeance).toBe(false);
    expect(memeSeanceQuePrecedente(seance(47), []).memeSeance).toBe(false);
    expect(memeSeanceQuePrecedente([], seance(47)).memeSeance).toBe(false);
  });
  it('codes absents de la veille ignorés, le reste comparé', () => {
    const snap = [...seance(20), { code: 'NOUVEAU', cours_jour: 5, variation_pct: 0, volume: 1 }];
    const v = memeSeanceQuePrecedente(snap, seance(20));
    expect(v.comparees).toBe(20);
    expect(v.memeSeance).toBe(true);
  });
});
