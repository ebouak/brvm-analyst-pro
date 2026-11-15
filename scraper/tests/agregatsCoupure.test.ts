import { describe, expect, it } from 'vitest';
import { COUPURE_CRON, coupureCron, publicationsDuCron } from '../src/agregats/coupure.js';

describe('coupure du cron des agrégats', () => {
  it('par défaut : la date de fusion de la PR 1 (2026-11-16)', () => {
    expect(COUPURE_CRON).toBe('2026-11-16');
    expect(coupureCron(undefined)).toBe('2026-11-16');
    expect(coupureCron('')).toBe('2026-11-16');
  });
  it('surchargeable par une date explicite, refusée si mal formée', () => {
    expect(coupureCron('2026-12-01')).toBe('2026-12-01');
    expect(() => coupureCron('16/11/2026')).toThrow(/AAAA-MM-JJ/);
  });
  it('le cron ne traite JAMAIS une publication antérieure à la coupure (l’historique attend l’accord sur le rapport à blanc)', () => {
    const pubs = [
      { id: 'a', date_publication: '2026-11-15' },
      { id: 'b', date_publication: '2026-11-16' },
      { id: 'c', date_publication: '2027-03-30' },
      { id: 'd', date_publication: '2003-05-02' },
      { id: 'e', date_publication: null },
    ];
    expect(publicationsDuCron(pubs, '2026-11-16').map((p) => p.id)).toEqual(['b', 'c']);
  });
});
