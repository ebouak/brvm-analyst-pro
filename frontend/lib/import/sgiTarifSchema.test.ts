import { describe, it, expect } from 'vitest';
import { sgiTarifSchema, checkSgiTarif, sgiTarifToRow, type SgiTarifExtraction } from './sgiTarifSchema';

function mk(partial: Partial<SgiTarifExtraction>): SgiTarifExtraction {
  return {
    courtage_pct_min: null,
    courtage_pct_max: null,
    minimum_perception: null,
    droits_garde_pct_min: null,
    droits_garde_pct_max: null,
    droits_garde_frequence: null,
    droits_garde_minimum: null,
    tenue_compte_montant: null,
    tenue_compte_frequence: null,
    frais_virement: null,
    depot_minimum: null,
    gestion_sous_mandat_pct_min: null,
    gestion_sous_mandat_pct_max: null,
    ...partial,
  };
}

describe('sgiTarifSchema', () => {
  it('parse un objet valide', () => {
    const r = sgiTarifSchema.safeParse(mk({ courtage_pct_max: 0.8, droits_garde_frequence: 'trimestriel' }));
    expect(r.success).toBe(true);
  });
  it('rejette une fréquence invalide', () => {
    const r = sgiTarifSchema.safeParse({ ...mk({}), droits_garde_frequence: 'mensuel' });
    expect(r.success).toBe(false);
  });
});

describe('checkSgiTarif', () => {
  it('accepte un barème plausible (BSIC Capital)', () => {
    const g = checkSgiTarif(mk({
      courtage_pct_min: 0.8, courtage_pct_max: 0.81,
      droits_garde_pct_min: 0.0625, droits_garde_pct_max: 0.125, droits_garde_frequence: 'trimestriel',
      tenue_compte_montant: 2500, tenue_compte_frequence: 'trimestriel',
      gestion_sous_mandat_pct_min: 0.5, gestion_sous_mandat_pct_max: 0.5,
      depot_minimum: 500_000,
    }));
    expect(g.ok).toBe(true);
    expect(g.reasons).toHaveLength(0);
  });

  it('rejette un courtage aberrant (> 3%)', () => {
    const g = checkSgiTarif(mk({ courtage_pct_max: 12 }));
    expect(g.ok).toBe(false);
    expect(g.reasons.join()).toMatch(/Courtage/);
  });

  it('rejette min > max sur une fourchette', () => {
    const g = checkSgiTarif(mk({ courtage_pct_min: 1.0, courtage_pct_max: 0.5 }));
    expect(g.ok).toBe(false);
    expect(g.reasons.join()).toMatch(/min > max/);
  });

  it('rejette un montant négatif', () => {
    const g = checkSgiTarif(mk({ depot_minimum: -1 }));
    expect(g.ok).toBe(false);
  });

  it('rejette une extraction entièrement vide', () => {
    const g = checkSgiTarif(mk({}));
    expect(g.ok).toBe(false);
    expect(g.reasons.join()).toMatch(/Aucune donnée/);
  });
});

describe('sgiTarifToRow', () => {
  it('mappe vers une ligne sgi_frais avec confiance homologue_crepmf', () => {
    const row = sgiTarifToRow('BSIC Capital SA', mk({ courtage_pct_max: 0.8 }), 'Décision X', '2026-07-02');
    expect(row.sgi_nom).toBe('BSIC Capital SA');
    expect(row.courtage_pct_max).toBe(0.8);
    expect(row.confiance).toBe('homologue_crepmf');
    expect(row.source_label).toBe('Décision X');
    expect(row.verifie_le).toBe('2026-07-02');
  });
});
