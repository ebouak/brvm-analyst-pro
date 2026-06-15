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

import { withMonitoring, type MonitoringClient } from '../src/monitoring/recordRun.js';

function fakeClient() {
  const calls: { runs: any[]; updates: any[]; errors: any[]; sources: any[] } = {
    runs: [], updates: [], errors: [], sources: [],
  };
  const client: MonitoringClient = {
    async resolveSourceId(source) {
      calls.sources.push(source);
      return 'src-1';
    },
    async insertRun(row) {
      calls.runs.push(row);
      return 'run-1';
    },
    async finalizeRun(runId, record) {
      calls.updates.push({ runId, record });
    },
    async insertError(runId, err) {
      calls.errors.push({ runId, err });
    },
    async markSourceSuccess(sourceId, at) {
      calls.sources.push({ markSuccess: sourceId, at });
    },
  };
  return { client, calls };
}

describe('withMonitoring', () => {
  it('enregistre un run réussi et renvoie le résultat du runner', async () => {
    const { client, calls } = fakeClient();
    const result = await withMonitoring(
      client,
      { code: 'intraday', label: 'Cours intraday' },
      'cron',
      async () => ({ value: 42, outcome: { rows_extracted: 47, rows_upserted: 47 } }),
    );
    expect(result).toEqual({ value: 42, outcome: { rows_extracted: 47, rows_upserted: 47 } });
    expect(calls.runs).toHaveLength(1);
    expect(calls.runs[0]).toMatchObject({ source_id: 'src-1', trigger_type: 'cron', status: 'running' });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].record.status).toBe('success');
    expect(calls.errors).toHaveLength(0);
  });

  it('journalise l\'erreur, finalise en failed, puis relance l\'erreur', async () => {
    const { client, calls } = fakeClient();
    const boom = new Error('réseau');
    await expect(
      withMonitoring(client, { code: 'daily', label: 'Daily' }, 'manual', async () => {
        throw boom;
      }),
    ).rejects.toThrow('réseau');
    expect(calls.updates[0].record.status).toBe('failed');
    expect(calls.errors).toHaveLength(1);
    expect(calls.errors[0].err).toBe(boom);
  });
});
