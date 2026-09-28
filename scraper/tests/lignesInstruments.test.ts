import { describe, it, expect } from 'vitest';
import { lignesInstruments } from '../src/persistence/repository.js';

describe('lignesInstruments — une collecte n’efface pas le référentiel curé', () => {
  it('secteur nul (brvm.org) : la clé n’est PAS envoyée', () => {
    const [groupe] = lignesInstruments([{ code: 'SNTS', designation: 'SONATEL', pays: null, secteur: null, type: 'action', actif: true }]);
    expect(groupe[0]).not.toHaveProperty('secteur');
    expect(groupe[0]).not.toHaveProperty('pays');
    expect(groupe[0]).toMatchObject({ code: 'SNTS', designation: 'SONATEL', type: 'action', actif: true });
  });

  it('secteur vide ou blanc (BDFIN sans la colonne) : la clé n’est PAS envoyée', () => {
    const groupes = lignesInstruments([
      { code: 'SNTS', secteur: '', type: 'action' },
      { code: 'ORAC', secteur: '   ', type: 'action' },
    ]);
    expect(groupes).toHaveLength(1);
    for (const l of groupes[0]) expect(l).not.toHaveProperty('secteur');
  });

  it('secteur renseigné : envoyé tel quel', () => {
    const [groupe] = lignesInstruments([{ code: 'SNTS', secteur: 'Télécommunications', type: 'action' }]);
    expect(groupe[0].secteur).toBe('Télécommunications');
  });

  it('formes différentes : lots séparés, jamais mélangés (PostgREST compléterait à null)', () => {
    const groupes = lignesInstruments([
      { code: 'SNTS', secteur: 'Télécommunications', type: 'action' },
      { code: 'ORAC', secteur: null, type: 'action' },
      { code: 'SGBC', secteur: 'Services financiers', type: 'action' },
    ]);
    expect(groupes).toHaveLength(2);
    for (const g of groupes) {
      const formes = new Set(g.map((l) => Object.keys(l).sort().join(',')));
      expect(formes.size).toBe(1);
    }
    expect(groupes.flat().map((l) => l.code).sort()).toEqual(['ORAC', 'SGBC', 'SNTS']);
  });

  it('les colonnes NON curées restent envoyées même nulles (type, actif)', () => {
    const [groupe] = lignesInstruments([{ code: 'X', type: null, actif: false }]);
    expect(groupe[0]).toHaveProperty('type', null);
    expect(groupe[0]).toHaveProperty('actif', false);
  });
});
