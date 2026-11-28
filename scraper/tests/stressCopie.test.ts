/**
 * Garde-fou de parité entre `scraper/src/stress/pure/` et `frontend/lib/stress/`.
 * Échoue dès qu'une des deux copies diverge.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');

function normaliseFrontend(src: string): string {
  return src
    .replace(/^\/\/ COPIE de .*?\n/, '')
    .replace(/\r\n/g, '\n');
}

function normaliseScraper(src: string): string {
  return src
    .replace(/from '(\.[^']+)\.js'/g, "from '$1'")
    .replace(/\r\n/g, '\n');
}

describe('stress monitor : parité scraper / frontend', () => {
  for (const mod of [
    'types',
    'drawdowns',
    'resilienceTypes',
    'backtestingTypes',
    'backtesting',
    'stressIndexTypes',
    'stressIndex',
  ] as const) {
    it(`${mod}.ts est identique des deux côtés`, () => {
      const front = readFileSync(join(RACINE, 'frontend', 'lib', 'stress', `${mod}.ts`), 'utf8');
      const scraper = readFileSync(join(RACINE, 'scraper', 'src', 'stress', 'pure', `${mod}.ts`), 'utf8');
      expect(front.startsWith(`// COPIE de scraper/src/stress/pure/${mod}.ts`)).toBe(true);
      expect(normaliseFrontend(front)).toBe(normaliseScraper(scraper));
    });
  }
});
