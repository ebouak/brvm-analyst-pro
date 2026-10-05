import { describe, it, expect } from 'vitest';
import { chiffresAutorises, matiere, syntheseAcceptable } from './syntheseRedigee';
import type { Commentaire } from './commentaire';

const c: Commentaire = {
  constats: [
    { origine: 'bruit', fait: 'Le titre a gagné 2,35 % sur la séance.', portee: "Soit 1,4 fois l'écart-type habituel." },
    { origine: 'carnet', fait: 'Il reste 12 500 titres à l’achat contre 3 200 à la vente.' },
  ],
  synthese: 'La séance sort de l’ordinaire par son ampleur.',
  limites: ['Ce n’est pas un conseil.'],
};

describe('matiere / chiffresAutorises', () => {
  it('reprend constats et synthèse de référence', () => {
    const m = matiere(c);
    expect(m).toContain('- Le titre a gagné 2,35 %');
    expect(m).toContain("(Soit 1,4 fois l'écart-type habituel.)");
    expect(m).toContain('SYNTHÈSE DE RÉFÉRENCE : La séance sort');
  });

  it('recolle les milliers à la française', () => {
    expect(chiffresAutorises(c)).toEqual(expect.arrayContaining([2.35, 1.4, 12500, 3200]));
  });
});

describe('syntheseAcceptable', () => {
  it('accepte une reformulation fidèle, chiffres arrondis compris', () => {
    expect(syntheseAcceptable(
      'Séance hors norme : le titre gagne 2,4 %, et le carnet garde 12 500 titres à l’achat contre 3 200 à la vente.',
      c,
    )).toBe(true);
  });

  it('refuse un chiffre absent des constats', () => {
    expect(syntheseAcceptable('Le titre gagne 2,35 % pour un volume de 48 000 titres.', c)).toBe(false);
  });

  it('refuse une causalité', () => {
    expect(syntheseAcceptable('Le titre gagne 2,35 %, porté par les acheteurs.', c)).toBe(false);
  });

  it('refuse un conseil ou une prévision', () => {
    expect(syntheseAcceptable('Une opportunité à saisir.', c)).toBe(false);
    expect(syntheseAcceptable('Le titre devrait poursuivre.', c)).toBe(false);
    expect(syntheseAcceptable('Mieux vaut acheter.', c)).toBe(false);
  });

  it('accepte « côté achat » : décrire le carnet n’est pas conseiller', () => {
    expect(syntheseAcceptable('Le carnet penche côté achat.', c)).toBe(true);
  });

  it('refuse un texte vide ou trop long', () => {
    expect(syntheseAcceptable('', c)).toBe(false);
    expect(syntheseAcceptable('Rien de notable. '.repeat(60), c)).toBe(false);
  });
});
