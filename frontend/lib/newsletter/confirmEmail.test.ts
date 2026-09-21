import { describe, it, expect } from 'vitest';
import { buildConfirmEmailHtml, CONFIRM_SUBJECT } from './confirmEmail';

const P = {
  confirmUrl: 'https://www.westbourse.com/api/newsletter/confirm?token=abc-123',
  unsubscribeUrl: 'https://www.westbourse.com/api/newsletter/unsubscribe?token=abc-123',
};

describe('buildConfirmEmailHtml', () => {
  it('porte le lien de confirmation — c’est lui qui manquait depuis 0037', () => {
    const html = buildConfirmEmailHtml(P);
    expect(html).toContain(`href="${P.confirmUrl}"`);
    expect(html).toContain('Confirmer mon inscription');
  });
  it('porte le lien de désabonnement dès le premier email', () => {
    expect(buildConfirmEmailHtml(P)).toContain(`href="${P.unsubscribeUrl}"`);
  });
  it('ne prétend pas que l’inscription est acquise', () => {
    expect(buildConfirmEmailHtml(P)).not.toMatch(/bien inscrit/i);
    expect(CONFIRM_SUBJECT).toMatch(/Confirmez/);
  });
  it('échappe les guillemets d’une URL hostile', () => {
    const html = buildConfirmEmailHtml({ ...P, confirmUrl: 'https://x/?a="b' });
    expect(html).toContain('href="https://x/?a=&quot;b"');
  });
});
