import { describe, it, expect } from 'vitest';
import { metriquesDepuisSeance, estSeanceClose } from './metriquesSeance';
import type { ActionDaily, IndiceDaily } from '@/lib/types';

const a = (code: string, variation_pct: number | null, valeur_echangee: number | null = null, designation: string | null = null): ActionDaily => ({
  code, date_marche: '2026-10-13', designation, pays: null, secteur: null, cours_precedent: null,
  cours_jour: 1000, variation_pct, volume: null, nb_transactions: null, valeur_echangee,
});
const i = (code: string, libelle: string, valeur: number | null, variation_pct: number | null): IndiceDaily => ({
  code, date_marche: '2026-10-13', libelle, valeur, valeur_precedente: null, variation_pct,
});

const indices = [
  i('BRVMC', 'BRVM COMPOSITE', 545.46, -0.28),
  i('BRVMENER', 'BRVM - Énergie', 1200, 2.22),
  i('BRVMINDU', 'BRVM - Industriels', 900, 0.48),
  i('BRVM30', 'BRVM-30', 263, 3.5), // pas sectoriel : ignoré pour le secteur meneur
];

describe('metriquesDepuisSeance', () => {
  it('largeur comptée sur les variations CONNUES seulement', () => {
    const m = metriquesDepuisSeance({
      dateMarche: '2026-10-13', indices, valeurTransactions: 3e9, valeurTransactionsVeille: 2.5e9,
      actions: [a('SNTS', 1), a('ORAC', -2), a('SGBC', 0), a('XXXX', null)],
    });
    expect([m.hausses, m.baisses, m.stables]).toEqual([1, 1, 1]);
  });

  it('aucune variation connue : largeur nulle, jamais 0/0/0', () => {
    const m = metriquesDepuisSeance({ dateMarche: '2026-10-13', indices, valeurTransactions: null, valeurTransactionsVeille: null, actions: [a('X', null)] });
    expect([m.hausses, m.baisses, m.stables]).toEqual([null, null, null]);
  });

  it('composite et secteur meneur lus dans les indices sectoriels', () => {
    const m = metriquesDepuisSeance({ dateMarche: '2026-10-13', indices, valeurTransactions: null, valeurTransactionsVeille: null, actions: [] });
    expect(m.composite).toEqual({ valeur: 545.46, variationPct: -0.28 });
    expect(m.secteurMeneur).toEqual({ nom: 'Énergie', variationPct: 2.22 });
  });

  it('indices d une autre séance ignorés', () => {
    const m = metriquesDepuisSeance({
      dateMarche: '2026-10-14', indices, valeurTransactions: null, valeurTransactionsVeille: null, actions: [],
    });
    expect(m.composite).toBeNull();
    expect(m.secteurMeneur).toBeNull();
  });

  it('valeur la plus échangée : seulement si la valeur échangée est connue', () => {
    const m = metriquesDepuisSeance({
      dateMarche: '2026-10-13', indices, valeurTransactions: 3e9, valeurTransactionsVeille: null,
      actions: [a('SNTS', 1, 9e8, 'SONATEL SN'), a('ORAC', 1, 2e8, null), a('X', 1, null)],
    });
    expect(m.plusEchangee).toEqual({ code: 'SNTS', nom: 'SONATEL SN', valeur: 9e8 });
    expect(m.valeurEchangee).toBe(3e9);
    expect(m.valeurEchangeeVeille).toBeNull();
    const vide = metriquesDepuisSeance({ dateMarche: '2026-10-13', indices, valeurTransactions: null, valeurTransactionsVeille: null, actions: [a('X', 1, null)] });
    expect(vide.plusEchangee).toBeNull();
  });
});

describe('estSeanceClose', () => {
  it('séance passée : close ; future : non', () => {
    expect(estSeanceClose('2026-10-12', new Date('2026-10-13T08:00:00Z'))).toBe(true);
    expect(estSeanceClose('2026-10-14', new Date('2026-10-13T20:00:00Z'))).toBe(false);
  });
  it('jour même : close à partir de 15 h 30 UTC (Abidjan)', () => {
    expect(estSeanceClose('2026-10-13', new Date('2026-10-13T15:29:00Z'))).toBe(false);
    expect(estSeanceClose('2026-10-13', new Date('2026-10-13T15:30:00Z'))).toBe(true);
  });
});
