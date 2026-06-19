// frontend/lib/forum/rateLimit.test.ts
import { describe, it, expect } from 'vitest';
import { checkPostRate, checkTopicRate, MIN_POST_INTERVAL_MS, MAX_TOPICS_PER_HOUR } from './rateLimit';

const now = new Date('2026-06-18T12:00:00Z').getTime();

describe('checkPostRate', () => {
  it('autorise si aucun message récent', () => {
    expect(checkPostRate(null, now).ok).toBe(true);
  });
  it('bloque si le dernier message date de moins de 20 s', () => {
    const last = new Date(now - 5_000).toISOString();
    expect(checkPostRate(last, now).ok).toBe(false);
  });
  it('autorise après le délai minimal', () => {
    const last = new Date(now - (MIN_POST_INTERVAL_MS + 1)).toISOString();
    expect(checkPostRate(last, now).ok).toBe(true);
  });
});

describe('checkTopicRate', () => {
  it('autorise sous le plafond horaire', () => {
    const stamps = Array.from({ length: MAX_TOPICS_PER_HOUR - 1 }, () => new Date(now - 60_000).toISOString());
    expect(checkTopicRate(stamps, now).ok).toBe(true);
  });
  it('bloque au plafond horaire', () => {
    const stamps = Array.from({ length: MAX_TOPICS_PER_HOUR }, () => new Date(now - 60_000).toISOString());
    expect(checkTopicRate(stamps, now).ok).toBe(false);
  });
  it("ignore les sujets de plus d'une heure", () => {
    const stamps = Array.from({ length: MAX_TOPICS_PER_HOUR }, () => new Date(now - 3_700_000).toISOString());
    expect(checkTopicRate(stamps, now).ok).toBe(true);
  });
});
