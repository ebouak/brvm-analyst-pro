import { describe, it, expect } from 'vitest';
import { LIBELLE_ETAT, moisProchaineRevision, preuveDe, signalPerime, signalValide, statutDe, type EtatSignal } from './signal';

const ETATS: EtatSignal[] = ['a_eviter', 'favorable', 'neutre', 'pas_de_signal'];

describe('signalValide', () => {
  it('exige un code, une date et un état connu', () => {
    expect(signalValide({ code: 'SNTS', date_marche: '2026-12-01', etat: 'favorable' })).toBe(true);
    expect(signalValide({ code: 'SNTS', date_marche: '2026-12-01', etat: 'acheter' })).toBe(false);
    expect(signalValide({ code: '', date_marche: '2026-12-01', etat: 'neutre' })).toBe(false);
    expect(signalValide({ code: 'SNTS', etat: 'neutre' })).toBe(false);
  });
});

describe('textes du signal', () => {
  it('chaque état a un libellé et une preuve', () => {
    for (const e of ETATS) {
      expect(LIBELLE_ETAT[e].length).toBeGreaterThan(0);
      expect(preuveDe(e).length).toBeGreaterThan(0);
    }
  });
  it('donne les chiffres historiques au format français', () => {
    expect(preuveDe('a_eviter')).toContain('8,0 % par an de moins que la cote');
    expect(preuveDe('a_eviter')).toContain('63 % du temps');
    expect(preuveDe('favorable')).toContain('5,3 % par an de mieux');
    expect(preuveDe('favorable')).toContain("n'est pas établi statistiquement");
  });
  it('dit le statut de la preuve pour les deux états classés aux extrêmes', () => {
    expect(statutDe('a_eviter')).toContain('exploratoire');
    expect(statutDe('a_eviter')).toContain('10 novembre 2026');
    expect(statutDe('favorable')).toBe('Non prouvé.');
    expect(statutDe('neutre')).toBeNull();
    expect(statutDe('pas_de_signal')).toBeNull();
  });
  it("n'emploie aucun verbe d'ordre", () => {
    const tout = ETATS.map((e) => `${LIBELLE_ETAT[e]} ${preuveDe(e)} ${statutDe(e) ?? ''}`).join(' ').toLowerCase();
    for (const mot of ['achetez', 'vendez', 'acheter', 'vendre', 'conservez', 'renforcez', 'allégez', 'recommand']) expect(tout).not.toContain(mot);
  });
});

describe('signalPerime', () => {
  it('périmé au-delà de 45 jours ou si une date est illisible', () => {
    expect(signalPerime('2026-12-01', '2026-12-31')).toBe(false);
    expect(signalPerime('2026-12-01', '2027-01-15')).toBe(false);
    expect(signalPerime('2026-12-01', '2027-01-16')).toBe(true);
    expect(signalPerime('', '2027-01-16')).toBe(true);
  });
});

describe('moisProchaineRevision', () => {
  it('donne le mois civil suivant, y compris au passage de l’année', () => {
    expect(moisProchaineRevision('2026-11-12')).toBe('décembre 2026');
    expect(moisProchaineRevision('2026-12-31')).toBe('janvier 2027');
  });
});
