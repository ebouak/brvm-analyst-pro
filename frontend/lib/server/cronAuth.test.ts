import { describe, expect, it } from 'vitest';
import { cronAutorise } from './cronAuth';

const S = 'x'.repeat(40);
const req = (h: Record<string, string>, url = 'https://s.test/api/cron/x') => ({
  url,
  headers: { get: (n: string) => h[n.toLowerCase()] ?? null },
});

describe('cronAutorise', () => {
  it('bon secret en Bearer : oui', () => expect(cronAutorise(req({ authorization: `Bearer ${S}` }), S)).toBe(true));
  it('mauvais secret de même longueur : non', () =>
    expect(cronAutorise(req({ authorization: `Bearer ${'y'.repeat(40)}` }), S)).toBe(false));
  it('mauvais secret de longueur différente : non', () =>
    expect(cronAutorise(req({ authorization: `Bearer ${S}z` }), S)).toBe(false));
  it('secret configuré trop court : non, même s’il correspond', () =>
    expect(cronAutorise(req({ authorization: 'Bearer court' }), 'court')).toBe(false));
  it('secret configuré absent : non', () => {
    expect(cronAutorise(req({ authorization: 'Bearer x' }), undefined)).toBe(false);
    expect(cronAutorise(req({ authorization: 'Bearer ' }), '')).toBe(false);
  });
  it('en-tête absent ou sans Bearer : non', () => {
    expect(cronAutorise(req({}), S)).toBe(false);
    expect(cronAutorise(req({ authorization: S }), S)).toBe(false);
  });
  it('secret en query string : ignoré', () =>
    expect(cronAutorise(req({}, `https://s.test/api/cron/x?secret=${S}`), S)).toBe(false));
  it('en-tête x-cron-secret : ignoré', () =>
    expect(cronAutorise(req({ 'x-cron-secret': S }), S)).toBe(false));
});
