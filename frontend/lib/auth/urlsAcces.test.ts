import { describe, it, expect } from 'vitest';
import { cheminComplet, urlConnexion, urlPortePremium, urlFormules, fromSur } from './urlsAcces';

describe('urlConnexion', () => {
  it('garde chemin et query dans next, rien sur /login', () => {
    const u = urlConnexion('/dividendes/calendrier', '?annee=2025&code=SNTS');
    expect(u).toBe('/login?next=%2Fdividendes%2Fcalendrier%3Fannee%3D2025%26code%3DSNTS');
    const p = new URL(u, 'http://x');
    expect(p.searchParams.get('next')).toBe('/dividendes/calendrier?annee=2025&code=SNTS');
    expect(p.searchParams.get('annee')).toBeNull();
  });
  it('sans query', () => {
    expect(urlConnexion('/portefeuille', '')).toBe('/login?next=%2Fportefeuille');
    expect(cheminComplet('/a', '?')).toBe('/a');
  });
});

describe('from assaini', () => {
  it('porte premium garde la query', () => {
    expect(urlPortePremium('/premium/dcf', '?x=1')).toBe('/premium/upgrade?from=%2Fpremium%2Fdcf%3Fx%3D1');
  });
  it.each(['//evil.com', String.raw`/\evil`, 'https://evil.com', 'http://evil.com/x', '/\t/evil.com', 'javascript:alert(1)'])(
    'rejette %s',
    (v) => {
      expect(fromSur(v)).toBeNull();
      expect(urlFormules(v)).toBe('/account/plan');
    },
  );
  it('accepte un chemin interne', () => {
    expect(urlFormules('/premium/dcf')).toBe('/account/plan?from=%2Fpremium%2Fdcf');
    expect(fromSur('/premium/dcf?a=1')).toBe('/premium/dcf?a=1');
  });
});

import { fromDeRetour } from './urlsAcces';
describe('fromDeRetour', () => {
  it('relit et assainit', () => {
    expect(fromDeRetour('/account/plan?from=%2Fpremium%2Fdcf')).toBe('/premium/dcf');
    expect(fromDeRetour('/account/plan?from=%2F%2Fevil.com')).toBeNull();
    expect(fromDeRetour('/account/plan')).toBeNull();
  });
});

describe('assainissement : cas limites', () => {
  const cas = ['/' + String.fromCharCode(92) + 'evil', '/' + String.fromCharCode(10) + '/evil.com', '/' + String.fromCharCode(0) + 'x', 'evil.com', ''];
  it.each(cas)('fromSur rejette %j', (v) => {
    expect(fromSur(v)).toBeNull();
  });
});
