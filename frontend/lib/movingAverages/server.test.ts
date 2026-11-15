import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSectorBreadth, paginateSectorRows } from './server';

const { createPublicClientMock } = vi.hoisted(() => ({
  createPublicClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: createPublicClientMock,
}));
vi.mock('server-only', () => ({}));

function queryFor(result: { data: unknown[] | null; error: { message: string } | null }) {
  const query = {
    select: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  for (const method of [query.select, query.in, query.gte, query.lte, query.not, query.order]) {
    method.mockImplementation(() => query);
  }
  query.range.mockResolvedValue(result);
  return query;
}

describe('paginateSectorRows', () => {
  it('reads every page in order and advances by the page size', async () => {
    const offsets: number[] = [];
    const rows = await paginateSectorRows(async (offset, pageSize) => {
      offsets.push(offset);
      if (offset === 0) return [{ code: 'A', date_marche: '2025-01-01', cours_jour: 1 }, { code: 'A', date_marche: '2025-01-02', cours_jour: 2 }];
      if (offset === 2) return [{ code: 'B', date_marche: '2025-01-02', cours_jour: 3 }, { code: 'B', date_marche: '2025-01-03', cours_jour: 4 }];
      return [{ code: 'C', date_marche: '2025-01-03', cours_jour: 5 }];
    }, 2);

    expect(offsets).toEqual([0, 2, 4]);
    expect(rows.map((row) => row.cours_jour)).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects instead of returning partial data when a page fails', async () => {
    const error = new Error('market rows unavailable');

    await expect(paginateSectorRows(async () => { throw error; }, 2)).rejects.toBe(error);
  });
});

describe('loadSectorBreadth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns explicit insufficient data without querying when the sector is unknown', async () => {
    const result = await loadSectorBreadth(null, '2026-11-13');

    expect(result).toEqual({ status: 'insufficient', reading: null });
    expect(createPublicClientMock).not.toHaveBeenCalled();
  });

  it('queries same-sector equity closes inside the 400-day bound', async () => {
    const asOfDate = '2026-03-01';
    const dates = Array.from({ length: 50 }, (_, index) =>
      new Date(Date.parse(`${asOfDate}T00:00:00Z`) - (49 - index) * 86_400_000).toISOString().slice(0, 10),
    );
    const rows = ['ONTBF', 'ORAC', 'SNTS'].flatMap((code) =>
      dates.map((date_marche, index) => ({
        code,
        date_marche,
        cours_jour: code === 'ONTBF' ? 100 + index : code === 'ORAC' ? 100 : index === 49 ? 101 : 100,
      })),
    );
    const query = queryFor({ data: rows, error: null });
    createPublicClientMock.mockReturnValue({ from: vi.fn(() => query) });

    const result = await loadSectorBreadth('Télécommunications', asOfDate);

    expect(result.status).toBe('available');
    expect(result.reading?.sma50Above.above).toBe(2);
    expect(result.reading?.sma50Above.total).toBe(3);
    expect(result.reading?.sma50Above.percent).toBeCloseTo(200 / 3, 10);
    expect(query.in).toHaveBeenCalledWith('code', expect.arrayContaining(['ONTBF', 'ORAC', 'SNTS']));
    expect(query.gte).toHaveBeenCalledWith('date_marche', '2025-01-26');
    expect(query.lte).toHaveBeenCalledWith('date_marche', asOfDate);
    expect(query.range).toHaveBeenCalledWith(0, 999);
  });

  it('surfaces Supabase errors instead of treating them as empty sector data', async () => {
    const query = queryFor({ data: null, error: { message: 'permission denied' } });
    createPublicClientMock.mockReturnValue({ from: vi.fn(() => query) });

    await expect(loadSectorBreadth('Télécommunications', '2026-11-13')).rejects.toThrow('permission denied');
  });
});
