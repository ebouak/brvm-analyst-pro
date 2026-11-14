import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { melangerQcm, ordreOptions } from './melange';

describe('ordreOptions', () => {
  it('est une permutation', () => {
    const o = ordreOptions('Une question', 5);
    expect([...o].sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it('est déterministe (même ordre au serveur et au client)', () => {
    expect(ordreOptions('Q', 4)).toEqual(ordreOptions('Q', 4));
  });
});

describe('melangerQcm', () => {
  it('la bonne réponse suit la permutation', () => {
    const q = { question: 'Combien font 2 + 2 ?', options: ['3', '4', '5', '6'], correct: 1, explication: '' };
    const m = melangerQcm(q);
    expect(m.options[m.correct]).toBe('4');
    expect([...m.options].sort()).toEqual([...q.options].sort());
  });

  it('sur les vraies leçons, la bonne réponse ne se concentre plus sur une position', () => {
    const racine = join(__dirname, 'contenus');
    const fichiers = [
      ...readdirSync(racine).filter((f) => f.endsWith('.json')).map((f) => join(racine, f)),
      ...['niveau2', 'niveau3', 'niveau4'].flatMap((d) => readdirSync(join(racine, d)).filter((f) => f.endsWith('.json')).map((f) => join(racine, d, f))),
    ];
    const positions: number[] = [];
    for (const f of fichiers) {
      const l = JSON.parse(readFileSync(f, 'utf8')) as { quiz?: { question: string; options: string[]; correct: number }[] };
      for (const q of l.quiz ?? []) {
        const m = melangerQcm(q);
        expect(m.options[m.correct]).toBe(q.options[q.correct]);
        positions.push(m.correct);
      }
    }
    expect(positions.length).toBeGreaterThan(100);
    const max = Math.max(...[0, 1, 2, 3].map((p) => positions.filter((x) => x === p).length / positions.length));
    // Avant : 82 % sur B. Une répartition sans biais tourne autour de 25 à 35 %.
    expect(max).toBeLessThan(0.45);
  });
});
