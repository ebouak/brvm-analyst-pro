import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Conformité de la page d'accueil (charte §9, lot B) : aucun mot de recommandation
 * dans le code de la vitrine. Échoue au premier mot interdit, avec le fichier.
 */
const RACINES = ['components/vitrine', 'lib/vitrine'];
const INTERDITS = /\b(acheter|vendre|achat|vente|opportunit[ée]s?|objectif de cours|recommandation|garanti|sans risque|BUY|SELL|HOLD)\b/i;

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(tsx?|css)$/.test(n) && !n.endsWith('.test.ts') ? [p] : [];
  });
}

describe('vitrine : mots interdits', () => {
  it('aucun mot de recommandation dans components/vitrine et lib/vitrine', () => {
    const trouves = RACINES.flatMap((r) => fichiers(path.join(process.cwd(), r)))
      .flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i, l })))
      .filter(({ l }) => INTERDITS.test(l))
      .map(({ f, i, l }) => `${path.relative(process.cwd(), f)}:${i + 1} ${l.trim()}`);
    expect(trouves).toEqual([]);
  });
});
