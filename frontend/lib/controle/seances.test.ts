import { describe, expect, it } from 'vitest';
import { derniereSeanceAttendue, seancesDeRetard } from './seances';

// Repères : 2026-10-30 vendredi, 10-31 samedi, 11-01 dimanche,
// 11-02 lundi, 11-03 mardi.
const t = (iso: string) => new Date(iso);

describe('derniereSeanceAttendue', () => {
  it('un jour ouvré après l’heure de disponibilité : le jour même', () => {
    expect(derniereSeanceAttendue(t('2026-11-03T17:00:00Z'), 17)).toBe('2026-11-03');
  });

  it('un jour ouvré avant l’heure de disponibilité : la veille ouvrée', () => {
    expect(derniereSeanceAttendue(t('2026-11-03T16:59:00Z'), 17)).toBe('2026-11-02');
  });

  it('lundi matin avant disponibilité : le vendredi précédent', () => {
    expect(derniereSeanceAttendue(t('2026-11-02T08:00:00Z'), 17)).toBe('2026-10-30');
  });

  it('samedi et dimanche : le vendredi, quelle que soit l’heure', () => {
    expect(derniereSeanceAttendue(t('2026-10-31T23:00:00Z'), 17)).toBe('2026-10-30');
    expect(derniereSeanceAttendue(t('2026-11-01T02:00:00Z'), 17)).toBe('2026-10-30');
  });

  it('accepte une heure fractionnaire (16,5 = 16:30 UTC)', () => {
    expect(derniereSeanceAttendue(t('2026-11-03T16:29:00Z'), 16.5)).toBe('2026-11-02');
    expect(derniereSeanceAttendue(t('2026-11-03T16:30:00Z'), 16.5)).toBe('2026-11-03');
  });

  it('saute un jour férié connu', () => {
    expect(derniereSeanceAttendue(t('2026-11-03T18:00:00Z'), 17, ['2026-11-03'])).toBe('2026-11-02');
    expect(derniereSeanceAttendue(t('2026-11-03T08:00:00Z'), 17, ['2026-11-02'])).toBe('2026-10-30');
  });
});

describe('seancesDeRetard', () => {
  it('à jour ou en avance : zéro', () => {
    expect(seancesDeRetard('2026-11-03', '2026-11-03')).toBe(0);
    expect(seancesDeRetard('2026-11-03', '2026-11-02')).toBe(0);
  });

  it('une séance de retard', () => {
    expect(seancesDeRetard('2026-11-02', '2026-11-03')).toBe(1);
  });

  it('le week-end ne compte pas : vendredi contre lundi = 1', () => {
    expect(seancesDeRetard('2026-10-30', '2026-11-02')).toBe(1);
    expect(seancesDeRetard('2026-10-29', '2026-11-02')).toBe(2);
  });

  it('un jour férié connu ne compte pas', () => {
    expect(seancesDeRetard('2026-10-30', '2026-11-03', ['2026-11-02'])).toBe(1);
  });

  it('accepte un horodatage complet (seule la date compte)', () => {
    expect(seancesDeRetard('2026-11-02T22:27:31.422+00:00', '2026-11-03')).toBe(1);
  });

  it('aucune donnée : retard infini', () => {
    expect(seancesDeRetard(null, '2026-11-03')).toBe(Number.POSITIVE_INFINITY);
  });
});
