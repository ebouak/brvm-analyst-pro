import { describe, expect, it } from 'vitest';
import { CORIS_ARTICLE } from './articles';
import { buildRssXml } from './rss';

describe('buildRssXml', () => {
  it('rend un flux RSS 2.0 avec liens permanents et image', () => {
    const xml = buildRssXml([CORIS_ARTICLE]);

    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<guid isPermaLink="true">https://www.westbourse.com/analyses/coris-bank-ipo-2027</guid>');
    expect(xml).toContain('<media:thumbnail url="https://www.westbourse.com/analyses/coris-bank-ipo-2027/opengraph-image" type="image/png" />');
    expect(xml).toContain('<enclosure url="https://www.westbourse.com/analyses/coris-bank-ipo-2027/opengraph-image" type="image/png" length="0" />');
  });

  it('échappe le contenu éditorial et reste valide sans article', () => {
    const xml = buildRssXml([{ ...CORIS_ARTICLE, title: 'A & B < C', description: '"D" & E' }]);

    expect(xml).toContain('<title>A &amp; B &lt; C</title>');
    expect(xml).toContain('&quot;D&quot; &amp; E');
    expect(buildRssXml([])).toContain('<channel>');
  });
});
