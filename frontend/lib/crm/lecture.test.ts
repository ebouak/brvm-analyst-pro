import { describe, expect, it } from 'vitest';
import { lireTout } from './lecture';

type Rep = { data: number[] | null; error: { message: string } | null };

describe('lireTout', () => {
  it('concatène les pages de 1000 et s’arrête sur une page courte', async () => {
    const pages: number[][] = [Array(1000).fill(1), Array(1000).fill(2), Array(5).fill(3)];
    let appels = 0;
    const r = await lireTout<number>(async () => ({ data: pages[appels++] ?? [], error: null } as Rep), 'x');
    expect(r).toHaveLength(2005);
    expect(appels).toBe(3);
  });

  it('transmet les bonnes bornes (from, to)', async () => {
    const bornes: Array<[number, number]> = [];
    await lireTout<number>(async (a, b) => {
      bornes.push([a, b]);
      return { data: bornes.length < 3 ? Array(1000).fill(0) : [], error: null } as Rep;
    }, 'x');
    expect(bornes).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('lève avec le libellé quand une page renvoie une erreur', async () => {
    await expect(
      lireTout<number>(async () => ({ data: null, error: { message: 'boom' } }) as Rep, 'paiements'),
    ).rejects.toThrow('CRM : lecture « paiements » impossible (boom)');
  });

  it('renvoie [] pour une table vide, sans erreur', async () => {
    expect(await lireTout<number>(async () => ({ data: [], error: null }) as Rep, 'x')).toEqual([]);
    expect(await lireTout<number>(async () => ({ data: null, error: null }) as Rep, 'x')).toEqual([]);
  });
});
