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

  it('garde la structure du gabarit « feuille » de l’hebdo (classes, mesures, graphique accessible)', () => {
    const html =
      '<dl class="wk-grille"><div class="wk-mesure"><dt>Brent</dt><dd class="wk-baisse">−2,52 %</dd></div></dl>' +
      '<svg viewBox="0 0 10 10" role="img" aria-label="Variations"><rect class="wk-g-baisse" x="1" y="1" width="4" height="4" rx="2"></rect></svg>';
    const out = sanitizeReportHtml(html);
    expect(out).toContain('<dl class="wk-grille">');
    expect(out).toContain('<dd class="wk-baisse">');
    expect(out).toContain('aria-label="Variations"');
    expect(out).toContain('rx="2"');
  });
});
