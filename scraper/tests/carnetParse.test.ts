import { describe, expect, it } from 'vitest';
import { nombreBulletin, parseCarnet, spreadPct, type FragmentPdf } from '../src/carnet/parse.js';

/** Fragments repris du bulletin réel du 22/09/2026, page 11, abscisses exactes. */
const F = (y: number, paires: [number, string][]): FragmentPdf[] =>
  paires.map(([x, texte]) => ({ x, y, texte }));

describe('nombreBulletin', () => {
  it('lit une quantité séparée par des espaces', () => {
    expect(nombreBulletin('12 790')).toBe(12790);
  });
  it('lit un cours dont la virgule sépare les MILLIERS, pas les décimales', () => {
    // « 3,955 » vaut 3 955 FCFA. Le lire 3,955 diviserait le cours par mille.
    expect(nombreBulletin('3,955')).toBe(3955);
    expect(nombreBulletin('31,250')).toBe(31250);
  });
  it('garde le point décimal des cours obligataires', () => {
    expect(nombreBulletin('9,007.42')).toBeCloseTo(9007.42, 2);
  });
  it('rend null sur « Marché », le vide et l’espace insécable seul', () => {
    expect(nombreBulletin('Marché')).toBeNull();
    expect(nombreBulletin('')).toBeNull();
    expect(nombreBulletin(' ')).toBeNull();
    expect(nombreBulletin(null)).toBeNull();
  });
});

describe('parseCarnet', () => {
  it('lit une ligne complète des deux côtés', () => {
    const [l] = parseCarnet(F(711, [
      [16, 'ABJC'], [81, 'SERVAIR ABIDJAN CI'], [291, '1 430'], [322, '3,955'], [378, '3,990'], [476, '9'], [562, '3 955'],
    ]));
    expect(l).toEqual({
      code: 'ABJC', designation: 'SERVAIR ABIDJAN CI',
      qteAchat: 1430, coursAchat: 3955, qteVente: 9, coursVente: 3990,
      achatAuMarche: false, venteAuMarche: false, coursReference: 3955,
    });
  });

  it('lit une ligne SANS acheteur, avec une vente « au marché » — sans décaler les colonnes', () => {
    // Le piège : le « / » est inline et les champs achat sont absents. Une
    // lecture par index attribuerait « Marché » à la quantité d'achat.
    const [l] = parseCarnet(F(697, [
      [16, 'BICB'], [81, 'BIIC BN'], [355, '/'], [376, 'Marché'], [461, '12 790'], [562, '9 250'],
    ]));
    expect(l.qteAchat).toBeNull();
    expect(l.coursAchat).toBeNull();
    expect(l.coursVente).toBeNull();
    expect(l.venteAuMarche).toBe(true);
    expect(l.qteVente).toBe(12790);
    expect(l.coursReference).toBe(9250);
  });

  it('ignore le « / » posé sur une ligne à lui seul', () => {
    expect(parseCarnet(F(710, [[355, '/']]))).toHaveLength(0);
  });

  it('écarte en-têtes, titres de section et pieds de page sans liste à maintenir', () => {
    const parasites = [
      ...F(802, [[457, 'mardi 22 septembre 2026']]),
      ...F(753, [[16, 'MARCHE DES ACTIONS']]),
      ...F(730, [[33, 'Symbole'], [150, 'Titre'], [253, 'résiduelle à'], [337, 'Achat / Vente']]),
      ...F(722, [[261, "l'achat"], [437, 'vente']]),
    ];
    expect(parseCarnet(parasites)).toHaveLength(0);
  });

  it('accepte un code d’obligation suffixé', () => {
    const [l] = parseCarnet(F(600, [[16, 'EOS.O34'], [81, 'ETAT DU SENEGAL'], [299, '1'], [321, '10,000'], [562, '10 000']]));
    expect(l.code).toBe('EOS.O34');
    expect(l.coursAchat).toBe(10000);
  });

  it('rend les lignes du haut de page vers le bas', () => {
    const l = parseCarnet([
      ...F(684, [[16, 'BICC'], [81, 'BICI CI'], [299, '20'], [321, '31,000'], [377, '31,250'], [473, '16'], [559, '31 250']]),
      ...F(711, [[16, 'ABJC'], [81, 'SERVAIR ABIDJAN CI'], [291, '1 430'], [322, '3,955'], [378, '3,990'], [476, '9'], [562, '3 955']]),
    ]);
    expect(l.map((x) => x.code)).toEqual(['ABJC', 'BICC']);
  });
});

describe('spreadPct', () => {
  it('calcule la fourchette en pourcentage du milieu', () => {
    // 11 300 / 11 400 → 100 d'écart sur un milieu de 11 350.
    expect(spreadPct({ coursAchat: 11300, coursVente: 11400, achatAuMarche: false, venteAuMarche: false }))
      .toBeCloseTo(0.881, 3);
  });
  it('rend null quand un côté manque : un carnet borgne n’a pas de fourchette', () => {
    expect(spreadPct({ coursAchat: null, coursVente: 9250, achatAuMarche: false, venteAuMarche: false })).toBeNull();
    expect(spreadPct({ coursAchat: 3955, coursVente: null, achatAuMarche: false, venteAuMarche: false })).toBeNull();
  });
  it('rend null sur un ordre « au marché », qui n’a pas de limite de cours', () => {
    expect(spreadPct({ coursAchat: 3955, coursVente: 3990, achatAuMarche: false, venteAuMarche: true })).toBeNull();
  });
  it('rend null sur une fourchette croisée, qui trahit une lecture fautive', () => {
    expect(spreadPct({ coursAchat: 4000, coursVente: 3900, achatAuMarche: false, venteAuMarche: false })).toBeNull();
  });
});
