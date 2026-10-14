import { describe, it, expect } from 'vitest';
import { resolveLayout, DEFAULT_ORDER, ORDRE_ACTIF, ORDRE_DEBUTANT, deduireProfil, ordreParDefaut } from './widgets';

describe('resolveLayout', () => {
  it('layout vide → ordre par défaut, tout visible', () => {
    expect(resolveLayout(null)).toEqual(DEFAULT_ORDER);
    expect(resolveLayout({})).toEqual(DEFAULT_ORDER);
  });

  it('respecte l ordre sauvegardé et masque les widgets cachés', () => {
    const r = resolveLayout({ order: ['signaux', 'indices'], hidden: ['actus'] });
    // ordre sauvegardé en tête, reste en ordre par défaut, actus masqué
    expect(r[0]).toBe('signaux');
    expect(r[1]).toBe('indices');
    expect(r).not.toContain('actus');
  });

  it('ajoute les widgets connus absents du layout (à la fin)', () => {
    const r = resolveLayout({ order: ['indices'] });
    expect(r[0]).toBe('indices');
    expect(r).toContain('portefeuille'); // pas dans order mais réapparaît
  });

  it('ignore les clés inconnues', () => {
    const r = resolveLayout({ order: ['indices', 'bogus'], hidden: ['nope'] });
    expect(r).not.toContain('bogus');
    expect(r).toContain('indices');
  });
});

describe('profil', () => {
  it('au moins une position → actif ; aucune → débutant', () => {
    expect(deduireProfil(1)).toBe('actif');
    expect(deduireProfil(12)).toBe('actif');
    expect(deduireProfil(0)).toBe('debutant');
  });

  it('sans layout sauvegardé, l ordre dépend du profil', () => {
    expect(resolveLayout(null, 'actif')).toEqual(ORDRE_ACTIF);
    expect(resolveLayout(null, 'debutant')).toEqual(ORDRE_DEBUTANT);
    expect(resolveLayout(null, 'actif')[0]).toBe('portefeuille');
    expect(resolveLayout(null, 'debutant')[0]).toBe('etat');
  });

  it('un layout sauvegardé l emporte toujours sur le profil', () => {
    const r = resolveLayout({ order: ['actus', 'portefeuille'] }, 'debutant');
    expect(r[0]).toBe('actus');
    expect(r[1]).toBe('portefeuille');
  });

  it('les deux ordres contiennent exactement les mêmes blocs', () => {
    expect([...ORDRE_ACTIF].sort()).toEqual([...ORDRE_DEBUTANT].sort());
    expect(ordreParDefaut('actif')).toEqual(ORDRE_ACTIF);
  });

  it('sans profil précisé : ordre débutant (comportement historique)', () => {
    expect(resolveLayout(null)).toEqual(DEFAULT_ORDER);
    expect(DEFAULT_ORDER).toEqual(ORDRE_DEBUTANT);
  });
});
