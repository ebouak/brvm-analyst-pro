import { describe, it, expect } from 'vitest';
import { isPublicPath } from './cheminsPublics';

describe('isPublicPath', () => {
  it.each(['/', '/pricing', '/societes/SNTS', '/formations/academy', '/api/rss', '/rss.xml', '/news-sitemap.xml', '/chaine', '/telegram'])('%s est publique', (p) => {
    expect(isPublicPath(p)).toBe(true);
  });
  it.each(['/screener', '/signaux', '/obligations', '/premium/paper-trading', '/liquidite', '/parametres/alertes', '/rss.xml/private', '/news-sitemap.xml/private', '/chaine/x', '/telegram/x'])(
    '%s exige un compte',
    (p) => {
      expect(isPublicPath(p)).toBe(false);
    },
  );
});
