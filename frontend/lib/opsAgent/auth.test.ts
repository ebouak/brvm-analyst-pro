import { describe, it, expect } from 'vitest';
import {
  estAdminTelegram,
  parseAdminChatIds,
  parserCallbackOps,
  parserCommandeOps,
  verifierSecretOps,
} from './auth';

describe('opsAgent auth & parser', () => {
  it('vérifie le secret webhook à temps constant (fail-closed si vide)', () => {
    expect(verifierSecretOps(null, 'secret-test')).toBe(false);
    expect(verifierSecretOps('secret-test', undefined)).toBe(false);
    expect(verifierSecretOps('secret-test', '')).toBe(false);
    expect(verifierSecretOps('mauvais', 'secret-test')).toBe(false);
    expect(verifierSecretOps('secret-test', 'secret-test')).toBe(true);
  });

  it('construit la liste blanche et refuse une liste vide', () => {
    const empty = parseAdminChatIds('', '', []);
    expect(empty.size).toBe(0);
    expect(estAdminTelegram(12345, empty)).toBe(false);

    const allowed = parseAdminChatIds('11111, 22222 invalid -5', '99999', [33333]);
    expect(allowed.has(11111)).toBe(true);
    expect(allowed.has(22222)).toBe(true);
    expect(allowed.has(33333)).toBe(true);
    expect(allowed.has(99999)).toBe(false); // envOps prioritaire sur envFallback
    expect(estAdminTelegram(11111, allowed)).toBe(true);
    expect(estAdminTelegram(44444, allowed)).toBe(false);
  });

  it('parse les commandes slash, suffixes @BotName et texte libre', () => {
    expect(parserCommandeOps('/tour@WestbourseOpsBot')).toEqual({ type: 'tour' });
    expect(parserCommandeOps('/relancer daily-brvm')).toEqual({
      type: 'relancer',
      cible: 'daily-brvm',
    });
    expect(parserCommandeOps('/ferie 2026-12-07 Fête nationale')).toEqual({
      type: 'ferie',
      date: '2026-12-07',
      motif: 'Fête nationale',
    });
    expect(parserCommandeOps('/audit SNTS')).toEqual({ type: 'audit', code: 'SNTS' });
    expect(parserCommandeOps('Pourquoi la tour est rouge ?')).toEqual({
      type: 'libre',
      texte: 'Pourquoi la tour est rouge ?',
    });
  });

  it('parse les callback_data structurés', () => {
    expect(parserCallbackOps('wf:daily-brvm')).toEqual({ kind: 'wf', alias: 'daily-brvm' });
    expect(parserCallbackOps('cfm:abc-123')).toEqual({ kind: 'cfm', runId: 'abc-123' });
    expect(parserCallbackOps('inc_ack:inc-1')).toEqual({ kind: 'inc_ack', id: 'inc-1' });
    expect(parserCallbackOps('bad')).toEqual({ kind: 'unknown', raw: 'bad' });
  });
});
