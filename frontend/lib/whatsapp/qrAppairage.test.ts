import { describe, expect, it } from 'vitest';
import { create } from 'qrcode';
import { cheminQr, lienAppairage } from './qrAppairage';

describe('lienAppairage', () => {
  it('ne garde que les chiffres du numéro et pré-remplit le code seul', () => {
    expect(lienAppairage('+33 7 43 65 72 71', '482913')).toBe('https://wa.me/33743657271?text=482913');
  });

  it('encode le code (un code alphanumérique reste intact)', () => {
    expect(lienAppairage('33743657271', ' AB12CD ')).toBe('https://wa.me/33743657271?text=AB12CD');
  });

  it('refuse sans numéro configuré ou sans code', () => {
    expect(lienAppairage('', '482913')).toBeNull();
    expect(lienAppairage('123', '482913')).toBeNull();
    expect(lienAppairage('33743657271', '  ')).toBeNull();
  });
});

describe('cheminQr', () => {
  const lien = 'https://wa.me/33743657271?text=482913';

  it('dessine exactement les modules sombres de la matrice, décalés de la marge', () => {
    const { modules } = create(lien, { errorCorrectionLevel: 'M' });
    const sombres = Array.from(modules.data).filter(Boolean).length;
    const { taille, d } = cheminQr(lien);
    expect(taille).toBe(modules.size + 4);
    expect(d.match(/M/g)?.length).toBe(sombres);
    // Coin haut-gauche du motif de repérage : toujours sombre, à (marge, marge).
    expect(d.startsWith('M2 2h1v1h-1z')).toBe(true);
  });

  it('est déterministe', () => {
    expect(cheminQr(lien)).toEqual(cheminQr(lien));
  });
});
