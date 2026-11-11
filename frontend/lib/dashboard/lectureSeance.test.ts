import { describe, it, expect } from 'vitest';
import { lectureSeance, type LigneSeanceBrute } from './lectureSeance';

const ligne = (code: string, variation: number | null, valeur: number | null, extra: Partial<LigneSeanceBrute> = {}): LigneSeanceBrute => ({
  code,
  designation: `Société ${code}`,
  variation_pct: variation,
  valeur_echangee: valeur,
  cours_jour: 1000,
  volume: 10,
  nb_transactions: null,
  ...extra,
});

describe('lectureSeance', () => {
  it('rend null sur une séance vide (rien à lire, rien d’inventé)', () => {
    expect(lectureSeance([], -2)).toBeNull();
  });

  it('pondère la même séance par valeurs puis par capitaux', () => {
    // 2 hausses légères en capitaux, 1 baisse lourde.
    const l = lectureSeance([ligne('A', 1, 100), ligne('B', 2, 100), ligne('C', -1, 800)], 0)!;
    expect(l.nbHausses).toBe(2);
    expect(l.nbBaisses).toBe(1);
    const valeurs = l.mesures[0];
    const cap = l.mesures[l.mesures.length - 1];
    expect(valeurs.cle).toBe('valeurs');
    expect(valeurs.baisse).toBeCloseTo(100 / 3, 5);
    expect(cap.cle).toBe('capitaux');
    expect(cap.baisse).toBeCloseTo(80, 5);
    expect(l.partBaissiere).toBeCloseTo(80, 5);
  });

  it('retire la pondération par transactions quand aucune n’est publiée', () => {
    const l = lectureSeance([ligne('A', 1, 100), ligne('B', -1, 100)], 0)!;
    expect(l.mesures.map((m) => m.cle)).toEqual(['valeurs', 'capitaux']);
  });

  it('garde la pondération par transactions quand elles sont publiées, capitaux toujours en dernier', () => {
    const l = lectureSeance([ligne('A', 1, 100, { nb_transactions: 3 }), ligne('B', -1, 300, { nb_transactions: 1 })], 0)!;
    expect(l.mesures.map((m) => m.cle)).toEqual(['valeurs', 'transactions', 'capitaux']);
    expect(l.partBaissiere).toBeCloseTo(75, 5);
  });

  it('estime les capitaux par cours × titres quand la valeur échangée manque partout, et le dit', () => {
    const l = lectureSeance([ligne('A', 1, null, { cours_jour: 100, volume: 5 }), ligne('B', -1, null, { cours_jour: 100, volume: 15 })], 0)!;
    expect(l.capitauxEstimes).toBe(true);
    expect(l.partBaissiere).toBeCloseTo(75, 5);
    expect(l.mesures[l.mesures.length - 1].unite).toMatch(/estimés/);
  });

  it('applique la règle affichée : les deux tests vrais → « À surveiller »', () => {
    const l = lectureSeance([ligne('A', 1, 100), ligne('B', -3, 900)], -1.5)!;
    expect(l.verdict).toMatchObject({ code: 'a_surveiller', libelle: 'À surveiller', testComposite: true, testCapitaux: true });
  });

  it('un seul test vrai → « Contrasté » ; aucun → « Sans alerte »', () => {
    expect(lectureSeance([ligne('A', 1, 900), ligne('B', -3, 100)], -1.5)!.verdict.code).toBe('contraste');
    expect(lectureSeance([ligne('A', 1, 100), ligne('B', -3, 900)], 0.2)!.verdict.code).toBe('contraste');
    expect(lectureSeance([ligne('A', 1, 900), ligne('B', -3, 100)], 0.2)!.verdict.code).toBe('sans_alerte');
  });

  it('les seuils sont stricts : −1 % et 60 % exactement ne déclenchent pas', () => {
    const l = lectureSeance([ligne('A', 1, 40), ligne('B', -1, 60)], -1)!;
    expect(l.verdict.testComposite).toBe(false);
    expect(l.verdict.testCapitaux).toBe(false);
  });

  it('un Composite absent ne déclenche jamais son test', () => {
    const l = lectureSeance([ligne('A', -1, 100)], null)!;
    expect(l.verdict.testComposite).toBe(false);
    expect(l.verdict.compositeVar).toBeNull();
  });

  it('identifie la ligne la plus lourde et sa part du montant', () => {
    const l = lectureSeance([ligne('A', 1, 100), ligne('B', -2, 300)], 0)!;
    expect(l.plusLourde).toMatchObject({ code: 'B', variation: -2 });
    expect(l.plusLourde!.partMontant).toBeCloseTo(75, 5);
  });

  it('n’envoie sur l’axe que les valeurs dont la variation est connue', () => {
    const l = lectureSeance([ligne('A', 1, 100), ligne('B', null, 100)], 0)!;
    expect(l.lignes.map((x) => x.code)).toEqual(['A']);
  });

  it('garde une transaction non publiée à null sur l’axe (jamais un faux zéro)', () => {
    const l = lectureSeance([ligne('A', 1, 100), ligne('B', -1, 100, { nb_transactions: 4 })], 0)!;
    expect(l.lignes.find((x) => x.code === 'A')!.transactions).toBeNull();
    expect(l.lignes.find((x) => x.code === 'B')!.transactions).toBe(4);
  });
});
