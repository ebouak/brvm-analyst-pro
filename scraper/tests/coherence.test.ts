import { describe, it, expect } from 'vitest';
import {
  construireEntree, concatenerPages, resumerAnomalies, verifierLectureInstruments,
  type InstrumentRow, type SignalRow,
} from '../src/coherence/runCoherence.js';
import { collecterAnomalies, type Publication, type RefSociete } from '../src/coherence/pure/regles.js';

/**
 * Le module `pure/regles.ts` est une COPIE de `frontend/lib/coherence/regles.ts`,
 * déjà éprouvée par `regles.test.ts` côté frontend — on ne recopie pas ces
 * tests ici. Ce fichier teste ce qui est PROPRE au balayage hebdomadaire du
 * scraper : l'assemblage des entrées depuis des lignes brutes, la pagination,
 * le résumé journalisé, et le refus du succès silencieux.
 */

describe('construireEntree', () => {
  const instrument: InstrumentRow = {
    code: 'PALC',
    designation: 'PALMCI',
    notation_json: { agence: 'Bloomfield', date_notation: '2025-07-01' },
  };
  const publications: Publication[] = [
    { date_publication: '2026-08-26', libelle: 'Notation Financière - PALM CI' },
  ];
  const signal: SignalRow = {
    code: 'PALC', date_marche: '2026-09-20',
    explication: 'Pas de signal franc (HOLD). Facteurs : RSI 70 (neutre).',
    score_variation: 0.1, score_volume: 0.2, score_rsi: -0.9871, score_macd: 0.05, bonus_tendance: 0.3,
  };
  const autres: RefSociete[] = [{ code: 'SAFC', designation: 'SAFCA CI' }];

  it('assemble tous les champs depuis les lignes brutes', () => {
    const e = construireEntree(instrument, publications, signal, 2025, autres);
    expect(e).toEqual({
      code: 'PALC',
      designation: 'PALMCI',
      dateNotation: '2025-07-01',
      explication: 'Pas de signal franc (HOLD). Facteurs : RSI 70 (neutre).',
      sousScores: { variation: 0.1, volume: 0.2, rsi: -0.9871, macd: 0.05, tendance: 0.3 },
      dernierExercice: 2025,
      publications,
      autresSocietes: autres,
    });
  });

  it('associe CHAQUE colonne de signals_daily au bon facteur (pas de champ interverti)', () => {
    // Cinq valeurs distinctes : si le mapping intervertissait deux colonnes
    // (ex. score_rsi -> macd), ce test le détecterait alors qu'un simple
    // gabarit à valeurs identiques ne le pourrait pas.
    const s: SignalRow = {
      code: 'X', date_marche: '2026-09-20', explication: null,
      score_variation: 1, score_volume: 2, score_rsi: 3, score_macd: 4, bonus_tendance: 5,
    };
    const e = construireEntree({ code: 'X', designation: 'X', notation_json: null }, [], s, null, []);
    expect(e.sousScores).toEqual({ variation: 1, volume: 2, rsi: 3, macd: 4, tendance: 5 });
  });

  it('signal absent -> explication null et sous-scores tous null (jamais devinés)', () => {
    const e = construireEntree(instrument, publications, null, 2025, autres);
    expect(e.explication).toBeNull();
    expect(e.sousScores).toEqual({ variation: null, volume: null, rsi: null, macd: null, tendance: null });
  });

  it('notation_json null -> dateNotation null', () => {
    const e = construireEntree({ ...instrument, notation_json: null }, publications, null, null, autres);
    expect(e.dateNotation).toBeNull();
  });

  it('notation_json sans date_notation, ou d’un type inattendu -> dateNotation null (jamais deviné)', () => {
    expect(construireEntree({ ...instrument, notation_json: {} }, [], null, null, []).dateNotation).toBeNull();
    // Une valeur numérique corrompue ne doit pas être coercée en chaîne en silence.
    expect(
      construireEntree({ ...instrument, notation_json: { date_notation: 20250701 } }, [], null, null, []).dateNotation,
    ).toBeNull();
  });

  it('designation absente (null en base) -> chaîne vide, jamais null (le type EntreeAnomalies l’exige)', () => {
    const e = construireEntree({ ...instrument, designation: null }, [], null, null, []);
    expect(e.designation).toBe('');
  });

  it('dernierExercice et publications transitent tels quels (pass-through)', () => {
    const e = construireEntree(instrument, [], null, null, []);
    expect(e.dernierExercice).toBeNull();
    expect(e.publications).toEqual([]);
  });

  it('composé avec collecterAnomalies, reproduit le cas réel PALC (notation périmée)', () => {
    // Preuve que le câblage (et pas seulement la forme de l'objet) est correct :
    // la publication de notation du 26 août 2026 doit effectivement dépasser
    // la date_notation du 1er juillet 2025 une fois passée par collecterAnomalies.
    const e = construireEntree(instrument, publications, null, null, []);
    const anomalies = collecterAnomalies(e);
    expect(anomalies.map((a) => a.regle)).toContain('notation_perimee');
  });
});

describe('concatenerPages', () => {
  it('concatène plusieurs pages pleines suivies d’une page finale incomplète, sans perte', () => {
    const p1 = Array.from({ length: 3 }, (_, i) => `a${i}`);
    const p2 = Array.from({ length: 3 }, (_, i) => `b${i}`);
    const p3 = ['c0']; // page incomplète : c'est elle qui arrête la pagination réelle
    expect(concatenerPages([p1, p2, p3], 3)).toEqual([...p1, ...p2, ...p3]);
  });

  it('s’arrête à la PREMIÈRE page incomplète et ignore tout ce qui suit', () => {
    // Une boucle de pagination réelle ne demanderait jamais cette 3e page,
    // puisque la 2e (incomplète) aurait déjà stoppé la boucle. Si cette
    // fonction l'incluait quand même, elle mentirait sur ce que la pagination
    // réelle aurait effectivement lu.
    const complete = ['a', 'b', 'c'];
    const incomplete = ['d'];
    const jamaisLue = ['e', 'f', 'g'];
    expect(concatenerPages([complete, incomplete, jamaisLue], 3)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('toutes les pages pleines (aucune incomplète) -> tout est concaténé', () => {
    const p1 = ['a', 'b'];
    const p2 = ['c', 'd'];
    expect(concatenerPages([p1, p2], 2)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('une seule page, déjà incomplète (cas le plus fréquent : moins de 1000 lignes) -> renvoyée telle quelle', () => {
    expect(concatenerPages([['x', 'y']], 1000)).toEqual(['x', 'y']);
  });

  it('aucune page -> tableau vide', () => {
    expect(concatenerPages([], 1000)).toEqual([]);
  });

  it('page vide en première position -> arrête immédiatement (0 < taillePage)', () => {
    expect(concatenerPages([[], ['jamais-lue']], 5)).toEqual([]);
  });
});

describe('resumerAnomalies', () => {
  it('compte zéro sur les 4 règles et les 2 gravités quand la liste est vide (pas d’objet creux)', () => {
    const r = resumerAnomalies([]);
    expect(r.nb_anomalies).toBe(0);
    expect(r.par_regle).toEqual({
      notation_perimee: 0, etiquette_contredite: 0, publication_mal_attribuee: 0, comptes_perimes: 0,
    });
    expect(r.par_gravite).toEqual({ trompeuse: 0, a_surveiller: 0 });
  });

  it('compte correctement par règle et par gravité sur un mélange', () => {
    const r = resumerAnomalies([
      { regle: 'notation_perimee', gravite: 'trompeuse' },
      { regle: 'notation_perimee', gravite: 'trompeuse' },
      { regle: 'publication_mal_attribuee', gravite: 'trompeuse' },
      { regle: 'etiquette_contredite', gravite: 'a_surveiller' },
      { regle: 'comptes_perimes', gravite: 'a_surveiller' },
      { regle: 'comptes_perimes', gravite: 'a_surveiller' },
      { regle: 'comptes_perimes', gravite: 'a_surveiller' },
    ]);
    expect(r.nb_anomalies).toBe(7);
    expect(r.par_regle).toEqual({
      notation_perimee: 2, etiquette_contredite: 1, publication_mal_attribuee: 1, comptes_perimes: 3,
    });
    expect(r.par_gravite).toEqual({ trompeuse: 3, a_surveiller: 4 });
  });
});

describe('verifierLectureInstruments', () => {
  it('lève une erreur explicite quand AUCUN instrument n’a été lu', () => {
    // C'est le cœur de l'exigence « pas de succès silencieux » : une table
    // vide ou inaccessible ne doit jamais se solder par un run vert.
    expect(() => verifierLectureInstruments(0)).toThrow(/aucun instrument/i);
  });

  it('ne lève rien dès qu’au moins un instrument a été lu', () => {
    expect(() => verifierLectureInstruments(1)).not.toThrow();
    expect(() => verifierLectureInstruments(48)).not.toThrow();
  });
});
