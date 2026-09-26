import { describe, expect, it } from 'vitest';
import {
  collecterAnomalies, verifierAttribution, verifierEtiquetteTechnique, verifierFraicheurComptes, verifierNotation,
  type EntreeAnomalies, type RefSociete,
} from './regles';

/** Sous-score arrondi à 2 décimales, séparateur français — même calcul que le module. */
const dec2 = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

describe('verifierNotation', () => {
  /** Cas réel du 2026-09-24 : PALC affiche juillet 2025, un PDF d'août 2026 existe déjà. */
  it('signale une notation périmée par une publication de notation plus récente (PALC)', () => {
    const a = verifierNotation({
      dateNotation: '2025-07-01',
      publications: [{ date_publication: '2026-08-26', libelle: 'Notation Financière - PALM CI' }],
    });
    expect(a).not.toBeNull();
    expect(a!.regle).toBe('notation_perimee');
    expect(a!.gravite).toBe('trompeuse');
    expect(a!.message).toBe(
      "La notation affichée date de juillet 2025 ; une notation plus récente a été publiée le 26 août 2026 (« Notation Financière - PALM CI ») et n'est pas encore reprise.",
    );
    expect(a!.preuve.date_notation).toBe('2025-07-01');
    expect(a!.preuve.date_publication).toBe('2026-08-26');
  });

  it('rend null quand aucune date de notation n’est affichée', () => {
    expect(verifierNotation({ dateNotation: null, publications: [{ date_publication: '2026-08-26', libelle: 'Notation Financière - X' }] })).toBeNull();
  });

  it('rend null quand la date de notation est illisible', () => {
    expect(verifierNotation({ dateNotation: 'pas-une-date', publications: [{ date_publication: '2026-08-26', libelle: 'Notation Financière - X' }] })).toBeNull();
  });

  it('rend null sans publication dont le libellé contient « notation »', () => {
    expect(verifierNotation({
      dateNotation: '2025-07-01',
      publications: [{ date_publication: '2026-08-26', libelle: 'Rapport d’activités - 1er semestre 2026' }],
    })).toBeNull();
  });

  it('rend null quand la publication de notation n’est PAS postérieure à la date affichée', () => {
    expect(verifierNotation({
      dateNotation: '2026-08-26',
      publications: [{ date_publication: '2025-07-01', libelle: 'Notation Financière - X' }],
    })).toBeNull();
    // Égalité stricte : une publication à la MÊME date n'est pas "plus récente".
    expect(verifierNotation({
      dateNotation: '2026-08-26',
      publications: [{ date_publication: '2026-08-26', libelle: 'Notation Financière - X' }],
    })).toBeNull();
  });

  it('détecte « notation » sans être sensible à la casse', () => {
    const a = verifierNotation({
      dateNotation: '2025-07-01',
      publications: [{ date_publication: '2026-08-26', libelle: 'NOTATION FINANCIÈRE - PALM CI' }],
    });
    expect(a).not.toBeNull();
  });

  /**
   * L'accent parasite (« Ó » au lieu de « O ») est le SEUL obstacle possible
   * ici : sans lui, le mot serait déjà « NOTATION » et détecté par une simple
   * comparaison de casse. Ce test échoue si `normaliser` perd son étape de
   * suppression des diacritiques (vérifié par mutation, voir le rapport).
   */
  it('détecte « notation » même déformé par un accent parasite — preuve que la normalisation retire les diacritiques', () => {
    const a = verifierNotation({
      dateNotation: '2025-07-01',
      publications: [{ date_publication: '2026-08-26', libelle: 'NOTATIÓN Financière - PALM CI' }],
    });
    expect(a).not.toBeNull();
  });

  it('prend la publication de notation la PLUS RÉCENTE quand plusieurs existent', () => {
    const a = verifierNotation({
      dateNotation: '2025-07-01',
      publications: [
        { date_publication: '2026-01-10', libelle: 'Notation Financière - ancienne' },
        { date_publication: '2026-08-26', libelle: 'Notation Financière - la plus récente' },
        { date_publication: '2026-03-15', libelle: 'Notation Financière - intermédiaire' },
      ],
    });
    expect(a!.preuve.date_publication).toBe('2026-08-26');
    expect(a!.preuve.libelle_publication).toBe('Notation Financière - la plus récente');
  });
});

describe('verifierEtiquetteTechnique', () => {
  /** Cas réel du 2026-09-24 : SNTS, RSI qualifié de neutre alors que le sous-score est tranché. */
  it('signale une étiquette « neutre » contredite par le sous-score RSI (SNTS)', () => {
    const a = verifierEtiquetteTechnique({
      explication: 'Pas de signal franc (HOLD). Facteurs : RSI 70 (neutre) ; volume proche de la moyenne ; MACD positif (momentum de fond haussier) ; tendance de fond haussière (MA20 > MA50).',
      sousScores: { rsi: -0.9871 },
    });
    expect(a).not.toBeNull();
    expect(a!.regle).toBe('etiquette_contredite');
    expect(a!.gravite).toBe('a_surveiller');
    expect(a!.message).toBe(`Le moteur qualifie le RSI de « neutre » alors que son sous-score vaut ${dec2(-0.9871)} : l'étiquette et le chiffre ne disent pas la même chose.`);
    expect(a!.preuve.facteur).toBe('rsi');
    expect(a!.preuve.sous_score).toBe(-0.9871);
  });

  it('signale aussi le volume, qualifié de neutre par une tournure sans le mot « neutre »', () => {
    const a = verifierEtiquetteTechnique({
      explication: 'Pas de signal franc (HOLD). Facteurs : volume proche de la moyenne ; RSI 55 ; MACD positif.',
      sousScores: { volume: 0.82 },
    });
    expect(a).not.toBeNull();
    expect(a!.preuve.facteur).toBe('volume');
    expect(a!.message).toContain('le volume');
    expect(a!.message).toContain(dec2(0.82));
  });

  it('ne signale rien quand le sous-score reste sous le seuil de contradiction', () => {
    expect(verifierEtiquetteTechnique({
      explication: 'Pas de signal franc (HOLD). Facteurs : RSI 45 (neutre) ; MACD positif.',
      sousScores: { rsi: 0.1 },
    })).toBeNull();
  });

  it('ne devine rien sur un texte libre sans « Facteurs : »', () => {
    expect(verifierEtiquetteTechnique({
      explication: 'Le titre a bien performé cette semaine, portée par des volumes soutenus.',
      sousScores: { rsi: -0.99 },
    })).toBeNull();
  });

  it('rend null sans explication', () => {
    expect(verifierEtiquetteTechnique({ explication: null, sousScores: { rsi: -0.99 } })).toBeNull();
  });

  it('ne signale pas un facteur qualifié de neutre si son sous-score est absent', () => {
    expect(verifierEtiquetteTechnique({
      explication: 'Pas de signal franc (HOLD). Facteurs : RSI 50 (neutre) ; MACD positif.',
      sousScores: {},
    })).toBeNull();
  });

  it('ne traite pas le RSI si la phrase ne le qualifie pas explicitement de « (neutre) »', () => {
    // RSI 30 est nommé mais qualifié de "survente", pas de "neutre" : rien à contredire ici.
    expect(verifierEtiquetteTechnique({
      explication: 'Signal de vente. Facteurs : RSI 30 (survente) ; MACD négatif.',
      sousScores: { rsi: -0.95 },
    })).toBeNull();
  });
});

describe('verifierAttribution', () => {
  const SAFC: RefSociete = { code: 'SAFC', designation: 'SAFCA CI' };
  const BOAN: RefSociete = { code: 'BOAN', designation: 'BANK OF AFRICA NIGER' };
  const SGBC: RefSociete = { code: 'SGBC', designation: 'SGBCI' };
  const NTLC: RefSociete = { code: 'NTLC', designation: 'NESTLE CI' };
  const CFAC: RefSociete = { code: 'CFAC', designation: 'CFAO MOTORS CI' };
  const AUTRES = [SAFC, BOAN, SGBC, NTLC, CFAC];

  /** Cas réel du 2026-09-24 : notation de SAFCA CI rattachée à la fiche PALC (PALMCI). */
  it('signale un document nommant une autre société cotée (SAFCA CI sur la fiche PALC)', () => {
    const a = verifierAttribution({
      code: 'PALC', designation: 'PALMCI', libelle: 'Notation Financière - SAFCA CI',
      autresSocietes: AUTRES,
    });
    expect(a).not.toBeNull();
    expect(a!.regle).toBe('publication_mal_attribuee');
    expect(a!.gravite).toBe('trompeuse');
    expect(a!.message).toBe('Ce document nomme SAFCA CI, une autre société cotée (SAFC). Son rattachement à cette fiche est probablement erroné.');
    expect(a!.preuve.code_autre_societe).toBe('SAFC');
    expect(a!.preuve.mot_declencheur).toBe('SAFCA');
  });

  /**
   * Cas réel du 2026-09-24 : « Etats financiers - Exercice 2025 - TRACTAFRIC
   * MOTORS CI » apparaît sur la fiche CFAC (CFAO MOTORS CI).
   *
   * LA FONCTION REND NULL ICI, ET C'EST LE COMPORTEMENT CORRECT — pas un bug.
   * MAIS CE TEST-CI, À LUI SEUL, NE PROUVE PAS POURQUOI : la désignation de
   * CFAC, « CFAO MOTORS CI », partage le mot MOTORS avec le libellé. MOTORS
   * étant générique, ce partage ne suffit pas à déclencher la condition 1
   * (auto-mention) aujourd'hui — mais si MOTORS cessait d'être générique, il
   * la déclencherait quand même (CFAC se « reconnaîtrait » via MOTORS) et
   * produirait le MÊME `null`, par une voie totalement différente (sortie
   * anticipée en condition 1, avant même de compter les correspondances).
   * Ce test est donc doublement couvert et ne peut pas, à lui seul, prouver
   * que le comptage (zéro correspondance parmi les cotées) est bien ce qui
   * produit ce `null` — vérifié par mutation : retirer MOTORS de
   * `TERMES_GENERIQUES` le laisse vert (voir le rapport). Le test suivant
   * isole la vraie raison, sans cette auto-mention parasite.
   *
   * Une cinquième condition qui tenterait d'attraper ce cas précis (par
   * exemple : « un mot distinctif inconnu, jamais vu dans `autresSocietes`,
   * est suspect ») ouvrirait exactement la porte que ce module ferme ailleurs :
   * elle signalerait aussi tout document parlant légitimement d'un
   * fournisseur, d'un actionnaire ou d'un partenaire non coté. La limite est
   * donc assumée et documentée dans `verifierAttribution`, pas comblée par
   * une supposition.
   */
  it('rend null sur TRACTAFRIC MOTORS CI (non coté) — la règle ne peut comparer qu’à des sociétés connues', () => {
    const a = verifierAttribution({
      code: 'CFAC', designation: 'CFAO MOTORS CI', libelle: 'Etats financiers - Exercice 2025 - TRACTAFRIC MOTORS CI',
      autresSocietes: AUTRES,
    });
    expect(a).toBeNull();
  });

  /**
   * Version isolée du test précédent, SANS auto-mention : le sujet (PALC) ne
   * partage aucun mot avec « CFAO MOTORS CI » ni avec le libellé. Ici, le
   * `null` ne peut venir QUE du comptage — zéro correspondance parmi les
   * cotées, TRACTAFRIC n'y figurant pas et MOTORS étant générique. Vérifié
   * par mutation : retirer MOTORS de `TERMES_GENERIQUES` fait BASCULER ce
   * test (CFAC devient alors « trouvé » via MOTORS, et le document est
   * attribué à tort à CFAC) — à la différence du test précédent, qui reste
   * vert sous la même mutation à cause de l'auto-mention.
   */
  it('isolé, sans auto-mention : un libellé nommant une société non cotée rend null', () => {
    const a = verifierAttribution({
      code: 'PALC', designation: 'PALMCI', libelle: 'Etats financiers - Exercice 2025 - TRACTAFRIC MOTORS CI',
      autresSocietes: AUTRES,
    });
    expect(a).toBeNull();
  });

  /** Défaut à ne pas rejouer (dividendes, 2026-09-08) : SGBCI EST « SOCIETE GENERALE CI ». */
  it('ne signale RIEN sur « SOCIETE GENERALE CI » qui est la désignation usuelle de SGBCI', () => {
    const a = verifierAttribution({
      code: 'SGBC', designation: 'SGBCI', libelle: "Rapport d'activités - 1er semestre 2026 - SOCIETE GENERALE CI",
      autresSocietes: AUTRES,
    });
    expect(a).toBeNull();
  });

  /**
   * L'accent est ici le SEUL obstacle entre « aucune correspondance » et
   * « correspondance trouvée » : NTLC est enregistrée sans accent
   * (« NESTLE CI », comme le référentiel BRVM le fait usuellement), le
   * document l'écrit avec (« NESTLÉ »). Sans la suppression des diacritiques,
   * le découpage en mots coupe le mot juste avant le É (« NESTL » au lieu de
   * « NESTLE ») et aucune correspondance n'est trouvée — le test bascule vers
   * `null` (vérifié par mutation, voir le rapport). Un test qui resterait
   * vert avec ou sans normalisation ne prouverait rien : celui-ci ne l'est
   * QUE si `normaliser` fonctionne.
   */
  it('résiste aux accents : NESTLÉ (libellé) doit rejoindre NESTLE CI (désignation en base, non accentuée)', () => {
    const a = verifierAttribution({
      code: 'SLBC', designation: 'SOLIBRA', libelle: 'Résultats semestriels - NESTLÉ CI',
      autresSocietes: AUTRES,
    });
    expect(a).not.toBeNull();
    expect(a!.preuve.code_autre_societe).toBe('NTLC');
  });

  /** Défaut à ne pas rejouer : « BOA NG » EST bien BOA Niger, pas une abréviation suspecte. */
  it('ne signale RIEN sur « BOA NG » qui désigne bien BOA Niger', () => {
    const a = verifierAttribution({
      code: 'BOAN', designation: 'BANK OF AFRICA NIGER',
      libelle: 'Rapport des CAC sur les Conventions réglementées - Exercice 2025 - BOA NG',
      autresSocietes: AUTRES,
    });
    expect(a).toBeNull();
  });

  it('refuse de trancher quand le libellé nomme DEUX sociétés cotées à la fois', () => {
    const a = verifierAttribution({
      code: 'SLBC', designation: 'SOLIBRA', libelle: 'Communiqué conjoint - SAFCA CI et NESTLE CI',
      autresSocietes: AUTRES,
    });
    expect(a).toBeNull();
  });

  /**
   * Généralise le test « deux sociétés » à trois, pour qu'une garde relâchée
   * en « au moins une correspondance » (au lieu d'« exactement une ») ne
   * puisse pas se cacher derrière un cas particulier à deux. Avec trois
   * correspondances réelles, une garde de ce type laisserait passer
   * `correspondances[0]` au lieu de refuser — vérifié par mutation (voir le
   * rapport).
   */
  it('refuse de trancher quand le libellé nomme TROIS sociétés cotées à la fois', () => {
    const a = verifierAttribution({
      code: 'SLBC', designation: 'SOLIBRA',
      libelle: 'Communiqué conjoint - SAFCA CI, NESTLE CI et BANK OF AFRICA NIGER',
      autresSocietes: AUTRES,
    });
    expect(a).toBeNull();
  });

  /**
   * Éprouve la partie « NON GÉNÉRIQUE » de la garde « exactement une
   * correspondance », séparément de son seuil numérique. BOAN partage bien
   * deux mots avec ce libellé (BANK, AFRICA), mais ce sont des termes
   * génériques : ils ne doivent PAS compter comme une deuxième correspondance
   * à côté de NTLC (mot distinctif "NESTLE"). Si le filtre générique était
   * retiré du côté des « autres sociétés », BOAN rejoindrait NTLC, la
   * correspondance cesserait d'être unique, et le résultat basculerait à
   * `null` — vérifié par mutation (voir le rapport). Un test à une seule
   * correspondance ne suffit pas à couvrir cette distinction : sans ce
   * deuxième candidat générique, rien ne force le filtre à s'exécuter côté
   * "autresSocietes".
   */
  it('un mot GÉNÉRIQUE partagé avec une autre société ne compte pas comme une deuxième correspondance', () => {
    const a = verifierAttribution({
      code: 'SLBC', designation: 'SOLIBRA',
      libelle: 'Résultats semestriels - NESTLE CI - présence régionale via BANK OF AFRICA',
      autresSocietes: AUTRES,
    });
    expect(a).not.toBeNull();
    expect(a!.preuve.code_autre_societe).toBe('NTLC');
  });

  it('ne signale rien quand aucun mot distinctif ne correspond à une société connue', () => {
    const a = verifierAttribution({
      code: 'SLBC', designation: 'SOLIBRA', libelle: 'Note macroéconomique régionale sur l’UEMOA',
      autresSocietes: AUTRES,
    });
    expect(a).toBeNull();
  });

  it('ne se signale jamais lui-même, même en présence d’un mot d’une autre société', () => {
    // Le document parle bien de PALMCI (mot distinctif présent) : peu importe
    // qu'il mentionne aussi SAFCA en passant, la condition 1 l'exclut d'abord.
    const a = verifierAttribution({
      code: 'PALC', designation: 'PALMCI', libelle: 'PALMCI commente la notation de SAFCA CI',
      autresSocietes: AUTRES,
    });
    expect(a).toBeNull();
  });
});

describe('verifierFraicheurComptes', () => {
  it('signale une publication portant sur une période postérieure au dernier exercice en base', () => {
    const a = verifierFraicheurComptes({
      dernierExercice: 2025,
      publicationsEtatsFinanciers: [{ date_publication: '2026-08-01', libelle: 'Rapport financier - 1er semestre 2026' }],
    });
    expect(a).not.toBeNull();
    expect(a!.regle).toBe('comptes_perimes');
    expect(a!.gravite).toBe('a_surveiller');
    expect(a!.message).toBe("Les comptes en base s'arrêtent à l'exercice 2025, alors qu'une publication porte sur le 1er semestre 2026.");
    expect(a!.preuve.annee_publication).toBe(2026);
  });

  it('reprend le mot-clé "exercice" avec son article, sans ordinal inventé', () => {
    const a = verifierFraicheurComptes({
      dernierExercice: 2025,
      publicationsEtatsFinanciers: [{ date_publication: '2027-04-01', libelle: 'Etats financiers - Exercice 2026' }],
    });
    expect(a!.message).toContain("l'exercice 2026");
  });

  it('rend null sans dernier exercice connu', () => {
    expect(verifierFraicheurComptes({
      dernierExercice: null,
      publicationsEtatsFinanciers: [{ date_publication: '2026-08-01', libelle: '1er semestre 2026' }],
    })).toBeNull();
  });

  it('ignore une publication dont l’année n’est pas lisible, sans la deviner', () => {
    expect(verifierFraicheurComptes({
      dernierExercice: 2025,
      publicationsEtatsFinanciers: [{ date_publication: '2026-08-01', libelle: 'Rapport annuel aux actionnaires' }],
    })).toBeNull();
  });

  it('ne signale rien quand la publication porte sur l’exercice en base ou un exercice antérieur', () => {
    expect(verifierFraicheurComptes({
      dernierExercice: 2025,
      publicationsEtatsFinanciers: [
        { date_publication: '2026-04-01', libelle: 'Etats financiers - Exercice 2025' },
        { date_publication: '2024-04-01', libelle: 'Etats financiers - Exercice 2023' },
      ],
    })).toBeNull();
  });

  it('retient la période la PLUS RÉCENTE quand plusieurs publications qualifient', () => {
    const a = verifierFraicheurComptes({
      dernierExercice: 2024,
      publicationsEtatsFinanciers: [
        { date_publication: '2026-04-01', libelle: 'Etats financiers - Exercice 2025' },
        { date_publication: '2027-04-01', libelle: 'Etats financiers - Exercice 2026' },
      ],
    });
    expect(a!.preuve.annee_publication).toBe(2026);
  });
});

describe('collecterAnomalies', () => {
  const base: EntreeAnomalies = {
    code: 'PALC',
    designation: 'PALMCI',
    dateNotation: '2025-07-01',
    explication: 'Pas de signal franc (HOLD). Facteurs : RSI 70 (neutre) ; MACD positif.',
    sousScores: { rsi: -0.9871 },
    dernierExercice: 2025,
    publications: [
      { date_publication: '2026-08-26', libelle: 'Notation Financière - PALMCI' }, // règle 1
      { date_publication: '2026-06-01', libelle: 'Notation Financière - SAFCA CI' }, // règle 3
      { date_publication: '2026-06-15', libelle: 'Communiqué - SAFCA CI' }, // règle 3, même société usurpée
      { date_publication: '2026-08-01', libelle: 'Rapport financier - 1er semestre 2026' }, // règle 4
    ],
    autresSocietes: [{ code: 'SAFC', designation: 'SAFCA CI' }],
  };

  it('rassemble les quatre règles, dans l’ordre trompeuse puis a_surveiller', () => {
    const anomalies = collecterAnomalies(base);
    // Les quatre règles remontent, et les « trompeuse » précèdent toutes les
    // « a_surveiller ». L'ordre À L'INTÉRIEUR d'une gravité n'est PAS garanti
    // et ne doit pas être testé : l'attribution est désormais évaluée en
    // premier (elle récuse les documents que les autres règles pourraient
    // invoquer à tort), ce qui change l'ordre d'insertion sans rien changer
    // au sens de la sortie.
    expect(new Set(anomalies.map((a) => a.regle))).toEqual(new Set([
      'notation_perimee',
      'publication_mal_attribuee',
      'etiquette_contredite',
      'comptes_perimes',
    ]));
    expect(anomalies.map((a) => a.gravite)).toEqual(['trompeuse', 'trompeuse', 'a_surveiller', 'a_surveiller']);
  });

  it('déduplique les publications mal attribuées à la MÊME autre société (un seul message)', () => {
    const anomalies = collecterAnomalies(base);
    const attributions = anomalies.filter((a) => a.regle === 'publication_mal_attribuee');
    expect(attributions).toHaveLength(1);
  });

  it('ne rend rien quand aucune règle ne trouve d’anomalie', () => {
    const anomalies = collecterAnomalies({
      code: 'PALC', designation: 'PALMCI',
      dateNotation: null,
      explication: null,
      sousScores: {},
      dernierExercice: null,
      publications: [],
      autresSocietes: [],
    });
    expect(anomalies).toEqual([]);
  });
});

describe('défauts bloquants relevés en revue, corrigés', () => {
  const PALC = { code: 'PALC', designation: 'PALMCI' };
  const SAFC = { code: 'SAFC', designation: 'SAFCA CI' };

  it('N’ACCUSE PAS la fiche sur la foi d’un document qu’elle vient de récuser', () => {
    // Le module se contredisait dans sa propre sortie : notation à jour,
    // seule publication « notation » présente = celle d'une AUTRE société.
    const a = collecterAnomalies({
      ...PALC, dateNotation: '2026-08-26',
      publications: [{ date_publication: '2026-09-01', libelle: 'Notation Financière - SAFCA CI' }],
      autresSocietes: [SAFC], dernierExercice: 2025, explication: null, sousScores: {},
    });
    expect(a.map((x) => x.regle)).toEqual(['publication_mal_attribuee']);
    expect(a.map((x) => x.regle)).not.toContain('notation_perimee');
  });

  it('ne déclare pas les comptes périmés sur un exercice appartenant à une autre société', () => {
    const a = collecterAnomalies({
      ...PALC, dateNotation: null,
      publications: [{ date_publication: '2026-09-01', libelle: 'Etats financiers - Exercice 2026 - SAFCA CI' }],
      autresSocietes: [SAFC], dernierExercice: 2025, explication: null, sousScores: {},
    });
    expect(a.map((x) => x.regle)).not.toContain('comptes_perimes');
  });

  it('accuse TOUJOURS sur un document qui, lui, appartient bien à la fiche', () => {
    const a = collecterAnomalies({
      ...PALC, dateNotation: '2025-07-01',
      publications: [{ date_publication: '2026-08-26', libelle: 'Notation Financière - PALM CI' }],
      autresSocietes: [SAFC], dernierExercice: 2025, explication: null, sousScores: {},
    });
    const n = a.find((x) => x.regle === 'notation_perimee');
    expect(n).toBeDefined();
    // Le document est cité : l'accusation est vérifiable par le lecteur.
    expect(n!.message).toContain('Notation Financière - PALM CI');
  });

  it('UNE ligne corrompue n’emporte pas les trois autres règles', () => {
    const a = collecterAnomalies({
      ...PALC, dateNotation: '2025-07-01',
      publications: [
        { date_publication: '2026-08-26', libelle: null as unknown as string },
        { date_publication: '2026-08-27', libelle: 'Notation Financière - PALM CI' },
      ],
      autresSocietes: [SAFC], dernierExercice: 2025, explication: null, sousScores: {},
    });
    expect(a.map((x) => x.regle)).toContain('notation_perimee');
  });

  it('rejette une date hors calendrier au lieu de la laisser glisser au mois suivant', () => {
    // new Date('2026-02-30') vaut le 2 mars : une date corrompue paraîtrait
    // plus récente qu'elle ne l'est, et suffirait à déclencher l'accusation.
    const a = collecterAnomalies({
      ...PALC, dateNotation: '2026-02-28',
      publications: [{ date_publication: '2026-02-30', libelle: 'Notation Financière - PALM CI' }],
      autresSocietes: [], dernierExercice: 2025, explication: null, sousScores: {},
    });
    expect(a.map((x) => x.regle)).not.toContain('notation_perimee');
  });

  it('n’accuse personne quand la fiche ne sait pas reconnaître son propre nom', () => {
    expect(verifierAttribution({
      code: 'XXXX', designation: 'SOCIETE CI', // entièrement générique
      libelle: 'Notation Financière - SAFCA CI', autresSocietes: [SAFC],
    })).toBeNull();
    expect(verifierAttribution({
      code: 'XXXX', designation: '', libelle: 'Notation Financière - SAFCA CI', autresSocietes: [SAFC],
    })).toBeNull();
  });
});
