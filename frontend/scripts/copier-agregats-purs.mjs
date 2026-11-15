#!/usr/bin/env node
/**
 * Copie les modules PURS de sélection des agrégats bancaires du scraper vers
 * frontend/lib/agregats/pure/ (deux paquets TS distincts, aucun module
 * partagé). La route de relecture /api/admin/agregats/relecture/[id] en a
 * besoin pour appliquer une décision IMMÉDIATEMENT (avenant du 2026-11-15).
 *
 * Seule transformation : les extensions `.js` des imports relatifs sont
 * retirées, et une ligne d'en-tête signale la copie. copie.test.ts vérifie
 * que la copie est à jour.
 *
 *   node scripts/copier-agregats-purs.mjs   (depuis frontend/)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(ICI, '..', '..', 'scraper', 'src');
const CIBLE = join(ICI, '..', 'lib', 'agregats', 'pure');

export const FICHIERS = [
  'agregats/indicateurs.ts',
  'agregats/dates.ts',
  'agregats/nombres.ts',
  'agregats/ecritures.ts',
  'prudentiel/rapprochement.ts',
  'prudentiel/montants.ts',
  'prudentiel/selection.ts',
];

export function transformer(rel, source) {
  const corps = source.replace(/\r\n/g, '\n').replace(/(from\s+'\.{1,2}\/[^']+)\.js'/g, "$1'");
  return `// COPIE GÉNÉRÉE de scraper/src/${rel} par frontend/scripts/copier-agregats-purs.mjs — ne pas modifier ici.\n${corps}`;
}

for (const rel of FICHIERS) {
  const sortie = join(CIBLE, rel);
  mkdirSync(dirname(sortie), { recursive: true });
  writeFileSync(sortie, transformer(rel, readFileSync(join(SOURCE, rel), 'utf8')));
  console.log(`copié : ${rel}`);
}
