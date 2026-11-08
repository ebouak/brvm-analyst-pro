import { describe, it, expect } from 'vitest';
import { regrouperActualites, lienSur } from './overviewActualites';

const pubs = [
  { id: 'p1', libelle: "Rapport d'activités - 1er semestre 2026 - SETAO CI", date_publication: '2026-11-02', type_publication: 'rapport', source_url: 'https://bfin.brvm.org/a.pdf' },
  { id: 'p2', libelle: 'Avis de convocation', date_publication: '2026-04-30', type_publication: 'ag', source_url: null },
];
const news = [
  { id: 'n1', titre: 'BRVM : SETAO réduit fortement ses pertes de 72% en 2025 - Sika Finance', date_publication: '2026-04-20', source_label: 'Google News – SETAO', source: 'brvm', source_url: 'https://news.google.com/x' },
  { id: 'n2', titre: 'BRVM : SETAO réduit fortement ses pertes de 72% en 2025 - sikafinance.com', date_publication: '2026-04-20', source_label: 'Google News – SETAO', source: 'brvm', source_url: 'https://news.google.com/y' },
  { id: 'n3', titre: 'Article futur', date_publication: '2026-12-01', source_label: 'Sika Finance', source: 'autre', source_url: 'https://sikafinance.com/z' },
  { id: 'n4', titre: 'Résultats annuels', date_publication: '2026-11-02', source_label: 'Sika Finance', source: 'autre', source_url: 'javascript:alert(1)' },
];

describe('regrouperActualites', () => {
  const g = regrouperActualites(pubs, news, '2026-11-08');

  it('sépare publications officielles et presse', () => {
    expect(g.officielles.map((x) => x.id)).toEqual(['pub-p1', 'pub-p2']);
    expect(g.presse.map((x) => x.id)).toEqual(['news-n4', 'news-n1']);
  });

  it('retire le suffixe de source des titres Google News et en fait la source', () => {
    const n1 = g.presse.find((x) => x.id === 'news-n1')!;
    expect(n1.titre).toBe('BRVM : SETAO réduit fortement ses pertes de 72% en 2025');
    expect(n1.source).toBe('Sika Finance');
  });

  it('dédoublonne un même titre repris par deux sites et écarte le futur', () => {
    expect(g.presse.some((x) => x.id === 'news-n2')).toBe(false);
    expect(g.presse.some((x) => x.id === 'news-n3')).toBe(false);
  });

  it('trie « Tout » par date décroissante, officiel d’abord à date égale', () => {
    expect(g.tout.map((x) => x.id)).toEqual(['pub-p1', 'news-n4', 'pub-p2', 'news-n1']);
  });

  it('date en toutes lettres, source officielle BRVM, lien seulement http(s)', () => {
    expect(g.officielles[0]).toMatchObject({ date: '2 novembre 2026', source: 'BRVM', href: 'https://bfin.brvm.org/a.pdf', nature: 'officielle' });
    expect(g.officielles[1]!.href).toBeNull();
    expect(g.presse[0]!.href).toBeNull();
  });

  it('vide sans donnée', () => {
    expect(regrouperActualites([], [], '2026-11-08')).toEqual({ tout: [], officielles: [], presse: [] });
  });
});

describe('lienSur', () => {
  it('accepte http et https seulement', () => {
    expect(lienSur('https://a.b/c')).toBe('https://a.b/c');
    expect(lienSur('http://a.b')).toBe('http://a.b');
    expect(lienSur('ftp://a')).toBeNull();
    expect(lienSur(null)).toBeNull();
  });
});
