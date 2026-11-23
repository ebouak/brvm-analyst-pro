import { describe, expect, it } from 'vitest';
import { periodeDuRapport, finPeriode, rapportAnterieur } from './rapportActivite';

describe('periodeDuRapport (libellés réels de rapport_highlights)', () => {
  it.each([
    ["Rapport d'activités - 1er semestre 2025 - CIE CI", '2025-06', '1er semestre 2025'],
    ["Rapport d'activités - 1er Semestre 2023 - X", '2023-06', '1er semestre 2023'],
    ["Rapport d'Activité du 1er semestre 2023", '2023-06', '1er semestre 2023'],
    ["Rapport d'activités - 1er trimestre 2026 - X", '2026-03', '1er trimestre 2026'],
    ["Rapport d'activités - 2eme trimestre 2026 - X", '2026-06', '2e trimestre 2026'],
    ["Rapport d'activités - 3e trimestre 2026 - NEI-CEDA CI", '2026-09', '3e trimestre 2026'],
    ["Rapport d'activités annuel - Exercice 2024 - X", '2024-12', 'exercice 2024'],
    ["Rapport d'activités annuel exercice 2021", '2021-12', 'exercice 2021'],
    ['Rapport Annuel Intégré - Exercice 2025 - X', '2025-12', 'exercice 2025'],
    ['Rapport Annuel 2023 - X', '2023-12', 'exercice 2023'],
    ["Rapport d'Activités annuel 2023 - X", '2023-12', 'exercice 2023'],
    ["Rapport d'activités et rapport d'examen limité des CACs- 1er semestre 2026", '2026-06', '1er semestre 2026'],
  ])('%s', (source, fin, libelle) => {
    expect(periodeDuRapport(source)).toEqual({ fin, libelle });
  });

  it('sans année lisible : null, jamais deviné', () => {
    expect(periodeDuRapport('SICOR CI : Rapport annuel')).toBeNull();
    expect(periodeDuRapport(null)).toBeNull();
  });
});

describe('finPeriode', () => {
  it('lit les codes de la Revue', () => {
    expect(finPeriode('2026-S1')).toBe('2026-06');
    expect(finPeriode('2026-T1')).toBe('2026-03');
    expect(finPeriode('2025-T3')).toBe('2025-09');
    expect(finPeriode('2025')).toBe('2025-12');
    expect(finPeriode('n/a')).toBeNull();
  });
});

describe('rapportAnterieur', () => {
  it('CIEC : rapport du 1er semestre 2025 dans une revue du 1er semestre 2026', () => {
    expect(rapportAnterieur(periodeDuRapport("Rapport d'activités - 1er semestre 2025"), '2026-S1')).toBe(true);
  });
  it('rapport annuel 2025 face à une revue du 1er semestre 2026 : antérieur', () => {
    expect(rapportAnterieur(periodeDuRapport('Rapport annuel - Exercice 2025'), '2026-S1')).toBe(true);
  });
  it('même période, ou plus récente : pas antérieur', () => {
    expect(rapportAnterieur(periodeDuRapport("Rapport d'activités - 1er semestre 2026"), '2026-S1')).toBe(false);
    expect(rapportAnterieur(periodeDuRapport("Rapport d'activités - 3e trimestre 2026"), '2026-S1')).toBe(false);
    expect(rapportAnterieur(periodeDuRapport('Rapport annuel - Exercice 2025'), '2025')).toBe(false);
  });
  it('période inconnue d’un côté ou de l’autre : on ne déclare rien', () => {
    expect(rapportAnterieur(null, '2026-S1')).toBe(false);
    expect(rapportAnterieur(periodeDuRapport('Rapport annuel - Exercice 2025'), null)).toBe(false);
  });
});
