import { describe, expect, it } from 'vitest';
import { calculerBadge, seanceDue, HEURE_LIMITE_UTC } from './badge';

const ligne = { date_marche: '2026-11-17', valeur: 12.9, regime: 'tendu' as const };
const soir = new Date('2026-11-18T21:00:00Z');
const matin = new Date('2026-11-18T10:00:00Z');

describe('seanceDue', () => {
  it('une séance passée est due, une séance future ne l’est pas', () => {
    expect(seanceDue('2026-11-17', matin)).toBe(true);
    expect(seanceDue('2026-11-19', soir)).toBe(false);
  });
  it('la séance du jour ne devient due qu’à l’heure limite', () => {
    expect(seanceDue('2026-11-18', new Date(`2026-11-18T${String(HEURE_LIMITE_UTC - 1).padStart(2, '0')}:59:00Z`))).toBe(false);
    expect(seanceDue('2026-11-18', new Date(`2026-11-18T${String(HEURE_LIMITE_UTC).padStart(2, '0')}:00:00Z`))).toBe(true);
  });
});

describe('calculerBadge', () => {
  it('à jour quand la date publiée est la dernière séance', () => {
    const b = calculerBadge({ derniere: ligne, seances: ['2026-11-17', '2026-11-17'], maintenant: soir });
    expect(b.etat).toBe('a_jour');
    expect(b.retard).toBe(0);
    expect(b.libelle).toBe('Nervosité · Tendu · 12,9 % · 17/11');
    expect(b.description).toMatch(/À jour/);
  });

  it('pendant la séance, la ligne intraday du jour ne met pas en retard', () => {
    const b = calculerBadge({ derniere: ligne, seances: ['2026-11-17', '2026-11-18'], maintenant: matin });
    expect(b.etat).toBe('a_jour');
  });

  it('en retard d’une séance le soir si la séance du jour n’est pas calculée', () => {
    const b = calculerBadge({ derniere: ligne, seances: ['2026-11-17', '2026-11-18', '2026-11-18'], maintenant: soir });
    expect(b.etat).toBe('en_retard');
    expect(b.retard).toBe(1);
    expect(b.libelle).toBe('Nervosité · Tendu · 12,9 % · 17/11 · en retard');
    expect(b.description).toMatch(/1 séance non encore calculée\./);
  });

  it('compte les séances manquantes, pluriel compris', () => {
    const b = calculerBadge({ derniere: ligne, seances: ['2026-11-18', '2026-11-19', '2026-11-20'], maintenant: new Date('2026-11-21T08:00:00Z') });
    expect(b.etat).toBe('en_retard');
    expect(b.retard).toBe(3);
    expect(b.description).toMatch(/3 séances non encore calculées/);
  });

  it('indisponible sans ligne publiée', () => {
    const b = calculerBadge({ derniere: null, seances: ['2026-11-18'], maintenant: soir });
    expect(b).toMatchObject({ etat: 'indisponible', regime: null, retard: null, libelle: 'Nervosité · indisponible' });
  });

  it('indisponible si le régime est NULL (historique trop court), même avec une valeur', () => {
    const b = calculerBadge({ derniere: { ...ligne, regime: null }, seances: ['2026-11-17'], maintenant: soir });
    expect(b.etat).toBe('indisponible');
    expect(b.regime).toBeNull();
  });

  it('indisponible si la valeur est NULL', () => {
    expect(calculerBadge({ derniere: { ...ligne, valeur: null }, seances: ['2026-11-17'], maintenant: soir }).etat).toBe('indisponible');
  });

  it('jamais « à jour » quand les séances ne peuvent pas être lues', () => {
    expect(calculerBadge({ derniere: ligne, seances: null, maintenant: soir }).etat).toBe('indisponible');
    expect(calculerBadge({ derniere: ligne, seances: [], maintenant: soir }).etat).toBe('indisponible');
  });

  it('aucun mot de verdict dans les textes', () => {
    const textes = [
      calculerBadge({ derniere: ligne, seances: ['2026-11-17'], maintenant: soir }),
      calculerBadge({ derniere: ligne, seances: ['2026-11-18'], maintenant: soir }),
    ].flatMap((b) => [b.libelle, b.description]).join(' ');
    expect(textes).not.toMatch(/achat|achet|vend|vente|signal/i);
  });
});

describe('BadgeNervosite (rendu)', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: BadgeNervosite } = await import('@/components/nervosite/BadgeNervosite');
  const rendu = (b: ReturnType<typeof calculerBadge>, compacte = false) => renderToStaticMarkup(h(BadgeNervosite, { badge: b, compacte }));

  it('lien vers /nervosite, texte complet et aria-label explicite', () => {
    const html = rendu(calculerBadge({ derniere: ligne, seances: ['2026-11-17'], maintenant: soir }));
    expect(html).toContain('href="/nervosite"');
    expect(html).toContain('data-etat="a_jour"');
    expect(html).toMatch(/aria-label="Indice de nervosité WESTBOURSE : régime tendu, 12,9\s%/);
    expect(html.replace(/<[^>]+>/g, '')).toMatch(/Nervosité · Tendu · 12,9\s% · 17\/11/);
    expect(html).not.toContain('en retard');
  });

  it('le retard est écrit, en version complète comme compacte', () => {
    const b = calculerBadge({ derniere: ligne, seances: ['2026-11-18'], maintenant: soir });
    expect(rendu(b)).toContain('en retard');
    expect(rendu(b, true).replace(/<[^>]+>/g, '')).toContain('retard');
    expect(rendu(b, true)).toContain('aria-label="Indice de nervosité WESTBOURSE');
  });

  it('indisponible : aucun chiffre affiché', () => {
    const html = rendu(calculerBadge({ derniere: null, seances: null, maintenant: soir }));
    expect(html.replace(/<[^>]+>/g, '')).toBe('Nervosité · indisponible');
  });
});
