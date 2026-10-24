import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { signerRecap, verifierRecap } from './signature';

const SECRET = 'x'.repeat(40);
const U = '11111111-2222-3333-4444-555555555555';
const T = 1_800_000_000;

const lien = async (s?: { u: string; exp: number; sig: string }) => {
  const x = s ?? (await signerRecap(U, SECRET, T));
  return { u: x.u, exp: String(x.exp), sig: x.sig };
};

describe('lien signé de la récap', () => {
  it('lien valide → identifiant de l’utilisateur', async () => {
    expect(await verifierRecap(await lien(), SECRET, T + 10)).toBe(U);
  });
  it('même signature que les copies node:crypto du scraper et du worker vidéo', async () => {
    const s = await signerRecap(U, SECRET, T);
    expect(s.sig).toBe(createHmac('sha256', SECRET).update(`${U}.${T + 300}`).digest('hex'));
  });
  it('expiré → refusé', async () => {
    expect(await verifierRecap(await lien(), SECRET, T + 301)).toBeNull();
  });
  it('durée demandée au-delà du plafond : bornée à 10 minutes', async () => {
    expect((await signerRecap(U, SECRET, T, 99_999)).exp).toBe(T + 600);
  });
  it('signature d’un autre utilisateur ou d’une autre échéance → refusé', async () => {
    const l = await lien();
    expect(await verifierRecap({ ...l, u: '99999999-2222-3333-4444-555555555555' }, SECRET, T)).toBeNull();
    expect(await verifierRecap({ ...l, exp: String(T + 200) }, SECRET, T)).toBeNull();
  });
  it('mauvais secret, secret absent ou trop court → voie fermée', async () => {
    expect(await verifierRecap(await lien(), 'y'.repeat(40), T)).toBeNull();
    expect(await verifierRecap(await lien(), undefined, T)).toBeNull();
    expect(await verifierRecap(await lien(await signerRecap(U, 'court', T)), 'court', T)).toBeNull();
  });
  it('paramètres manquants ou malformés → refusé', async () => {
    expect(await verifierRecap({ u: U, exp: null, sig: null }, SECRET, T)).toBeNull();
    expect(await verifierRecap({ ...(await lien()), sig: 'zz' }, SECRET, T)).toBeNull();
  });
});
