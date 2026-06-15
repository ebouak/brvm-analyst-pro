import { describe, it, expect } from 'vitest';
import {
  defaultDenied,
  acceptAll,
  serialize,
  parse,
  has,
} from './state';
import { CONSENT_VERSION } from './registry';

describe('consent state', () => {
  it('defaultDenied garde essential ON et le reste OFF', () => {
    const c = defaultDenied();
    expect(c.granted.essential).toBe(true);
    expect(c.granted.analytics).toBe(false);
    expect(c.granted.marketing).toBe(false);
    expect(c.version).toBe(CONSENT_VERSION);
  });

  it('acceptAll active toutes les catégories', () => {
    const c = acceptAll();
    expect(c.granted.analytics).toBe(true);
    expect(c.granted.marketing).toBe(true);
  });

  it('serialize puis parse redonne le même choix', () => {
    const c = acceptAll();
    expect(parse(serialize(c))).toEqual(c);
  });

  it('parse renvoie null si version périmée', () => {
    const stale = JSON.stringify({ version: 0, timestamp: 'x', granted: {} });
    expect(parse(stale)).toBeNull();
  });

  it('parse renvoie null sur entrée invalide', () => {
    expect(parse(null)).toBeNull();
    expect(parse('pas du json')).toBeNull();
  });

  it('has renvoie false quand choice est null, true pour essential', () => {
    expect(has(null, 'analytics')).toBe(false);
    expect(has(defaultDenied(), 'essential')).toBe(true);
    expect(has(defaultDenied(), 'analytics')).toBe(false);
    expect(has(acceptAll(), 'analytics')).toBe(true);
  });
});
