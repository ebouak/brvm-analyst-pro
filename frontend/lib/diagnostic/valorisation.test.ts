import { describe, it, expect } from 'vitest';
import { valoriser, blocValorisation } from './valorisation';
import type { LigneComparaison } from './medianes';

// Ordres de grandeur de SGBC 2025.
const inc = { resultat_net: 101_352e6, benefice_par_action: 3258, dividende_par_action: 2606 } as never;
const bal = { total_capitaux_propres: 495_113e6 } as never;
const ligne = (libelle: string, mediane: number): LigneComparaison =>
  ({ libelle, unite: 'x', valeur: null, mediane, nbPairs: 13, position: null, lecture: null });
const medianes = [ligne('PER', 15.4), ligne('Cours / valeur comptable', 3.2)];

describe('valorisation calculée', () => {
  it('banque : quatre méthodes, centrales conformes aux formules', () => {
    const v = valoriser({ famille: 'banque', cours: 39000, actions: 31_111_110, inc, bal, medianes });
    expect(v.methodes.map((m) => m.id)).toEqual(['pb_justifie', 'gordon', 'per_median', 'pb_median']);
    const bvps = 495_113e6 / 31_111_110;
    const roe = 101_352e6 / 495_113e6;
    const pbj = v.methodes[0]!;
    expect(pbj.centrale).toBeCloseTo(((roe - 0.035) / (0.13 - 0.035)) * bvps, 6);
    expect(pbj.bas).toBeLessThan(pbj.centrale);
    expect(pbj.haut).toBeGreaterThan(pbj.centrale);
    expect(v.methodes[1]!.centrale).toBeCloseTo((2606 * 1.035) / 0.095, 6);
    expect(v.methodes[2]!.centrale).toBeCloseTo(15.4 * 3258, 6);
    expect(v.methodes[3]!.centrale).toBeCloseTo(3.2 * bvps, 6);
  });

  it('société générale : pas de P/B justifié', () => {
    const v = valoriser({ famille: 'general', cours: 1000, actions: 31_111_110, inc, bal, medianes });
    expect(v.methodes.some((m) => m.id === 'pb_justifie')).toBe(false);
  });

  it('une entrée manquante retire la méthode, ne l’estime jamais', () => {
    const sansDiv = { resultat_net: 1e9, benefice_par_action: null, dividende_par_action: null } as never;
    const v = valoriser({ famille: 'banque', cours: 1000, actions: null, inc: sansDiv, bal, medianes: [] });
    expect(v.methodes).toEqual([]);
    expect(blocValorisation(v)).toMatch(/Aucune méthode calculable/);
  });

  it('ROE inférieur à g : la formule du P/B justifié ne s’applique pas', () => {
    const faible = { resultat_net: 1e9, benefice_par_action: 10, dividende_par_action: null } as never;
    const v = valoriser({ famille: 'banque', cours: 1000, actions: 1e6, inc: faible, bal: { total_capitaux_propres: 1e11 } as never });
    expect(v.methodes.some((m) => m.id === 'pb_justifie')).toBe(false);
  });

  it('le bloc du prompt donne formule, fourchette et écart au cours', () => {
    const b = blocValorisation(valoriser({ famille: 'banque', cours: 39000, actions: 31_111_110, inc, bal, medianes }));
    expect(b).toMatch(/Actualisation des dividendes : 28\s?39\d FCFA \(fourchette/);
    expect(b).toMatch(/écart de la valeur centrale au cours : /);
  });
});
