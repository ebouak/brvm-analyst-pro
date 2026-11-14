import { describe, it, expect } from 'vitest';
import {
  perAffichable, roeAffichable, montantDividende, dividendesAffichables, distributionAffichable, evolutionResultat, horsExploitation,
  dividendeCourant, volumeAuDessusMoyenne, ligneVerdict, evolutionResultatDetail, syntheseExercice, titrePublication, libellePenalite, bpaAffichable, formatRendementDividende, rendementDividendeParts, nombreFr, pctFr, moisAnnee, insecable, libelleEvenement,
} from './affichage';

const sp = (s: string | null) => s?.replace(/ | /g, ' ') ?? null;

describe('perAffichable', () => {
  it('non calculable si BPA ≤ 0', () => expect(perAffichable(-271.42, -7.18)).toEqual({ valeur: null, motif: 'non calculable, perte' }));
  it('rend le PER si BPA > 0', () => expect(perAffichable(12.3, 40)).toEqual({ valeur: 12.3, motif: null }));
});

describe('perAffichable : non significatif (audit 2026-11-13)', () => {
  it('n.s. au-delà de 100', () => expect(perAffichable(519.4, 3)).toEqual({ valeur: null, motif: 'n.s., bénéfice très faible' }));
  it('100 exactement reste affiché', () => expect(perAffichable(100, 10)).toEqual({ valeur: 100, motif: null }));
  it('PER négatif = perte, même sans BPA fourni', () => expect(perAffichable(-62.7, null)).toEqual({ valeur: null, motif: 'non calculable, perte' }));
});

describe('roeAffichable', () => {
  it('n.s. si capitaux propres négatifs (UNLC)', () => expect(roeAffichable(-0.06, -10.66e9)).toEqual({ valeur: null, motif: 'n.s., capitaux propres négatifs' }));
  it('rend le ROE sinon', () => expect(roeAffichable(0.296, 1399e9)).toEqual({ valeur: 0.296, motif: null }));
  it('non disponible sans ROE', () => expect(roeAffichable(null, null)).toEqual({ valeur: null, motif: 'non disponible' }));
});

describe('montantDividende', () => {
  it('garde les décimales officielles', () => {
    expect(sp(montantDividende(597.53))).toBe('597,53 FCFA');
    expect(sp(montantDividende(0.92))).toBe('0,92 FCFA');
  });
  it('entier sans décimales', () => expect(sp(montantDividende(174))).toBe('174 FCFA'));
});

describe('dividendesAffichables', () => {
  it('écarte sans exercice et montant nul, trie par exercice décroissant', () => {
    const r = dividendesAffichables([
      { exercice: null, montant: 121 },
      { exercice: 2024, montant: 0 },
      { exercice: 2023, montant: 206 },
      { exercice: 2025, montant: 201.52 },
    ]);
    expect(r.map((l) => l.exercice)).toEqual([2025, 2023]);
  });
});

describe('distributionAffichable', () => {
  it('sans objet si résultat ≤ 0', () => expect(distributionAffichable(-9.207, -96.6e6)).toEqual({ valeur: null, motif: 'sans objet, perte' }));
  it('rend la valeur si bénéfice', () => expect(distributionAffichable(0.4, 1e9)).toEqual({ valeur: 0.4, motif: null }));
});

describe('evolutionResultat', () => {
  it('perte réduite', () => expect(sp(evolutionResultat(-96.6e6, -348.2e6))).toBe('perte réduite de 72,3 %'));
  it('perte aggravée', () => expect(sp(evolutionResultat(-200e6, -100e6))).toBe('perte aggravée de 100,0 %'));
  it('changements de signe', () => {
    expect(evolutionResultat(10e6, -5e6)).toBe('retour au bénéfice');
    expect(evolutionResultat(-5e6, 10e6)).toBe('passage en perte');
  });
  it('variation signée', () => expect(sp(evolutionResultat(120, 100))).toBe('+20,0 %'));
  it('null sans exercice précédent', () => expect(evolutionResultat(10, null)).toBeNull());
});

describe('evolutionResultatDetail', () => {
  it('types', () => {
    expect(evolutionResultatDetail(-96.6e6, -348.2e6)!.type).toBe('perte_reduite');
    expect(evolutionResultatDetail(-200, -100)).toEqual({ type: 'perte_aggravee', pct: 100 });
    expect(evolutionResultatDetail(10, -5)).toEqual({ type: 'retour_benefice', pct: null });
    expect(evolutionResultatDetail(-5, 10)).toEqual({ type: 'passage_perte', pct: null });
    expect(evolutionResultatDetail(120, 100)).toEqual({ type: 'hausse', pct: 20 });
    expect(evolutionResultatDetail(80, 100)).toEqual({ type: 'baisse', pct: 20 });
  });
  it('stable : valeurs égales ou variation arrondie à 0,0 %', () => {
    expect(evolutionResultatDetail(100, 100)).toEqual({ type: 'stable', pct: null });
    expect(evolutionResultatDetail(100.01, 100)).toEqual({ type: 'stable', pct: null });
    expect(evolutionResultat(100, 100)).toBe('stable');
  });
});

describe('horsExploitation', () => {
  it('STAC 2025 : 776,3 M', () => expect(horsExploitation(4.3e6, -772.0e6)).toBeCloseTo(776.3e6, -4));
  it('null si un terme manque', () => expect(horsExploitation(null, -1)).toBeNull());
});

describe('dividendeCourant sans exercice', () => {
  it('ignore une ligne sans exercice placée en tête (tri PostgREST, nulls en premier)', () => {
    const d = dividendeCourant([
      { montant: 50, exercice: null, ex_date: null, payment_date: null },
      { montant: 66.15, exercice: 2021, ex_date: null, payment_date: '2022-07-18' },
    ], 2025);
    expect(d).toMatchObject({ montant: 66.15, exercice: 2021 });
  });
});

describe('dividendeCourant', () => {
  it('marque ancien un dividende de plus d’un exercice', () => {
    expect(dividendeCourant([{ montant: 66.15, exercice: 2021, ex_date: null, payment_date: '2022-07-18' }], 2025))
      .toMatchObject({ montant: 66.15, exercice: 2021, ancien: true });
  });
  it('courant', () => expect(dividendeCourant([{ montant: 100, exercice: 2025, ex_date: '2026-06-01', payment_date: null }], 2025)!.ancien).toBe(false));
  it('ignore les montants nuls', () => expect(dividendeCourant([{ montant: 0, exercice: 2025, ex_date: null, payment_date: null }], 2025)).toBeNull());
});

describe('volumeAuDessusMoyenne', () => {
  it('faux à 0,3× (STAC 6 nov.)', () => expect(volumeAuDessusMoyenne(1551, 4782)).toBe(false));
  it('vrai au-dessus', () => expect(volumeAuDessusMoyenne(5000, 4782)).toBe(true));
  it('faux sans moyenne', () => expect(volumeAuDessusMoyenne(5000, null)).toBe(false));
});

describe('ligneVerdict', () => {
  it('libellé français, score à deux décimales', () => expect(ligneVerdict('HOLD', 0.4412, 5.41)).toBe('Signal neutre · score 0,44. Séance en hausse de 5,41 %.'));
  it('baisse', () => expect(ligneVerdict('SELL', -0.7, -2)).toBe('Signal baissier · score −0,70. Séance en baisse de 2,00 %.'));
  it('null sans signal', () => expect(ligneVerdict(null, null, 1)).toBeNull());
  it('variation absente : aucune phrase de séance', () => expect(ligneVerdict('HOLD', 0.4412, null)).toBe('Signal neutre · score 0,44.'));
  it('variation nulle : séance stable', () => expect(ligneVerdict('HOLD', 0.4412, 0)).toBe('Signal neutre · score 0,44. Séance stable.'));
  it('score arrondi à zéro : pas de −0,00', () => expect(ligneVerdict('HOLD', -0.001, 1)).toBe('Signal neutre · score 0,00. Séance en hausse de 1,00 %.'));
});

describe('syntheseExercice', () => {
  it('STAC 2025', () => {
    expect(syntheseExercice({ croissanceCaPct: 116.3, evolution: evolutionResultatDetail(-96.6e6, -348.2e6), resultatExploitation: -772e6, horsExpl: 776.3e6 }))
      .toBe("Le chiffre d'affaires a plus que doublé (+116,3 %) et la perte se réduit, mais l'exploitation reste déficitaire et le résultat dépend de produits hors exploitation.");
  });
  it('hausse', () => {
    expect(sp(syntheseExercice({ croissanceCaPct: 10, evolution: evolutionResultatDetail(120, 100), resultatExploitation: 5, horsExpl: 0 })))
      .toBe("Le chiffre d'affaires progresse de 10,0 % et le résultat net de 20,0 %.");
  });
  it('sens opposés : chaque membre garde son verbe', () => {
    expect(sp(syntheseExercice({ croissanceCaPct: 8.3, evolution: evolutionResultatDetail(95, 100), resultatExploitation: 5, horsExpl: 0 })))
      .toBe("Le chiffre d'affaires progresse de 8,3 % et le résultat net recule de 5,0 %.");
  });
  it('exactement 100 % : a doublé', () => {
    expect(syntheseExercice({ croissanceCaPct: 100, evolution: null, resultatExploitation: null, horsExpl: null })).toBe("Le chiffre d'affaires a doublé.");
  });
  it('null sans donnée', () => expect(syntheseExercice({ croissanceCaPct: null, evolution: null, resultatExploitation: null, horsExpl: null })).toBeNull());
});

describe('titrePublication', () => {
  it('harmonise les graphies BRVM', () => {
    expect(titrePublication('Etats Financiers exercice 2020 - SETAO CI')).toBe('États financiers exercice 2020 - SETAO CI');
    expect(titrePublication('Etats financiers - Exercice 2017: SETAO CI')).toBe('États financiers - Exercice 2017 · SETAO CI');
  });
});

describe('libellePenalite', () => {
  it('plafonne le libellé à 25 pts sans toucher à la somme', () => {
    expect(libellePenalite(45)).toBe('Garde-fous déclenchés : −45 pts (pénalité plafonnée à 25 pts)');
  });
  it('sous le plafond, la pénalité égale la somme', () => {
    expect(libellePenalite(15)).toBe('Garde-fous déclenchés : −15 pts (pénalité de 15 pts)');
  });
  it('rien si nul ou absent', () => {
    expect(libellePenalite(0)).toBeNull();
    expect(libellePenalite(null)).toBeNull();
  });
});

describe('bpaAffichable', () => {
  it('résultat net ÷ titres, 2 décimales (STAC)', () => expect(bpaAffichable(-96.6e6, 13.45e6)).toEqual({ valeur: -7.18, motif: null }));
  it('bénéfice', () => expect(bpaAffichable(1000, 100)).toEqual({ valeur: 10, motif: null }));
  it('titres absents ou nuls', () => {
    expect(bpaAffichable(1000, null).valeur).toBeNull();
    expect(bpaAffichable(1000, 0).valeur).toBeNull();
  });
  it('résultat absent', () => expect(bpaAffichable(null, 100)).toEqual({ valeur: null, motif: 'non disponible' }));
});

describe('libellePenalite avec pénalité appliquée', () => {
  it('annonce la pénalité réellement appliquée avant la somme des garde-fous', () => {
    expect(sp(libellePenalite(45, 20.4))).toBe('Pénalité appliquée −20,4 pts · garde-fous déclenchés −45 pts, plafond 25');
  });
  it('sans pénalité appliquée mesurable, garde le libellé historique', () => {
    expect(libellePenalite(45, null)).toBe('Garde-fous déclenchés : −45 pts (pénalité plafonnée à 25 pts)');
  });
});

describe('formatRendementDividende', () => {
  it('format unique : virgule, 2 décimales, exercice entre parenthèses', () => {
    expect(sp(formatRendementDividende(3.3897, 2021))).toBe('3,39 % (ex. 2021)');
  });
  it('sans exercice', () => expect(sp(formatRendementDividende(3.3897, null))).toBe('3,39 %'));
  it('absent', () => expect(formatRendementDividende(null, 2021)).toBeNull());
  it('espace insécable avant le pourcent', () => expect(formatRendementDividende(1, null)).toBe('1,00 %'));
});

describe('rendementDividendeParts', () => {
  it('sépare la valeur et l exercice', () => {
    const r = rendementDividendeParts(3.3897, 2021)!;
    expect(sp(r.valeur)).toBe('3,39 %');
    expect(r.exercice).toBe('ex. 2021');
  });
  it('sans exercice', () => expect(rendementDividendeParts(3.3897, null)?.exercice).toBeNull());
  it('absent', () => expect(rendementDividendeParts(null, 2021)).toBeNull());
});

describe('nombreFr / pctFr', () => {
  it('virgule décimale et moins typographique', () => {
    expect(nombreFr(73.46, 2)).toBe('73,46');
    expect(nombreFr(-27.1, 1)).toBe('−27,1');
    expect(nombreFr(null)).toBe('—');
  });
  it('pourcentage avec espace insécable, signe facultatif', () => {
    expect(sp(pctFr(5.41, 2, true))).toBe('+5,41 %');
    expect(sp(pctFr(-27.1, 1))).toBe('−27,1 %');
    expect(pctFr(1.78, 2)).toBe('1,78 %');
  });
});

describe('moisAnnee', () => {
  it('mois court + année sur 2 chiffres', () => {
    expect(moisAnnee('2025-05-21')).toBe('mai 25');
    expect(moisAnnee('2026-08-29')).toBe('août 26');
    expect(moisAnnee('2026-01-03')).toBe('janv. 26');
  });
  it('date invalide : renvoyée telle quelle', () => expect(moisAnnee('n/a')).toBe('n/a'));
});

describe('insecable', () => {
  it('lie le nombre à son unité', () => {
    expect(insecable('perte de 96,6 M FCFA')).toBe('perte de 96,6 M FCFA');
    expect(insecable('2,55 Md')).toBe('2,55 Md');
    expect(insecable('72,3 %')).toBe('72,3 %');
  });
  it('laisse le reste intact', () => expect(insecable('la perte de Sonatel')).toBe('la perte de Sonatel'));
});

describe('libelleEvenement', () => {
  it('accentue les types bruts', () => {
    expect(libelleEvenement('resultats')).toBe('Résultats');
    expect(libelleEvenement('assemblee')).toBe('Assemblée générale');
  });
  it('type inconnu : première lettre en capitale, tirets en espaces', () => expect(libelleEvenement('opération_titres')).toBe('Opération titres'));
});
