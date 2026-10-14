import { describe, it, expect } from 'vitest';
import { preparerPublications, libelleType, type PublicationSource } from './publications';

const p = (o: Partial<PublicationSource> & { code: string; date_publication: string }): PublicationSource => ({
  libelle: `Document ${o.code}`, type_publication: 'autre', source_url: `https://www.brvm.org/doc/${o.code}.pdf`, ...o,
});

describe('libelleType', () => {
  it('types connus et repli', () => {
    expect(libelleType('etats_financiers')).toBe('États financiers');
    expect(libelleType('bilan')).toBe('États financiers');
    expect(libelleType('ag')).toBe('Assemblée générale');
    expect(libelleType('notation')).toBe('Notation');
    expect(libelleType('rapport')).toBe('Rapport');
    expect(libelleType('autre')).toBe('Communiqué');
    expect(libelleType(null)).toBe('Communiqué');
    expect(libelleType('inconnu')).toBe('Communiqué');
  });
});

describe('preparerPublications', () => {
  const rows = [
    p({ code: 'SNTS', date_publication: '2026-10-13' }),
    p({ code: 'prsc', date_publication: '2026-10-12', type_publication: 'ag' }),
    p({ code: 'ORGT', date_publication: '2026-10-12', type_publication: 'rapport' }),
  ];

  it('mes valeurs d abord, puis la plus récente', () => {
    const r = preparerPublications(rows, new Set(['PRSC']));
    expect(r.map((x) => x.code)).toEqual(['PRSC', 'SNTS', 'ORGT']);
    expect(r[0]!.mienne).toBe(true);
    expect(r[0]!.typeLibelle).toBe('Assemblée générale');
  });

  it('lien seulement en http(s)', () => {
    const r = preparerPublications([
      p({ code: 'A', date_publication: '2026-10-13', source_url: 'javascript:alert(1)' }),
      p({ code: 'B', date_publication: '2026-10-13', source_url: null }),
      p({ code: 'C', date_publication: '2026-10-13', source_url: 'http://x.org/a.pdf' }),
    ], new Set());
    expect(r.find((x) => x.code === 'A')!.url).toBeNull();
    expect(r.find((x) => x.code === 'B')!.url).toBeNull();
    expect(r.find((x) => x.code === 'C')!.url).toBe('http://x.org/a.pdf');
  });

  it('date invalide ou libellé vide : écarté ; doublon d URL : une fois ; limite', () => {
    const r = preparerPublications([
      p({ code: 'A', date_publication: '13/10/2026' }),
      p({ code: 'B', date_publication: '2026-10-13', libelle: '  ' }),
      p({ code: 'C', date_publication: '2026-10-13', source_url: 'https://x.org/c.pdf' }),
      p({ code: 'C', date_publication: '2026-10-13', source_url: 'https://x.org/c.pdf' }),
    ], new Set());
    expect(r.map((x) => x.code)).toEqual(['C']);
    expect(preparerPublications(Array.from({ length: 12 }, (_, k) => p({ code: `X${k}`, date_publication: '2026-10-13' })), new Set(), 8)).toHaveLength(8);
  });
});

describe('doublon d URL', () => {
  it('garde la ligne la plus récente même listée en second', () => {
    const url = 'https://www.brvm.org/doc/X.pdf';
    const r = preparerPublications([
      p({ code: 'SNTS', date_publication: '2026-09-01', source_url: url }),
      p({ code: 'SNTS', date_publication: '2026-10-01', source_url: url }),
    ], new Set());
    expect(r).toHaveLength(1);
    expect(r[0].date).toBe('2026-10-01');
  });
});
