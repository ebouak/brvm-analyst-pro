import { describe, it, expect } from 'vitest';
import { ageEnJours, estPerime, plusRecente, SEUIL_PERIME_JOURS } from './fraicheur';

const LE_18_SEPT = new Date('2026-09-18T14:00:00Z');

describe('ageEnJours', () => {
  it('compte les jours calendaires UTC, indépendamment de l’heure', () => {
    expect(ageEnJours('2026-09-18', LE_18_SEPT)).toBe(0);
    expect(ageEnJours('2026-09-17', LE_18_SEPT)).toBe(1);
    expect(ageEnJours('2026-07-03', LE_18_SEPT)).toBe(77);
  });
});

describe('estPerime', () => {
  it('le cas réel du 18/09 : des indices du 03/07 sont périmés', () => {
    expect(estPerime('2026-07-03', LE_18_SEPT)).toBe(true);
  });
  it('un week-end suivi d’un jour férié n’est pas une péremption', () => {
    expect(estPerime('2026-09-14', LE_18_SEPT)).toBe(false); // 4 jours
    expect(SEUIL_PERIME_JOURS).toBe(4);
  });
  it('au-delà du seuil, périmé', () => {
    expect(estPerime('2026-09-13', LE_18_SEPT)).toBe(true); // 5 jours
  });
  it('sans date, la donnée est tenue pour périmée — jamais présentée comme actuelle', () => {
    expect(estPerime(null, LE_18_SEPT)).toBe(true);
    expect(estPerime(undefined, LE_18_SEPT)).toBe(true);
  });
});

describe('plusRecente', () => {
  it('renvoie la date la plus récente et ignore les vides', () => {
    expect(plusRecente(['2026-07-02', null, '2026-07-03', undefined])).toBe('2026-07-03');
    expect(plusRecente([])).toBeNull();
  });
});
