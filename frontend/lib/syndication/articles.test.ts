import { describe, expect, it } from 'vitest';
import { CORIS_ARTICLE, newsArticlesSince, sortByPublishedAt } from './articles';
import { escapeXml, toRfc822 } from './xml';

describe('syndication articles', () => {
  it('échappe les caractères XML sans doubler les accents', () => {
    expect(escapeXml(`A & B < C "cote" 'été'`))
      .toBe('A &amp; B &lt; C &quot;cote&quot; &apos;été&apos;');
  });

  it('produit une date RFC 822 UTC', () => {
    expect(toRfc822('2026-11-19T13:00:00Z')).toBe('Thu, 19 Nov 2026 13:00:00 GMT');
  });

  it('ne garde que les articles publiés dans les 48 heures', () => {
    const now = new Date('2026-11-20T13:00:00Z');
    const articles = [
      { ...CORIS_ARTICLE, slug: 'limit', publishedAt: '2026-11-18T13:00:00Z' },
      { ...CORIS_ARTICLE, slug: 'recent', publishedAt: '2026-11-19T13:00:00Z' },
      { ...CORIS_ARTICLE, slug: 'old', publishedAt: '2026-11-18T12:59:59Z' },
    ];

    expect(newsArticlesSince(articles, now).map((a) => a.slug)).toEqual(['recent', 'limit']);
  });

  it('trie par date de publication décroissante', () => {
    expect(sortByPublishedAt([
      { ...CORIS_ARTICLE, slug: 'old', publishedAt: '2026-11-18T13:00:00Z' },
      { ...CORIS_ARTICLE, slug: 'new', publishedAt: '2026-11-19T13:00:00Z' },
    ]).map((a) => a.slug)).toEqual(['new', 'old']);
  });
});
