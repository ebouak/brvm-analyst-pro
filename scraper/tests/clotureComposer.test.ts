import { describe, it, expect } from 'vitest';
import { composerCloture, plusValueTotale, type ContexteCloture } from '../src/cloture/composer.js';

/**
 * Ces règles ne font JAMAIS échouer un envoi : un bloc vide affiché, une
 * mention premium montrée à un abonné, un total partiel présenté comme complet
 * partent en production et s'affichent chez l'utilisateur. Seul un test les
 * attrape.
 */

const MARCHE = {
  dateFr: '8 septembre 2026',
  compositeVariationPct: 0.45,
  compositeValeur: 537.67,
  hausses: 17,
  baisses: 21,
  stables: 9,
  capitauxFcfa: 3_010_000_000,
  capitauxEstimes: false,
};

const VIDE: ContexteCloture = {
  marche: MARCHE,
  premium: true,
  alertes: [],
  portefeuille: [],
  watchlist: [],
  brief: null,
  briefUrl: 'westbourse.com/brief',
};

describe('composerCloture — le marché, toujours', () => {
  it('donne le marché même sans rien de personnel', () => {
    const t = composerCloture(VIDE);
    expect(t).toContain('Clôture du 8 septembre 2026');
    expect(t).toContain('+0,45 %');
    expect(t).toContain('17 hausses · 21 baisses · 9 stables');
    expect(t).toContain('Md FCFA échangés');
  });

  it('annonce une estimation quand les capitaux le sont', () => {
    const t = composerCloture({ ...VIDE, marche: { ...MARCHE, capitauxEstimes: true } });
    expect(t).toContain('Environ');
  });

  it('omet le composite plutôt que d’afficher un trou', () => {
    const t = composerCloture({
      ...VIDE,
      marche: { ...MARCHE, compositeVariationPct: null, compositeValeur: null },
    });
    expect(t).not.toContain('BRVM Composite');
    expect(t).toContain('17 hausses');
  });

  it('porte toujours l’avertissement', () => {
    expect(composerCloture(VIDE)).toContain('pas un conseil en investissement');
  });
});

describe('composerCloture — un bloc vide n’apparaît pas', () => {
  it('n’écrit jamais « néant »', () => {
    const t = composerCloture(VIDE);
    expect(t).not.toContain('VOS ALERTES');
    expect(t).not.toContain('VOTRE PORTEFEUILLE');
    expect(t).not.toContain('VOTRE WATCHLIST');
    expect(t).not.toContain('LE BRIEF');
  });

  it('ignore une watchlist dont aucune valeur n’a coté', () => {
    const t = composerCloture({
      ...VIDE,
      watchlist: [{ code: 'SNTS', variationPct: null }],
    });
    expect(t).not.toContain('VOTRE WATCHLIST');
  });
});

describe('composerCloture — le premium', () => {
  const AVEC: ContexteCloture = {
    ...VIDE,
    alertes: [
      { code: 'SNTS', texte: 'SNTS a franchi 15 000 FCFA' },
      { code: 'BOAC', texte: 'BOAC : RSI en surachat (72)' },
    ],
    portefeuille: [{ code: 'SNTS', quantite: 100, prixRevient: 14000, coursActuel: 15274 }],
    watchlist: [
      { code: 'SGBC', variationPct: 2.1 },
      { code: 'NTLC', variationPct: 0 },
    ],
  };

  it('compose les blocs personnels pour un abonné', () => {
    const t = composerCloture(AVEC);
    expect(t).toContain('▸ VOS ALERTES (2)');
    expect(t).toContain('SNTS a franchi 15 000 FCFA');
    expect(t).toContain('▸ VOTRE PORTEFEUILLE');
    expect(t).toContain('▸ VOTRE WATCHLIST');
    expect(t).toContain('NTLC ='); // variation nulle : signe « = », pas « +0,0 % »
  });

  it('ne montre JAMAIS la mention premium à un abonné', () => {
    // Le défaut serait invisible en production : le message part, il est
    // seulement absurde pour celui qui paie déjà.
    expect(composerCloture(AVEC)).not.toContain('Réservé aux abonnés');
  });

  it('masque les blocs et invite UNE fois pour un gratuit', () => {
    const t = composerCloture({ ...AVEC, premium: false });
    expect(t).not.toContain('▸ VOS ALERTES');
    expect(t).not.toContain('▸ VOTRE PORTEFEUILLE');
    expect(t).not.toContain('SNTS a franchi'); // aucune fuite du contenu
    // Une seule invitation, pas une par bloc.
    expect(t.match(/Réservé aux abonnés/g)).toHaveLength(1);
    expect(t).toContain('2 alertes');
  });

  it('n’invite pas un gratuit qui n’a rien à manquer', () => {
    const t = composerCloture({ ...VIDE, premium: false });
    expect(t).not.toContain('Réservé aux abonnés');
  });
});

describe('plusValueTotale — jamais de total partiel', () => {
  it('calcule quand toutes les lignes ont un cours', () => {
    const pv = plusValueTotale([
      { code: 'A', quantite: 10, prixRevient: 100, coursActuel: 120 },
      { code: 'B', quantite: 5, prixRevient: 200, coursActuel: 190 },
    ]);
    expect(pv?.gain).toBe(150); // +200 puis -50
    expect(pv?.gainPct).toBeCloseTo(7.5, 2);
  });

  it('REFUSE de totaliser si un cours manque', () => {
    // Un total partiel présenté comme complet serait un chiffre faux.
    expect(
      plusValueTotale([
        { code: 'A', quantite: 10, prixRevient: 100, coursActuel: 120 },
        { code: 'B', quantite: 5, prixRevient: 200, coursActuel: null },
      ]),
    ).toBeNull();
  });

  it('le dit dans le message au lieu de taire le portefeuille', () => {
    const t = composerCloture({
      ...VIDE,
      portefeuille: [{ code: 'B', quantite: 5, prixRevient: 200, coursActuel: null }],
    });
    expect(t).toContain('▸ VOTRE PORTEFEUILLE');
    expect(t).toContain('Total non calculable');
  });

  it('renvoie null sur un portefeuille vide', () => {
    expect(plusValueTotale([])).toBeNull();
  });
});

describe('composerCloture — mise en forme', () => {
  it('n’utilise AUCUN symbole Markdown', () => {
    // Telegram est appelé sans parse_mode : *, _ et # s'afficheraient tels quels.
    const t = composerCloture({
      ...VIDE,
      premium: true,
      alertes: [{ code: 'X', texte: 'seuil franchi' }],
      brief: 'Séance portée par les banques',
    });
    expect(t).not.toMatch(/\*|_|^#/m);
  });
});
