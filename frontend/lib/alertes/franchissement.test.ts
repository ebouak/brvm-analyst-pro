import { describe, it, expect } from 'vitest';
import { conditionRemplie, etatInitial, franchissements, messageAlerte, type AlertePrix } from './franchissement';

const dessus: AlertePrix = { id: 'a1', code: 'SNTS', type: 'prix_au_dessus', seuil: 26000 };
const dessous: AlertePrix = { id: 'a2', code: 'SNTS', type: 'prix_en_dessous', seuil: 25000 };
const variation: AlertePrix = { id: 'a3', code: 'ORAC', type: 'variation', seuil: 5 };

describe('conditionRemplie (mêmes règles que scraper/src/alerts/evaluate.ts)', () => {
  it('au-dessus : cours >= seuil', () => {
    expect(conditionRemplie(dessus, 26000, null)).toBe(true);
    expect(conditionRemplie(dessus, 25950, null)).toBe(false);
    expect(conditionRemplie(dessus, null, null)).toBe(false);
  });
  it('en dessous : cours <= seuil', () => {
    expect(conditionRemplie(dessous, 25000, null)).toBe(true);
    expect(conditionRemplie(dessous, 25050, null)).toBe(false);
  });
  it('variation : |var| >= seuil, dans les deux sens', () => {
    expect(conditionRemplie(variation, null, -5.2)).toBe(true);
    expect(conditionRemplie(variation, null, 4.9)).toBe(false);
  });
});

describe('franchissements', () => {
  it('signale le passage de faux à vrai, une seule fois', () => {
    const etat0 = etatInitial([dessus], [{ code: 'SNTS', cours_jour: 25900, variation_pct: 1 }]);
    const r1 = franchissements([dessus], etat0, { code: 'SNTS', cours_jour: 26050, variation_pct: 2 });
    expect(r1.declenchees).toEqual([dessus]);
    const r2 = franchissements([dessus], r1.etat, { code: 'SNTS', cours_jour: 26100, variation_pct: 2.2 });
    expect(r2.declenchees).toEqual([]);
  });

  it("ne signale rien si la condition était déjà vraie à l'arrivée", () => {
    const etat0 = etatInitial([dessus], [{ code: 'SNTS', cours_jour: 26200, variation_pct: 3 }]);
    expect(franchissements([dessus], etat0, { code: 'SNTS', cours_jour: 26300, variation_pct: 3.5 }).declenchees).toEqual([]);
  });

  it('se réarme quand la condition redevient fausse', () => {
    const r1 = franchissements([dessus], { a1: true }, { code: 'SNTS', cours_jour: 25900, variation_pct: 1 });
    expect(r1.etat.a1).toBe(false);
    expect(franchissements([dessus], r1.etat, { code: 'SNTS', cours_jour: 26000, variation_pct: 2 }).declenchees).toEqual([dessus]);
  });

  it("ignore les cours d'une autre valeur", () => {
    expect(franchissements([dessus], { a1: false }, { code: 'ORAC', cours_jour: 99999, variation_pct: 9 }).declenchees).toEqual([]);
  });
});

describe('messageAlerte', () => {
  it('dit le fait et le seuil, sans conseil', () => {
    expect(messageAlerte(dessus, { code: 'SNTS', cours_jour: 26050, variation_pct: 2 })).toMatch(/^SNTS est passé au-dessus de 26\s000 FCFA$/);
    expect(messageAlerte(dessous, { code: 'SNTS', cours_jour: 24950, variation_pct: -2 })).toMatch(/^SNTS est passé sous 25\s000 FCFA$/);
    expect(messageAlerte(variation, { code: 'ORAC', cours_jour: 14000, variation_pct: -5.2 })).toContain('ORAC varie de');
  });
});
