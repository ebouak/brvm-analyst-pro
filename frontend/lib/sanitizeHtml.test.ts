import { describe, it, expect } from 'vitest';
import { sanitizeReportHtml } from './sanitizeHtml';

describe('sanitizeReportHtml', () => {
  it('retire les balises <script>', () => {
    const out = sanitizeReportHtml('<p>Bonjour</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('Bonjour');
  });

  it('retire les gestionnaires d\'événements inline (onerror, onclick)', () => {
    const out = sanitizeReportHtml('<img src="x.png" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
  });

  it('retire les URLs javascript:', () => {
    const out = sanitizeReportHtml('<a href="javascript:alert(1)">clic</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('conserve le contenu légitime (paragraphes, listes, liens http)', () => {
    const out = sanitizeReportHtml('<p>Texte</p><ul><li>Point</li></ul><a href="https://example.com">lien</a>');
    expect(out).toContain('<p>Texte</p>');
    expect(out).toContain('<li>Point</li>');
    expect(out).toContain('href="https://example.com"');
  });

  it('conserve les graphiques SVG intégrés', () => {
    const svg = '<svg viewBox="0 0 100 100"><path d="M0 0 L10 10" stroke="#56d7fd" /></svg>';
    const out = sanitizeReportHtml(svg);
    expect(out).toContain('<svg');
    expect(out).toContain('<path');
  });
});
