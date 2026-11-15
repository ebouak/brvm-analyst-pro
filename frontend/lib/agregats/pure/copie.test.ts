import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La copie frontend des modules purs de sélection doit rester identique au
 * scraper (seules les extensions `.js` d'import diffèrent). En cas d'échec :
 * corriger côté scraper, puis `node scripts/copier-agregats-purs.mjs`.
 */
const FICHIERS = [
  'agregats/indicateurs.ts',
  'agregats/dates.ts',
  'agregats/nombres.ts',
  'agregats/ecritures.ts',
  'prudentiel/rapprochement.ts',
  'prudentiel/montants.ts',
  'prudentiel/selection.ts',
];
const RACINE = path.resolve(__dirname, '..', '..', '..', '..');

const attendu = (rel: string, source: string) =>
  `// COPIE GÉNÉRÉE de scraper/src/${rel} par frontend/scripts/copier-agregats-purs.mjs — ne pas modifier ici.\n${source
    .replace(/\r\n/g, '\n')
    .replace(/(from\s+'\.{1,2}\/[^']+)\.js'/g, "$1'")}`;

describe('copie des modules purs de sélection', () => {
  it.each(FICHIERS)('%s est à jour', (rel) => {
    const source = readFileSync(path.join(RACINE, 'scraper', 'src', rel), 'utf8');
    const copie = readFileSync(path.join(RACINE, 'frontend', 'lib', 'agregats', 'pure', rel), 'utf8').replace(/\r\n/g, '\n');
    expect(copie).toBe(attendu(rel, source));
  });
});
