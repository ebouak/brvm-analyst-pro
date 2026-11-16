import { describe, expect, it, vi } from 'vitest';
import { demarrer } from './demarrer';

describe('demarrer', () => {
  it('déclenche un thenable paresseux sans attendre', () => {
    const then = vi.fn((ok: (v: number) => void) => ok(1));
    demarrer({ then } as unknown as PromiseLike<number>);
    // Promise.resolve appelle `then` dans une microtâche : on la laisse passer.
    return Promise.resolve().then(() => expect(then).toHaveBeenCalledTimes(1));
  });

  it("rend le résultat à l'await", async () => {
    await expect(demarrer(Promise.resolve(42))).resolves.toBe(42);
  });

  it("transmet l'erreur intacte à l'await, même si elle survient avant", async () => {
    const erreur = new Error('panne');
    const p = demarrer(Promise.reject(erreur));
    await new Promise((r) => setTimeout(r, 5)); // le rejet a eu lieu
    await expect(p).rejects.toBe(erreur);
  });

  it('chevauche deux attentes au lieu de les additionner', async () => {
    const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const t0 = Date.now();
    const a = demarrer(attendre(60));
    const b = demarrer(attendre(60));
    await a;
    await b;
    expect(Date.now() - t0).toBeLessThan(110);
  });
});
