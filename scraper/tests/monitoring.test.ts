import { describe, it, expect } from 'vitest';
import { buildRunRecord } from '../src/monitoring/recordRun.js';

describe('buildRunRecord', () => {
  it('calcule un run réussi avec durée et lignes', () => {
    const rec = buildRunRecord({
      startedAtMs: 1000,
      finishedAtMs: 3500,
      outcome: { status: 'success', rows_extracted: 47, rows_upserted: 47, metadata: { date: '2026-06-16' } },
    });
    expect(rec.status).toBe('success');
    expect(rec.duration_ms).toBe(2500);
    expect(rec.rows_extracted).toBe(47);
    expect(rec.rows_upserted).toBe(47);
    expect(rec.error_count).toBe(0);
    expect(rec.metadata).toEqual({ date: '2026-06-16' });
  });

  it('déduit le statut failed et error_count=1 quand une erreur est fournie', () => {
    const rec = buildRunRecord({
      startedAtMs: 0,
      finishedAtMs: 1200,
      error: new Error('boom'),
    });
    expect(rec.status).toBe('failed');
    expect(rec.error_count).toBe(1);
    expect(rec.rows_extracted).toBe(0);
    expect(rec.rows_upserted).toBe(0);
    expect(rec.duration_ms).toBe(1200);
    expect(rec.metadata).toEqual({});
  });

  it('respecte un statut partiel renvoyé par le runner', () => {
    const rec = buildRunRecord({
      startedAtMs: 0,
      finishedAtMs: 500,
      outcome: { status: 'partial', rows_extracted: 10, rows_upserted: 4 },
    });
    expect(rec.status).toBe('partial');
    expect(rec.error_count).toBe(0);
  });
});
