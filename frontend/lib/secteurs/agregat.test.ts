import { describe, expect, it } from 'vitest';
import { agregerParSecteur, mediane, medianeMarche, type LigneSociete } from './agregat';

const L = (o: Partial<LigneSociete> & { code: string }): LigneSociete => ({
  nom: null, secteur: 'Services financiers', cours: 1000, per: null, pbr: null,
  rendement: null, capitalisation: null, variation: null, ...o,
});

describe('mediane', () => {
  it('impair : la valeur centrale', () => expect(mediane([3, 1, 2])).toBe(2));
  it('pair : la moyenne des deux centrales', () => expect(mediane([1, 2, 3, 4])).toBe(2.5));
  it('liste vide : null, jamais 0', () => expect(mediane([])).toBeNull());
});

describe('agregerParSecteur', () => {
  it('écarte les ratios inexploitables et les COMPTE au lieu de les cacher', () => {
    const [s] = agregerParSecteur([
      L({ code: 'A', per: 8 }),
      L({ code: 'B', per: 12 }),
      L({ code: 'C', per: -4 }),     // société en perte : un PER négatif ne compare rien
      L({ code: 'D', per: 180 }),    // bénéfice quasi nul : hors bornes de crédibilité
      L({ code: 'E', per: null }),   // fondamentaux absents
    ]);
    expect(s.perMedian).toBe(10);
    expect(s.perRetenus).toBe(2);
    expect(s.perEcartes).toBe(3);
    expect(s.societes).toBe(5);
  });

  it('la médiane résiste à une valeur extrême là où la moyenne dérape', () => {
    const lignes = [L({ code: 'A', per: 5 }), L({ code: 'B', per: 6 }), L({ code: 'C', per: 7 }), L({ code: 'D', per: 99 })];
    const [s] = agregerParSecteur(lignes);
    const moyenne = (5 + 6 + 7 + 99) / 4;
    expect(s.perMedian).toBe(6.5);
    expect(moyenne).toBeGreaterThan(25);
  });

  it('désigne la moins chère et la plus chère, mais pas sur une seule valeur', () => {
    const [deux] = agregerParSecteur([L({ code: 'A', per: 5 }), L({ code: 'B', per: 20 })]);
    expect(deux.moinsChere).toEqual({ code: 'A', per: 5 });
    expect(deux.plusChere).toEqual({ code: 'B', per: 20 });
    const [une] = agregerParSecteur([L({ code: 'A', per: 5 })]);
    expect(une.moinsChere).toBeNull();
    expect(une.plusChere).toBeNull();
  });

  it('ignore les sociétés sans secteur plutôt que de les ranger au hasard', () => {
    const res = agregerParSecteur([L({ code: 'A', per: 5 }), L({ code: 'B', secteur: null, per: 5 }), L({ code: 'C', secteur: '  ', per: 5 })]);
    expect(res).toHaveLength(1);
    expect(res[0].societes).toBe(1);
  });

  it('trie les secteurs par capitalisation, ceux sans capitalisation en dernier', () => {
    const res = agregerParSecteur([
      L({ code: 'A', secteur: 'Energie', capitalisation: 100 }),
      L({ code: 'B', secteur: 'Télécommunications', capitalisation: 900 }),
      L({ code: 'C', secteur: 'Industriels' }),
    ]);
    expect(res.map((r) => r.secteur)).toEqual(['Télécommunications', 'Energie', 'Industriels']);
  });

  it('capitalisation nulle quand aucune société n’en déclare — pas zéro', () => {
    const [s] = agregerParSecteur([L({ code: 'A' })]);
    expect(s.capitalisation).toBeNull();
  });
});

describe('medianeMarche', () => {
  it('pèse les sociétés, pas les secteurs', () => {
    // Un secteur de 3 valeurs à PER 10 et un secteur d'1 valeur à PER 2 :
    // la médiane des médianes donnerait 6 ; la médiane des sociétés donne 10.
    const lignes = [
      L({ code: 'A', secteur: 'X', per: 10 }), L({ code: 'B', secteur: 'X', per: 10 }), L({ code: 'C', secteur: 'X', per: 10 }),
      L({ code: 'D', secteur: 'Y', per: 2 }),
    ];
    expect(medianeMarche(lignes, 'per')).toBe(10);
  });
  it('rend null quand rien n’est exploitable', () => {
    expect(medianeMarche([L({ code: 'A', per: -3 })], 'per')).toBeNull();
  });
});
