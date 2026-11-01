import { describe, it, expect } from 'vitest';
import { construireEmailRelance, type OptionsEmail } from './emailRelance';

const base: OptionsEmail = {
  corps: 'Bonjour Awa,\n\nVoici <notre> offre & plus.',
  lienOpposition: 'https://www.westbourse.com/crm/opposition?t=abc',
  lienOffre: 'https://www.westbourse.com/offre/dossier?t=def',
  whatsappNumero: '+33 7 43 65 72 71',
  chaineWhatsappUrl: 'https://whatsapp.com/channel/XYZ',
};

describe('construireEmailRelance', () => {
  it('affiche le logo en PNG absolu', () => {
    const { html } = construireEmailRelance(base);
    expect(html).toContain('src="https://www.westbourse.com/icon-192.png"');
    expect(html).not.toMatch(/\.svg/);
  });
  it('échappe le corps saisi', () => {
    const { html } = construireEmailRelance(base);
    expect(html).toContain('&lt;notre&gt; offre &amp; plus.');
    expect(html).not.toContain('<notre>');
  });
  it("met le lien d'opposition en dernier, HTML et texte", () => {
    const { html, texte } = construireEmailRelance(base);
    expect(html.lastIndexOf('crm/opposition?t=abc')).toBeGreaterThan(html.lastIndexOf('offre/dossier'));
    expect(texte.trimEnd().endsWith('https://www.westbourse.com/crm/opposition?t=abc')).toBe(true);
    const apres = html.slice(html.lastIndexOf('crm/opposition?t=abc'));
    expect(apres).not.toContain('<a ');
  });
  it("refuse une chaîne WhatsApp qui n'est pas en https", () => {
    const { html } = construireEmailRelance({ ...base, chaineWhatsappUrl: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('Chaîne WhatsApp');
  });
  it("n'affiche pas d'offre si le lien n'est pas en https", () => {
    const { html, texte } = construireEmailRelance({ ...base, lienOffre: 'http://x' });
    expect(html).not.toContain('Choisir mon dossier');
    expect(texte).not.toContain('OFFERT');
  });
  it("refuse d'envoyer sans lien d'opposition valide", () => {
    expect(() => construireEmailRelance({ ...base, lienOpposition: 'javascript:x' })).toThrow();
  });
  it("inclut l'offre et le bouton WhatsApp quand ils sont fournis", () => {
    const { html, texte } = construireEmailRelance(base);
    expect(html).toContain('href="https://www.westbourse.com/offre/dossier?t=def"');
    expect(html).toContain('https://wa.me/33743657271?text=');
    expect(texte).toContain('https://www.westbourse.com/offre/dossier?t=def');
    expect(texte).toContain('https://wa.me/33743657271');
  });
  it("n'invente ni offre ni WhatsApp quand ils sont absents", () => {
    const { html, texte } = construireEmailRelance({ ...base, lienOffre: null, whatsappNumero: null, chaineWhatsappUrl: null });
    expect(html).not.toContain('offre/dossier');
    expect(html).not.toContain('wa.me');
    expect(html).not.toContain('whatsapp.com/channel');
    expect(texte).not.toContain('wa.me');
  });
  it('porte la mention de non-conseil', () => {
    expect(construireEmailRelance(base).html).toContain('pas un conseil en investissement');
  });
});
