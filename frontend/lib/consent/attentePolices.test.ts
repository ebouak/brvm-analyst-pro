import { describe, expect, it, vi } from 'vitest';
import { quandPolicesPretes, type EnsemblePolices } from './attentePolices';

function minuteurFactice() {
  const taches = new Map<number, () => void>();
  let n = 0;
  return {
    taches,
    lancer: (fn: () => void) => {
      n += 1;
      taches.set(n, fn);
      return n;
    },
    annuler: (id: unknown) => {
      taches.delete(id as number);
    },
    expirer: () => {
      for (const fn of [...taches.values()]) fn();
      taches.clear();
    },
  };
}

function enChargement() {
  let resoudre!: () => void;
  const ready = new Promise<void>((r) => (resoudre = r));
  const polices: EnsemblePolices = { status: 'loading', ready };
  return { polices, resoudre };
}

const vider = () => new Promise((r) => setTimeout(r, 0));

describe('quandPolicesPretes', () => {
  it('signale tout de suite quand les polices sont déjà chargées', () => {
    const pret = vi.fn();
    quandPolicesPretes({ status: 'loaded', ready: Promise.resolve() }, pret);
    expect(pret).toHaveBeenCalledTimes(1);
  });

  it("signale tout de suite quand l'API des polices manque", () => {
    const pret = vi.fn();
    quandPolicesPretes(undefined, pret);
    expect(pret).toHaveBeenCalledTimes(1);
  });

  it("attend la fin du chargement, une seule fois, et annule le plafond", async () => {
    const m = minuteurFactice();
    const { polices, resoudre } = enChargement();
    const pret = vi.fn();
    quandPolicesPretes(polices, pret, 3000, m);
    await vider();
    expect(pret).not.toHaveBeenCalled();
    resoudre();
    await vider();
    expect(pret).toHaveBeenCalledTimes(1);
    expect(m.taches.size).toBe(0);
  });

  it('paraît au plafond si une police ne vient jamais', async () => {
    const m = minuteurFactice();
    const { polices, resoudre } = enChargement();
    const pret = vi.fn();
    quandPolicesPretes(polices, pret, 3000, m);
    m.expirer();
    expect(pret).toHaveBeenCalledTimes(1);
    resoudre();
    await vider();
    expect(pret).toHaveBeenCalledTimes(1);
  });

  it("ne signale plus rien après annulation (démontage)", async () => {
    const m = minuteurFactice();
    const { polices, resoudre } = enChargement();
    const pret = vi.fn();
    const annuler = quandPolicesPretes(polices, pret, 3000, m);
    annuler();
    resoudre();
    await vider();
    m.expirer();
    expect(pret).not.toHaveBeenCalled();
  });
});
