import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const racine = path.resolve(__dirname, '../../..');
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8');

describe('lecture bancaire : une seule source', () => {
  it('la copie du scraper est identique octet pour octet', () => {
    expect(lire('scraper/src/bank/pure/lecture.ts')).toBe(lire('frontend/lib/bank/lecture.ts'));
  });
});
