import { describe, it, expect } from 'vitest';
import { constatsComparaison, ecartALaMeilleure, fmtFcfa, meilleureLigne, type LigneComparee } from './comparaison';

const l = (o: Partial<LigneComparee> & { nom: string }): LigneComparee => ({
  total: 0, complet: true, homologue: true, depotMinimum: null, bourseEnLigne: false, ...o,
});

describe('comparaison de SGI', () => {
  const a = l({ nom: 'A', total: 19_000 });
  const b = l({ nom: 'B', total: 26_000, bourseEnLigne: true });
  const c = l({ nom: 'C', total: 9_000, complet: false });

  it('la moins chère est prise parmi les barèmes complets seulement', () => {
    expect(meilleureLigne([a, b, c])?.nom).toBe('A');
  });

  it('écart en FCFA et en % du coût de la moins chère', () => {
    const e = ecartALaMeilleure(b, a)!;
    expect(e.montant).toBe(7_000);
    expect(e.pct).toBeCloseTo(36.84, 1);
    expect(ecartALaMeilleure(a, a)).toBeNull();
    expect(ecartALaMeilleure(c, a)).toBeNull();
  });

  it('chaque constat porte son chiffre ; rien n’est affirmé sans donnée', () => {
    const k = constatsComparaison([a, b, c]);
    expect(k[0]).toBe(`A affiche le coût total le plus faible pour ce scénario : ${fmtFcfa(19_000)}.`);
    expect(k.some((x) => x.includes(fmtFcfa(7_000)))).toBe(true);
    expect(k.some((x) => x.startsWith('Barème incomplet pour C'))).toBe(true);
    expect(k.some((x) => x.includes('Bourse en ligne') && x.includes('B'))).toBe(true);
    expect(k.some((x) => x.includes('Dépôt minimum'))).toBe(false);
  });

  it('aucun barème complet : aucune « moins chère » annoncée', () => {
    expect(constatsComparaison([c]).some((x) => x.includes('le plus faible'))).toBe(false);
  });
});
