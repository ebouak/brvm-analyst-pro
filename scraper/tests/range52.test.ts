import { describe, it, expect } from 'vitest';
import { calculerBornes, MIN_SEANCES, type Cloture } from '../src/scrapers/range52.js';

/**
 * Ces règles ne font jamais échouer un run : une borne calculée sur trois
 * séances, ou un zéro pris pour un plus-bas, s'écrit en base sans erreur et
 * s'affiche chez l'utilisateur comme un fait. Seul un test les attrape.
 */

const serie = (code: string, cours: number[]): Cloture[] =>
  cours.map((c) => ({ code, cours_jour: c }));

/** Assez de séances pour franchir le seuil, autour d'une valeur donnée. */
const assez = (code: string, base: number): Cloture[] =>
  serie(
    code,
    Array.from({ length: MIN_SEANCES }, (_, i) => base + i),
  );

describe('calculerBornes', () => {
  it('donne le minimum et le maximum par code', () => {
    const b = calculerBornes([
      ...assez('SNTS', 14_000),
      ...assez('BOAC', 5_000),
    ]);
    expect(b.get('SNTS')).toEqual({ bas: 14_000, haut: 14_019, seances: MIN_SEANCES });
    expect(b.get('BOAC')?.bas).toBe(5_000);
  });

  it('REFUSE une valeur trop peu cotée plutôt que d’inventer une plage', () => {
    // Trois séances ne font pas 52 semaines. La case vide est honnête ;
    // « plus-bas 52 semaines : 9 800 » sur trois points ne l'est pas.
    const b = calculerBornes(serie('CABC', [9_800, 9_900, 10_000]));
    expect(b.has('CABC')).toBe(false);
  });

  it('accepte exactement au seuil, refuse juste en dessous', () => {
    expect(calculerBornes(assez('X', 100)).has('X')).toBe(true);
    expect(calculerBornes(assez('X', 100).slice(0, MIN_SEANCES - 1)).has('X')).toBe(false);
  });

  it('ignore les nuls et les zéros sans faire chuter la valeur à zéro', () => {
    // Un zéro en base est un trou de collecte, pas un cours. Le prendre pour
    // un plus-bas afficherait un tube plein sur une valeur stable.
    const lignes: Cloture[] = [
      ...assez('SGBC', 12_000),
      { code: 'SGBC', cours_jour: 0 },
      { code: 'SGBC', cours_jour: null },
    ];
    expect(calculerBornes(lignes).get('SGBC')?.bas).toBe(12_000);
  });

  it('compte les seules séances retenues', () => {
    const lignes: Cloture[] = [...assez('NTLC', 700), { code: 'NTLC', cours_jour: null }];
    expect(calculerBornes(lignes).get('NTLC')?.seances).toBe(MIN_SEANCES);
  });

  it('tolère les numériques rendus en chaîne par PostgREST', () => {
    // `numeric` revient parfois en string : sans conversion, Math.min
    // comparerait des chaînes et « 9 » l'emporterait sur « 10000 ».
    const lignes = assez('BICC', 0).map((l, i) => ({
      code: l.code,
      cours_jour: (i === 0 ? '9' : String(10_000 + i)) as unknown as number,
    }));
    const b = calculerBornes(lignes);
    expect(b.get('BICC')?.bas).toBe(9);
    expect(b.get('BICC')?.haut).toBe(10_019);
  });

  it('renvoie une carte vide sans données', () => {
    expect(calculerBornes([]).size).toBe(0);
  });
});
