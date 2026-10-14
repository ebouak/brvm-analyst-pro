import { describe, it, expect } from 'vitest';
import { toutesLesPages } from './pagination';

const source = Array.from({ length: 2350 }, (_, k) => k);
const page = async (de: number, a: number) => ({ data: source.slice(de, a + 1), error: null });

describe('toutesLesPages', () => {
  it('lit toutes les pages de 1000', async () => {
    expect(await toutesLesPages(page)).toHaveLength(2350);
  });
  it('une erreur arrête la lecture et remonte', async () => {
    let n = 0;
    const casse = async (de: number, a: number) => (++n === 2 ? { data: null, error: { message: 'boom' } } : page(de, a));
    await expect(toutesLesPages(casse)).rejects.toThrow('boom');
  });
  it('plafond de pages : refuse de tronquer en silence', async () => {
    await expect(toutesLesPages(page, 2)).rejects.toThrow(/plafond/);
  });
});
