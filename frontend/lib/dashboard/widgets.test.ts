import { describe, it, expect } from 'vitest';
import { resolveLayout, DEFAULT_ORDER } from './widgets';

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
