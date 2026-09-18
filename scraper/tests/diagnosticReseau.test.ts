import { describe, it, expect } from 'vitest';
import { decrireErreurReseau } from '../src/scrapers/diagnosticReseau.js';
import { pauseAvantSource, CRAWL_DELAY_MS } from '../src/scrapers/runAfricanIndices.js';

/** Reproduit la forme exacte des erreurs undici (`fetch failed` + cause). */
function fetchFailed(cause: unknown): Error {
  return Object.assign(new TypeError('fetch failed'), { cause });
}

describe('decrireErreurReseau', () => {
  it('fait remonter le code de la cause — ce que « fetch failed » masquait en CI', () => {
    const d = decrireErreurReseau(fetchFailed(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })));
    expect(d.code).toBe('ECONNRESET');
    expect(d.resume).toContain('fetch failed');
    expect(d.resume).toContain('cause=ECONNRESET');
  });

  it('détaille chaque adresse tentée quand la cause est agrégée (hôte à plusieurs IP)', () => {
    const agg = Object.assign(new Error('agrégée'), {
      code: 'ETIMEDOUT',
      errors: [
        { code: 'ETIMEDOUT', address: '23.95.122.3', port: 443 },
        { code: 'ECONNREFUSED', address: '78.109.16.133', port: 443 },
      ],
    });
    const d = decrireErreurReseau(fetchFailed(agg));
    expect(d.tentatives).toEqual(['23.95.122.3:443 ETIMEDOUT', '78.109.16.133:443 ECONNREFUSED']);
    expect(d.resume).toContain('tentatives=');
  });

  it('distingue un timeout applicatif (AbortSignal.timeout) d’une coupure réseau', () => {
    const e = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const d = decrireErreurReseau(e);
    expect(d.nom).toBe('TimeoutError');
    expect(d.code).toBeNull();
  });

  it('reste sûr sur une erreur sans cause ou une valeur qui n’est pas une Error', () => {
    expect(decrireErreurReseau(new Error('AFX HTTP 403 (x)')).resume).toBe('Error: AFX HTTP 403 (x)');
    expect(decrireErreurReseau('chaîne').nom).toBe('NonError');
  });

  it('tronque les messages longs', () => {
    const d = decrireErreurReseau(new Error('x'.repeat(500)));
    expect(d.resume.length).toBeLessThan(200);
  });
});

describe('pauseAvantSource — Crawl-delay: 60 du robots.txt', () => {
  it('aucune pause avant la première source, 60 s avant les suivantes', () => {
    expect(pauseAvantSource(0, false)).toBe(0);
    expect(pauseAvantSource(1, false)).toBe(CRAWL_DELAY_MS);
    expect(pauseAvantSource(2, false)).toBe(CRAWL_DELAY_MS);
    expect(CRAWL_DELAY_MS).toBe(60_000);
  });
  it('aucune pause en mode mock (fixtures locales, aucun appel au site)', () => {
    expect(pauseAvantSource(2, true)).toBe(0);
  });
});
