import { describe, it, expect } from 'vitest';
import { normaliserReglages, REGLAGES_PAR_DEFAUT, validerReglages } from './reglages';

describe('REGLAGES_PAR_DEFAUT', () => {
  it('reprend les valeurs de la migration 0177, séquences éteintes', () => {
    expect(REGLAGES_PAR_DEFAUT).toEqual({ max_relances: 3, delai_min_jours: 7, delai_suivi_jours: 7, fenetre_conversion_jours: 30, mode_sequences: 'off', plafond_par_execution: 20 });
  });
});

describe('normaliserReglages', () => {
  it('rend les défauts pour une entrée absente ou invalide', () => {
    for (const x of [null, undefined, 42, 'x', []]) expect(normaliserReglages(x)).toEqual(REGLAGES_PAR_DEFAUT);
  });
  it('lit une ligne valide et ignore les colonnes de traçabilité', () => {
    const r = normaliserReglages({ id: 1, max_relances: 5, delai_min_jours: 10, delai_suivi_jours: 3, fenetre_conversion_jours: 45, mode_sequences: 'simulation', plafond_par_execution: 50, modifie_par: 'u', modifie_le: 'x' });
    expect(r).toEqual({ max_relances: 5, delai_min_jours: 10, delai_suivi_jours: 3, fenetre_conversion_jours: 45, mode_sequences: 'simulation', plafond_par_execution: 50 });
  });
  it('un champ invalide retombe sur son défaut, les autres restent', () => {
    const r = normaliserReglages({ max_relances: 'beaucoup', delai_min_jours: -2, delai_suivi_jours: 2.5, fenetre_conversion_jours: 0, plafond_par_execution: null, mode_sequences: 'actif' });
    expect(r).toEqual({ ...REGLAGES_PAR_DEFAUT, mode_sequences: 'actif' });
  });
  it('mode inconnu => off (jamais actif par accident)', () => {
    expect(normaliserReglages({ mode_sequences: 'ACTIF' }).mode_sequences).toBe('off');
    expect(normaliserReglages({ mode_sequences: 1 }).mode_sequences).toBe('off');
  });
  it('accepte des entiers numériques sous forme de chaîne (PostgREST bigint)', () => {
    expect(normaliserReglages({ max_relances: '4' }).max_relances).toBe(4);
  });
});

describe('validerReglages', () => {
  const ok = { max_relances: 3, delai_min_jours: 7, delai_suivi_jours: 7, fenetre_conversion_jours: 30, mode_sequences: 'off', plafond_par_execution: 20 };
  it('accepte une saisie conforme', () => {
    expect(validerReglages(ok)).toEqual({ ok: true, reglages: ok });
  });
  it('refuse hors bornes, non entier ou mode inconnu, avec un message', () => {
    for (const mauvais of [{ max_relances: 0 }, { max_relances: 11 }, { delai_min_jours: 0 }, { delai_suivi_jours: 61 }, { fenetre_conversion_jours: 1.5 }, { plafond_par_execution: 0 }, { plafond_par_execution: 201 }, { mode_sequences: 'auto' }]) {
      const r = validerReglages({ ...ok, ...mauvais });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message.length).toBeGreaterThan(5);
    }
  });
});
