import { describe, it, expect } from 'vitest';
import { analyserAllocation, simulerScenario } from './allocation';

const CINQ = [
  { nom: 'Banques', pct: 20 },
  { nom: 'Télécoms', pct: 20 },
  { nom: 'Agro-industrie', pct: 20 },
  { nom: 'Distribution', pct: 20 },
  { nom: 'Énergie', pct: 20 },
];

describe('simulation pédagogique — répartition par secteur', () => {
  it('1 000 000 FCFA à parts égales : 200 000 par secteur, aucune alerte', () => {
    const a = analyserAllocation(CINQ, 1_000_000);
    expect(a.lignes.map((l) => l.montant)).toEqual([200_000, 200_000, 200_000, 200_000, 200_000]);
    expect(a.totalPct).toBe(100);
    expect(a.alertes).toEqual([]);
  });

  it('un secteur au-dessus de 35 % déclenche une alerte ; 35 % pile n’en déclenche pas', () => {
    const a = analyserAllocation([{ nom: 'Banques', pct: 50 }, { nom: 'Télécoms', pct: 50 }], 1_000_000);
    expect(a.alertes.filter((x) => x.type === 'secteur_concentre')).toHaveLength(2);
    const pile = analyserAllocation([{ nom: 'A', pct: 35 }, { nom: 'B', pct: 65 }], 1_000_000);
    const concentre = pile.alertes.filter((x) => x.type === 'secteur_concentre');
    expect(concentre).toHaveLength(1);
    expect(concentre[0]!.message).toContain('B');
  });

  it('total différent de 100 % : alerte, reste à répartir signé', () => {
    const moins = analyserAllocation([{ nom: 'A', pct: 30 }, { nom: 'B', pct: 30 }], 1_000_000);
    expect(moins.resteAReparti).toBe(40);
    expect(moins.alertes.some((x) => x.type === 'total_inferieur')).toBe(true);
    const plus = analyserAllocation([{ nom: 'A', pct: 60 }, { nom: 'B', pct: 60 }], 1_000_000);
    expect(plus.resteAReparti).toBe(-20);
    expect(plus.alertes.some((x) => x.type === 'total_superieur')).toBe(true);
  });

  it('paramètres impossibles : erreur nette', () => {
    expect(() => analyserAllocation(CINQ, 0)).toThrow();
    expect(() => analyserAllocation([], 1000)).toThrow();
    expect(() => analyserAllocation([{ nom: 'A', pct: -1 }], 1000)).toThrow();
  });
});

describe('simulation pédagogique — scénarios de baisse', () => {
  const p = { capital: 1_000_000, rendement_pct: 8, lignes: CINQ };

  it('marché −10 % : capital 900 000, revenu inchangé à 80 000 (dividendes maintenus)', () => {
    const r = simulerScenario(p, { type: 'marche', baisse_pct: 10 });
    expect(r).toMatchObject({
      capitalAvant: 1_000_000, capitalApres: 900_000, revenuAvant: 80_000, revenuApres: 80_000,
      variationCapitalPct: -10, variationRevenuPct: 0,
    });
  });

  it('marché −20 % : capital 800 000', () => {
    expect(simulerScenario(p, { type: 'marche', baisse_pct: 20 }).capitalApres).toBe(800_000);
  });

  it('un secteur à 20 % baisse de 30 % : capital −6 %, revenu inchangé', () => {
    const r = simulerScenario(p, { type: 'secteur', nom: 'Banques', baisse_pct: 30 });
    expect(r.capitalApres).toBe(940_000);
    expect(r.variationCapitalPct).toBe(-6);
    expect(r.revenuApres).toBe(80_000);
  });

  it('un dividende divisé par deux sur une ligne de 20 % : revenu 72 000, −10 % (tableau de la leçon)', () => {
    const r = simulerScenario(p, { type: 'dividende', nom: 'Télécoms', facteur: 0.5 });
    expect(r).toMatchObject({ capitalApres: 1_000_000, revenuAvant: 80_000, revenuApres: 72_000, variationRevenuPct: -10 });
  });

  it('tout sur une seule valeur : revenu −50 % (tableau de la leçon)', () => {
    const r = simulerScenario({ ...p, lignes: [{ nom: 'Seule', pct: 100 }] }, { type: 'dividende', nom: 'Seule', facteur: 0.5 });
    expect(r.revenuApres).toBe(40_000);
    expect(r.variationRevenuPct).toBe(-50);
  });

  it('répartition ≠ 100 %, ligne inconnue, baisse impossible : erreur', () => {
    expect(() => simulerScenario({ ...p, lignes: [{ nom: 'A', pct: 50 }] }, { type: 'marche', baisse_pct: 10 })).toThrow();
    expect(() => simulerScenario(p, { type: 'secteur', nom: 'Inconnu', baisse_pct: 30 })).toThrow();
    expect(() => simulerScenario(p, { type: 'marche', baisse_pct: 150 })).toThrow();
  });

  it('chaque résultat porte ses hypothèses', () => {
    expect(simulerScenario(p, { type: 'marche', baisse_pct: 10 }).hypotheses.length).toBeGreaterThanOrEqual(2);
  });
});
