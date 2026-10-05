import { describe, expect, it } from 'vitest';
import { lignesExercice, schemaNouvelExercice, verifierNouvelExercice } from '../src/annuel/nouvelExercice.js';

const M = 1e6;
const base2024 = { revenu_total: 300_000 * M, resultat_net: 20_000 * M, total_actifs: 500_000 * M };
const doc = (n0: object, n1: object, extra: object = {}) =>
  schemaNouvelExercice.parse({ devise_source: 'fcfa', colonnes: [{ annee: 2025, ...n0 }, { annee: 2024, ...n1 }], ...extra });
const n0 = { revenu_total: 320_000 * M, resultat_net: 22_000 * M, total_actifs: 520_000 * M, total_passif: 520_000 * M, total_capitaux_propres: 200_000 * M };
const n1 = { revenu_total: 300_000 * M, resultat_net: 20_100 * M, total_actifs: 500_000 * M };

describe('verifierNouvelExercice — preuve par la colonne N−1', () => {
  it('accepte quand la colonne 2024 relue retrouve la base', () => {
    const v = verifierNouvelExercice(doc(n0, n1), 2025, base2024);
    expect(v.ok).toBe(true);
    expect(v.ancres).toBe(3);
  });

  it('REJETTE si la colonne 2024 relue ne retrouve pas la base (unité, périmètre)', () => {
    expect(verifierNouvelExercice(doc(n0, { ...n1, revenu_total: 300_000 * 1000 }), 2025, base2024).ok).toBe(false);
  });

  it('REJETTE sans colonne N−1, ou avec moins de deux ancres', () => {
    expect(verifierNouvelExercice(schemaNouvelExercice.parse({ devise_source: 'fcfa', colonnes: [{ annee: 2025, ...n0 }] }), 2025, base2024).ok).toBe(false);
    expect(verifierNouvelExercice(doc(n0, { revenu_total: 300_000 * M }), 2025, base2024).ok).toBe(false);
  });

  it('REJETTE un bilan déséquilibré, une devise étrangère, une colonne N dans une autre unité', () => {
    expect(verifierNouvelExercice(doc({ ...n0, total_passif: 400_000 * M }, n1), 2025, base2024).ok).toBe(false);
    expect(verifierNouvelExercice(doc(n0, n1, { devise_source: 'usd' }), 2025, base2024).ok).toBe(false);
    expect(verifierNouvelExercice(doc({ ...n0, revenu_total: 320_000 }, n1), 2025, base2024).ok).toBe(false);
  });
});

describe('lignesExercice', () => {
  it('projette les quatre tables comme l’import historique, BPA non arrondi', () => {
    const l = lignesExercice('SDSC', schemaNouvelExercice.parse({ colonnes: [{ annee: 2025, ...n0, benefice_par_action: 412.5, total_actif_circulant: 100, passif_courant: 60, dette_long_terme: 50 }] }).colonnes[0]!, 'EF 2025');
    expect(l.income).toMatchObject({ code: 'SDSC', periode: '2025', type_periode: 'annuel', benefice_par_action: 412.5 });
    expect(l.fundamentals).toMatchObject({ year: 2025, debt: 50, bfr: 40, source: 'llm-extracted', source_file: 'EF 2025' });
  });
});
