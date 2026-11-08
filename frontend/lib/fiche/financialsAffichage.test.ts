import { describe, it, expect } from 'vitest';
import { avecBpaCalcule, croissanceRnSignee, libelleValorisationSimplifiee } from './financialsAffichage';

const st = (periode: string, resultat_net: number | null, benefice_par_action: number | null) =>
  ({ periode, type_periode: 'annuel', resultat_net, benefice_par_action });

describe('avecBpaCalcule', () => {
  it('calcule le BPA des exercices sans valeur, avec la source unique de la fiche', () => {
    const r = avecBpaCalcule([st('2025', -2_500, null), st('2024', 1_000, null)], 348);
    expect(r[0]!.benefice_par_action).toBe(-7.18);
    expect(r[1]!.benefice_par_action).toBe(2.87);
  });
  it('le premier exercice (le plus récent) est toujours recalculé, comme la fiche', () => {
    expect(avecBpaCalcule([st('2025', -2_500, 99)], 348)[0]!.benefice_par_action).toBe(-7.18);
  });
  it('conserve la valeur publiée des exercices antérieurs', () => {
    expect(avecBpaCalcule([st('2025', 100, null), st('2024', 1_000, 5)], 10)[1]!.benefice_par_action).toBe(5);
  });
  it('sans titres ou sans résultat net, ne touche à rien', () => {
    expect(avecBpaCalcule([st('2025', 100, null)], null)[0]!.benefice_par_action).toBeNull();
    expect(avecBpaCalcule([st('2025', null, 4)], 10)[0]!.benefice_par_action).toBe(4);
  });
});

describe('croissanceRnSignee', () => {
  it('pourcentage signé seulement si les deux exercices sont positifs', () => {
    expect(croissanceRnSignee(150, 100, 50)).toBe(50);
  });
  it("null quand l'un des deux exercices est en perte (la forme en mots prend le relais)", () => {
    expect(croissanceRnSignee(-100, -360, 72.3)).toBeNull();
    expect(croissanceRnSignee(100, -50, 300)).toBeNull();
    expect(croissanceRnSignee(-10, 50, -120)).toBeNull();
  });
  it('null si une valeur manque', () => {
    expect(croissanceRnSignee(null, 100, 5)).toBeNull();
  });
});

describe('libelleValorisationSimplifiee', () => {
  it('nomme le modèle et son objet', () => {
    expect(libelleValorisationSimplifiee()).toMatch(/Graham/);
    expect(libelleValorisationSimplifiee()).toMatch(/PER/);
  });
});
