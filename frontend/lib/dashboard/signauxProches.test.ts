import { describe, it, expect } from 'vitest';
import { notesProches, SEUIL_SIGNAL } from './signauxProches';

describe('notesProches', () => {
  const notes = [
    { code: 'SNTS', score_total: 0.52 },
    { code: 'SGBC', score_total: 0.41 },
    { code: 'ORAC', score_total: 0.05 },
    { code: 'PALC', score_total: 0.58 },
    { code: 'BOAS', score_total: 0.3 },
    { code: 'NTLC', score_total: -0.55 },
    { code: 'SDCC', score_total: -0.2 },
    { code: 'ABJC', score_total: null },
  ];

  it('classe les plus hautes par proximité du seuil, avec leur écart', () => {
    const { hautes } = notesProches(notes);
    expect(hautes.map((h) => h.code)).toEqual(['PALC', 'SNTS', 'SGBC']);
    expect(hautes[0]!.ecart).toBeCloseTo(SEUIL_SIGNAL - 0.58, 6);
  });

  it('classe les plus basses du côté négatif, la plus proche de −0,6 d’abord', () => {
    const { basses } = notesProches(notes);
    expect(basses.map((b) => b.code)).toEqual(['NTLC', 'SDCC']);
    expect(basses[0]!.ecart).toBeCloseTo(0.05, 6);
  });

  it('ignore les notes absentes et les notes déjà au-delà du seuil (ce sont des signaux)', () => {
    const { hautes, basses } = notesProches([
      { code: 'A', score_total: 0.7 },
      { code: 'B', score_total: -0.8 },
      { code: 'C', score_total: null },
    ]);
    expect(hautes).toEqual([]);
    expect(basses).toEqual([]);
  });

  it('une séance sans note donne deux listes vides', () => {
    expect(notesProches([])).toEqual({ hautes: [], basses: [] });
  });
});
