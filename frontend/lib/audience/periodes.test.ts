import { describe, it, expect } from 'vitest';
import { bornesPeriode, estPeriode, horodatageHogql, libelleFenetre } from './periodes';

const iso = (d: Date) => d.toISOString();
describe('bornesPeriode', () => {
  const now = new Date('2026-11-04T10:30:00Z'); // mercredi
  it('jour : hier 00:00 → aujourd\'hui 00:00, précédent = avant-hier', () => {
    const b = bornesPeriode('jour', now);
    expect([iso(b.debut), iso(b.fin)]).toEqual(['2026-11-03T00:00:00.000Z', '2026-11-04T00:00:00.000Z']);
    expect(iso(b.precedent.debut)).toBe('2026-11-02T00:00:00.000Z');
    expect(iso(b.precedent.fin)).toBe('2026-11-03T00:00:00.000Z');
  });
  it('semaine : dernière semaine ISO complète lundi → dimanche', () => {
    const b = bornesPeriode('semaine', now);
    expect([iso(b.debut), iso(b.fin)]).toEqual(['2026-10-26T00:00:00.000Z', '2026-11-02T00:00:00.000Z']);
    expect(iso(b.precedent.debut)).toBe('2026-10-19T00:00:00.000Z');
  });
  it('semaine : un lundi, la semaine écoulée vient de se terminer', () => {
    const b = bornesPeriode('semaine', new Date('2026-11-02T07:00:00Z'));
    expect(iso(b.debut)).toBe('2026-10-26T00:00:00.000Z');
    expect(iso(b.fin)).toBe('2026-11-02T00:00:00.000Z');
  });
  it('semaine : un dimanche, la semaine en cours n\'est pas finie', () => {
    const b = bornesPeriode('semaine', new Date('2026-11-01T23:00:00Z'));
    expect(iso(b.fin)).toBe('2026-10-26T00:00:00.000Z');
  });
  it('mois : dernier mois civil complet, y compris à cheval sur janvier', () => {
    const b = bornesPeriode('mois', now);
    expect([iso(b.debut), iso(b.fin)]).toEqual(['2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z']);
    const j = bornesPeriode('mois', new Date('2026-01-01T07:30:00Z'));
    expect([iso(j.debut), iso(j.fin)]).toEqual(['2025-12-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']);
    expect(iso(j.precedent.debut)).toBe('2025-11-01T00:00:00.000Z');
  });
  it('glissant : N jours finissant à l\'heure pleine, précédent contigu', () => {
    const b = bornesPeriode('30j', now);
    expect(iso(b.fin)).toBe('2026-11-04T10:00:00.000Z');
    expect(b.fin.getTime() - b.debut.getTime()).toBe(30 * 86_400_000);
    expect(b.precedent.fin.getTime()).toBe(b.debut.getTime());
    expect(b.precedent.fin.getTime() - b.precedent.debut.getTime()).toBe(30 * 86_400_000);
  });
});
describe('utilitaires', () => {
  it('estPeriode', () => { expect(estPeriode('30j')).toBe(true); expect(estPeriode('1; DROP')).toBe(false); expect(estPeriode(undefined)).toBe(false); });
  it('horodatageHogql', () => { expect(horodatageHogql(new Date('2026-10-01T00:00:00Z'))).toBe('2026-10-01 00:00:00'); });
  it('libelleFenetre montre le dernier jour inclus', () => {
    const b = bornesPeriode('jour', new Date('2026-11-04T10:00:00Z'));
    expect(libelleFenetre(b)).toBe(libelleFenetre({ debut: b.debut, fin: b.fin }));
    expect(libelleFenetre(b)).not.toContain('→');
  });
});
