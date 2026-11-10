import { describe, expect, it } from 'vitest';
import { fmtDateCourte } from '@/lib/format';
import { texteAbsence } from './absence';

describe('texteAbsence', () => {
  it('distingue non collecté et non publié', () => {
    expect(texteAbsence({ etat: 'non_collecte' })).toBe('Pas encore collecté par WESTBOURSE.');
    expect(texteAbsence({ etat: 'non_publie', verifieLe: '2026-11-09' }))
      .toBe(`Non publié par la société ni par la BRVM à notre connaissance (vérifié le ${fmtDateCourte('2026-11-09')}).`);
  });
  it('sans objet et ancien', () => {
    expect(texteAbsence({ etat: 'sans_objet' })).toBe('Sans objet pour cette société.');
    expect(texteAbsence({ etat: 'ancien', date: '2023-12-31' })).toBe(`Dernière donnée connue : ${fmtDateCourte('2023-12-31')}.`);
  });
});
