import { describe, it, expect } from 'vitest';
import {
  resolveLayout, DEFAULT_ORDER, ORDRE_ACTIF, ORDRE_DEBUTANT, deduireProfil, ordreParDefaut,
  MASQUES_PAR_DEFAUT, LARGEUR, grouperEnRangees, classeRangee, classeCellule, WIDGETS,
} from './widgets';

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

  it('sans layout sauvegardé, l ordre dépend du profil (comprendre masqué pour l actif)', () => {
    expect(resolveLayout(null, 'actif')).toEqual(ORDRE_ACTIF.filter((k) => k !== 'comprendre'));
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

  it('layout partiel + profil actif : ordre sauvegardé, puis le défaut du profil', () => {
    const r = resolveLayout({ order: ['actus'], hidden: ['indices'] }, 'actif');
    expect(r[0]).toBe('actus');
    expect(r[1]).toBe('portefeuille');
    expect(r).not.toContain('indices');
  });
});

describe('ordres de la spec §3', () => {
  it('actif : portefeuille, agenda, publications, état, séance…', () => {
    expect(ORDRE_ACTIF).toEqual([
      'portefeuille', 'agenda', 'publications', 'etat', 'comprendre', 'seance',
      'liquidite', 'signaux', 'secteurs', 'indices', 'actus',
    ]);
  });
  it('débutant : état, comprendre, séance, agenda, publications, portefeuille…', () => {
    expect(ORDRE_DEBUTANT).toEqual([
      'etat', 'comprendre', 'seance', 'agenda', 'publications', 'portefeuille',
      'signaux', 'secteurs', 'indices', 'liquidite', 'actus',
    ]);
  });
  it('chaque clé a un libellé et une largeur', () => {
    for (const k of ORDRE_DEBUTANT) {
      expect(WIDGETS.find((w) => w.key === k)).toBeDefined();
      expect(LARGEUR[k]).toBeDefined();
    }
  });
});

describe('masqués par défaut', () => {
  it('comprendre masqué pour l actif seulement', () => {
    expect(MASQUES_PAR_DEFAUT.actif).toEqual(['comprendre']);
    expect(MASQUES_PAR_DEFAUT.debutant).toEqual([]);
    expect(resolveLayout(null, 'debutant')).toContain('comprendre');
  });
  it('layout sauvegardé AVANT l apparition de comprendre : reste masqué pour l actif', () => {
    const r = resolveLayout({ order: ['portefeuille', 'etat'], hidden: [] }, 'actif');
    expect(r).not.toContain('comprendre');
    expect(r).toContain('agenda');
  });
  it('comprendre réactivé explicitement (présent dans order) : visible', () => {
    const r = resolveLayout({ order: ['comprendre', 'portefeuille'], hidden: [] }, 'actif');
    expect(r[0]).toBe('comprendre');
  });
});

describe('rangées', () => {
  it('pleine seule ; demi par deux ; tiers par trois', () => {
    expect(grouperEnRangees(['portefeuille', 'agenda', 'publications', 'etat'])).toEqual([
      { largeur: 'pleine', cles: ['portefeuille'] },
      { largeur: 'demi', cles: ['agenda', 'publications'] },
      { largeur: 'pleine', cles: ['etat'] },
    ]);
    expect(grouperEnRangees(['signaux', 'secteurs', 'actus', 'signaux'])).toEqual([
      { largeur: 'pleine', cles: ['signaux'] },
      { largeur: 'tiers', cles: ['secteurs'] },
      { largeur: 'pleine', cles: ['actus'] },
      { largeur: 'pleine', cles: ['signaux'] },
    ]);
  });
  it('rangée = grille 12 colonnes à filet ; cellule seule = pleine largeur', () => {
    expect(classeRangee({ largeur: 'demi', cles: ['agenda'] })).toBe('grid grid-cols-1 border-b border-border lg:grid-cols-12');
    expect(classeCellule('demi', true)).toContain('lg:col-span-12');
    expect(classeCellule('demi', false)).toContain('lg:col-span-6');
    expect(classeCellule('tiers', false)).toContain('lg:col-span-4');
    expect(classeCellule('tiers', false)).toContain('lg:border-l');
  });
});

describe('resolveLayout — doublons', () => {
  it('un ordre sauvegardé avec doublon ne répète jamais un widget', () => {
    const r = resolveLayout({ order: ['actus', 'actus', 'etat'] }, 'debutant');
    expect(r.filter((k) => k === 'actus')).toHaveLength(1);
    expect(r.slice(0, 2)).toEqual(['actus', 'etat']);
  });
});
