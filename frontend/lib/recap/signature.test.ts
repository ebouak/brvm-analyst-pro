import { describe, it, expect } from 'vitest';
import { signerRecap, verifierRecap } from './signature';

const SECRET = 'x'.repeat(40);
const U = '11111111-2222-3333-4444-555555555555';
const T = 1_800_000_000;

const lien = (s = signerRecap(U, SECRET, T)) => ({ u: s.u, exp: String(s.exp), sig: s.sig });

describe('lien signé de la récap', () => {
  it('lien valide → identifiant de l’utilisateur', () => {
    expect(verifierRecap(lien(), SECRET, T + 10)).toBe(U);
  });
  it('expiré → refusé', () => {
    expect(verifierRecap(lien(), SECRET, T + 301)).toBeNull();
  });
  it('durée demandée au-delà du plafond : bornée à 10 minutes', () => {
    const s = signerRecap(U, SECRET, T, 99_999);
    expect(s.exp).toBe(T + 600);
  });
  it('signature d’un autre utilisateur ou d’une autre échéance → refusé', () => {
    const l = lien();
    expect(verifierRecap({ ...l, u: '99999999-2222-3333-4444-555555555555' }, SECRET, T)).toBeNull();
    expect(verifierRecap({ ...l, exp: String(T + 200) }, SECRET, T)).toBeNull();
  });
  it('mauvais secret, secret absent ou trop court → voie fermée', () => {
    expect(verifierRecap(lien(), 'y'.repeat(40), T)).toBeNull();
    expect(verifierRecap(lien(), undefined, T)).toBeNull();
    expect(verifierRecap(lien(signerRecap(U, 'court', T)), 'court', T)).toBeNull();
  });
  it('paramètres manquants ou malformés → refusé', () => {
    expect(verifierRecap({ u: U, exp: null, sig: null }, SECRET, T)).toBeNull();
    expect(verifierRecap({ ...lien(), sig: 'zz' }, SECRET, T)).toBeNull();
  });
});
