import { describe, it, expect } from 'vitest';
import { estJourOuvre } from '../src/utils/jourOuvre.js';

describe('estJourOuvre — pas de séance, pas d’écriture', () => {
  const feries = new Set(['2026-08-07', '2026-08-25']);

  it('les dates fantômes de 2026 sont refusées : week-ends et jours fériés', () => {
    for (const d of ['2026-05-31', '2026-06-13', '2026-08-09', '2026-08-29']) expect(estJourOuvre(d, feries)).toBe(false);
    expect(estJourOuvre('2026-08-07', feries)).toBe(false); // Indépendance CI
    expect(estJourOuvre('2026-08-25', feries)).toBe(false); // Maouloud
  });

  it('un jour de semaine non férié est un jour de séance', () => {
    for (const d of ['2026-08-06', '2026-08-10', '2026-09-14']) expect(estJourOuvre(d, feries)).toBe(true);
  });
});
