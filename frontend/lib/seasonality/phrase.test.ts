import { describe, it, expect } from 'vitest';
import { phraseConfrontation } from './phrase';
import type { Confrontation } from './server';

const base = { mois: 11, rangSeance: 9, rdtEnCours: 0.023, n: 8, q25: -0.01, q75: 0.015 } as unknown as Confrontation;

describe('phraseConfrontation (module pur, appelable côté serveur)', () => {
  it('au-dessus de la fourchette', () => {
    expect(phraseConfrontation({ ...base, etat: 'au_dessus' } as Confrontation)).toBe(
      'Depuis le début de novembre (9e séance) : +2,3 %, dividende compris. Sur 8 années, la fourchette habituelle à la même séance va de −1,0 % à +1,5 % : le cours est au-dessus de son habitude.');
  });
  it('trop tôt et historique insuffisant', () => {
    expect(phraseConfrontation({ ...base, rangSeance: 1, etat: 'trop_tot' } as Confrontation)).toMatch(/1re séance.*Trop tôt/);
    expect(phraseConfrontation({ ...base, etat: 'historique_insuffisant' } as Confrontation)).toMatch(/Moins de 5 années/);
  });
});
