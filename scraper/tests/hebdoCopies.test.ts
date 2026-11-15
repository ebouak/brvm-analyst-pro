/**
 * Les modules purs de l'analyse hebdo existent en deux copies (frontend et
 * scraper, deux paquets TS distincts). Ce test échoue dès qu'elles divergent :
 * une correction reportée d'un seul côté publierait un texte différent de
 * celui que la page sait relire. Régénérer : `node scripts/sync-hebdo-pure.mjs`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeLevels, pasDeCotation, MARGE_SORTIE_PCT } from '../src/hebdo/pure/levels.js';

const RACINE = join(__dirname, '..', '..');
const MODULES = ['types', 'levels', 'select', 'narrative', 'format', 'context', 'fundamentals', 'post', 'analyse'];

/** Retire l'en-tête « COPIE » et ramène les imports à la forme du frontend. */
function normalise(scraper: string): string {
  return scraper
    .replace(/^(\/\/.*\n)+/, '')
    .replace(/from '\.\/indicators\.js'/g, "from '../indicators'")
    .replace(/from '\.\/([a-zA-Z]+)\.js'/g, "from './$1'")
    .replace(/\r\n/g, '\n');
}

describe('analyse hebdo : copies frontend / scraper', () => {
  for (const m of MODULES) {
    it(`${m}.ts est identique des deux côtés`, () => {
      const front = readFileSync(join(RACINE, 'frontend', 'lib', 'hebdo', `${m}.ts`), 'utf8').replace(/\r\n/g, '\n');
      const copie = readFileSync(join(RACINE, 'scraper', 'src', 'hebdo', 'pure', `${m}.ts`), 'utf8');
      expect(copie.startsWith('// COPIE de frontend/lib/hebdo')).toBe(true);
      expect(normalise(copie)).toBe(front);
    });
  }

  it('la copie du scraper ne voit pas de cassure à 5 FCFA du plafond (SLBC, 13/11/2026)', () => {
    const closes = [
      38500, 38495, 38600, 38700, 38800, 38900, 38710, 38800, 38700, 38710, 38710, 39000, 39990, 38995,
      39000, 38700, 39100, 39120, 40000, 40000, 40000, 42945, 42950,
    ];
    const l = computeLevels(closes, { pas: pasDeCotation(closes), margePct: MARGE_SORTIE_PCT })!;
    expect(l.cassureHaut).toBe(false);
    expect(l.contactHaut).toBe(true);
    expect(l.invalidation % 5).toBe(0);
  });
});
