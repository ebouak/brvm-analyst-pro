import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PANNEAU, SOMMAIRE, TOTAL_FEUILLES, TOTAL_PANNEAUX, renvoi } from './structure';

describe('structure du dossier valeur', () => {
  it('les panneaux sont numérotés de 1 à TOTAL_PANNEAUX, sans trou ni doublon', () => {
    const rangs = Object.values(PANNEAU).sort((a, b) => a - b);
    expect(rangs).toEqual(Array.from({ length: TOTAL_PANNEAUX }, (_, i) => i + 1));
  });

  it('le sommaire couvre tous les panneaux dans l’ordre, sur des feuilles qui existent', () => {
    const cites: number[] = [];
    for (const [, panneaux] of SOMMAIRE) {
      const [a, b] = panneaux.split('-').map(Number) as [number, number | undefined];
      for (let n = a; n <= (b ?? a); n++) cites.push(n);
    }
    expect(cites).toEqual(Array.from({ length: TOTAL_PANNEAUX }, (_, i) => i + 1));
    const feuilles = SOMMAIRE.map(([, , f]) => f);
    expect(feuilles).toEqual([...feuilles].sort((x, y) => x - y));
    expect(Math.max(...feuilles)).toBeLessThanOrEqual(TOTAL_FEUILLES);
    expect(Math.min(...feuilles)).toBeGreaterThanOrEqual(5); // couverture, essentiel, lecture et une ouverture précèdent
  });

  it('renvoi() écrit le rang réel du panneau', () => {
    expect(renvoi('methode')).toBe(`panneau ${TOTAL_PANNEAUX}`);
    expect(renvoi('appuis')).toBe('panneau 11');
  });

  it('le worker d’impression attend exactement TOTAL_FEUILLES feuilles', () => {
    const src = readFileSync(join(__dirname, '..', '..', '..', 'video', 'dossiers.mjs'), 'utf8');
    const m = /const FEUILLES_ATTENDUES = (\d+);/.exec(src);
    expect(m, 'FEUILLES_ATTENDUES introuvable dans video/dossiers.mjs').not.toBeNull();
    expect(Number(m![1])).toBe(TOTAL_FEUILLES);
  });
});
