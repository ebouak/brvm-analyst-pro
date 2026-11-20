import { describe, expect, it } from 'vitest';
import { CORIS_ARTICLE } from './articles';
import { buildNewsSitemapXml } from './newsSitemap';

describe('buildNewsSitemapXml', () => {
  it('rend le format Google News en français', () => {
    const xml = buildNewsSitemapXml([CORIS_ARTICLE], new Date('2026-11-20T13:00:00Z'));

    expect(xml).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
    expect(xml).toContain('<news:name>WESTBOURSE</news:name>');
    expect(xml).toContain('<news:language>fr</news:language>');
    expect(xml).toContain('<loc>https://www.westbourse.com/analyses/coris-bank-ipo-2027</loc>');
    expect(xml).toContain('<news:publication_date>2026-11-19T13:00:00.000Z</news:publication_date>');
  });

  it('exclut les publications de plus de 48 heures et échappe les titres', () => {
    const xml = buildNewsSitemapXml([
      { ...CORIS_ARTICLE, slug: 'old', publishedAt: '2026-11-18T12:59:59Z' },
      { ...CORIS_ARTICLE, slug: 'recent', title: 'Coris & BRVM < demain', publishedAt: '2026-11-19T13:00:00Z' },
    ], new Date('2026-11-20T13:00:00Z'));

    expect(xml).not.toContain('/old</loc>');
    expect(xml).toContain('Coris &amp; BRVM &lt; demain');
  });
});
