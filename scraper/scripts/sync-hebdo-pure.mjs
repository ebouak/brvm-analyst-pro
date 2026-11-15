#!/usr/bin/env node
/**
 * Recopie les modules purs de l'analyse hebdo du frontend vers le scraper.
 * Deux paquets TS distincts, pas de module partagé : `frontend/lib/hebdo/` fait
 * foi, `scraper/src/hebdo/pure/` en est la COPIE (en-tête + extensions `.js`).
 * Le test `tests/hebdoCopies.test.ts` échoue si les deux divergent.
 *
 *   node scripts/sync-hebdo-pure.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(ici, '..', '..', 'frontend', 'lib', 'hebdo');
const CIBLE = join(ici, '..', 'src', 'hebdo', 'pure');

export const MODULES = ['types', 'levels', 'select', 'narrative', 'format', 'context', 'fundamentals', 'post', 'analyse'];

export const ENTETE =
  '// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts\n' +
  '// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.\n' +
  '// Régénérer avec `node scripts/sync-hebdo-pure.mjs` (vérifié par tests/hebdoCopies.test.ts).\n';

export function versScraper(source) {
  return ENTETE + source
    .replace(/from '\.\.\/indicators'/g, "from './indicators.js'")
    .replace(/from '\.\/([a-zA-Z]+)'/g, "from './$1.js'");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const m of MODULES) {
    const src = readFileSync(join(SOURCE, `${m}.ts`), 'utf8');
    writeFileSync(join(CIBLE, `${m}.ts`), versScraper(src));
    console.log(`copié : ${m}.ts`);
  }
}
