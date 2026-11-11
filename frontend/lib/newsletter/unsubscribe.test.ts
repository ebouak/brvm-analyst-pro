import { describe, expect, it } from 'vitest';
import { entetesDesabonnement, lienDesabonnement, lienPourDestinataire, UNSUB_PLACEHOLDER } from './unsubscribe';

describe('lien de désabonnement', () => {
  it('pointe vers la route existante avec le jeton encodé', () => {
    expect(lienDesabonnement('https://www.westbourse.com/', 'a b&c')).toBe(
      'https://www.westbourse.com/api/newsletter/unsubscribe?token=a%20b%26c',
    );
  });
  it('un destinataire à jeton a un lien en un clic', () => {
    const l = lienPourDestinataire('https://x.test', 'abc-123');
    expect(l).toEqual({ url: 'https://x.test/api/newsletter/unsubscribe?token=abc-123', unClic: true });
  });
  it('sans jeton, repli sur la page des préférences existante', () => {
    expect(lienPourDestinataire('https://x.test', null)).toEqual({ url: 'https://x.test/account/newsletters', unClic: false });
  });
  it('en-têtes RFC 8058 seulement quand le POST est possible', () => {
    expect(entetesDesabonnement('https://x.test/u?token=1', true)).toEqual({
      'List-Unsubscribe': '<https://x.test/u?token=1>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    expect(entetesDesabonnement('https://x.test/account/newsletters', false)).toEqual({
      'List-Unsubscribe': '<https://x.test/account/newsletters>',
    });
  });
  it('le gabarit est remplaçable par destinataire', () => {
    const html = `<a href="${UNSUB_PLACEHOLDER}">x</a>`;
    expect(html.split(UNSUB_PLACEHOLDER).join('https://x.test/u')).toBe('<a href="https://x.test/u">x</a>');
  });
});
