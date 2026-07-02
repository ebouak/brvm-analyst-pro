import { describe, it, expect } from 'vitest';
import { getClientIp } from './clientIp';

function mkReq(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/test', { headers });
}

describe('getClientIp', () => {
  it('prend le premier IP de x-forwarded-for (client d\'origine)', () => {
    expect(getClientIp(mkReq({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('retombe sur x-real-ip si x-forwarded-for absent', () => {
    expect(getClientIp(mkReq({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
  });

  it('retourne "unknown" si aucun en-tête présent', () => {
    expect(getClientIp(mkReq({}))).toBe('unknown');
  });

  it('retire les espaces autour de l\'IP', () => {
    expect(getClientIp(mkReq({ 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' }))).toBe('1.2.3.4');
  });
});
