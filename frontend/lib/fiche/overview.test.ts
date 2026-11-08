import { describe, it, expect } from 'vitest';
import { lignesStatistiques, phrasePerformance as phraseBrute, serieAnnuelle, dateEnLettres, libelleFamille, type EntreeStats } from './overview';

const base: EntreeStats = {
  fondamentauxVisibles: true,
  capitalisation: 26_208_000_000,
  exercice: 2025,
  chiffreAffaires: 3_878_254_000,
  chiffreAffairesPrecedent: 1_793_360_000,
  resultatNet: -96_558_000,
  resultatNetPrecedent: -348_195_000,
  bpa: { valeur: -7.18, motif: null },
  per: { valeur: null, motif: 'non calculable, perte' },
  titres: 13_440_000,
  rendementDividende: null,
  rendementNetIrvm: null,
  dernierDividende: null,
  volume: 1551,
  volumeMoyen20: 4808,
  valeurEchangee: 2_890_600,
  transactions: 29,
  ouverture: 1830,
  cloturePrecedente: 1850,
  plusBas: 1830,
  plusHaut: 1950,
  plage52: { bas: 925, haut: 3895 },
  beta: 0.51,
  noteTechnique: null,
  combinedAlpha: null,
  prochainEvenement: null,
};

const sp = (v: string | null) => (v == null ? v : v.replace(/[  ]/g, ' '));
const phrasePerformance = (p: Parameters<typeof phraseBrute>[0]) => sp(phraseBrute(p));
const parCle = (e: EntreeStats) => Object.fromEntries(lignesStatistiques(e).map((l) => [l.cle, { ...l, valeur: sp(l.valeur)!, complement: sp(l.complement) }]));

describe('lignesStatistiques', () => {
  it('rend les lignes de STAC avec leurs valeurs au format français', () => {
    const l = parCle(base);
    expect(l.capitalisation!.valeur).toBe('26,21 Md FCFA');
    expect(l.ca!.libelle).toBe("Chiffre d'affaires (2025)");
    expect(l.ca!.valeur).toBe('3,88 Md FCFA');
    expect(l.ca!.complement).toBe('+116,3 % sur un an');
    expect(l.resultat!.valeur).toBe('−96,6 M FCFA');
    expect(l.resultat!.complement).toBe('perte réduite de 72,3 %');
    expect(l.bpa!.valeur).toBe('−7,18 FCFA');
    expect(l.titres!.valeur).toBe('13 440 000');
    expect(l.per!.valeur).toBe('Non calculable, perte');
    expect(l.volume!.valeur).toBe('1 551 titres');
    expect(l.volume!.complement).toBe('moyenne 20 séances : 4 808');
    expect(l.fourchette!.valeur).toBe('1 830 – 1 950');
    expect(l.plage52!.valeur).toBe('925 – 3 895');
    expect(l.beta!.valeur).toBe('0,51');
    expect(l.ouverture!.valeur).toBe('1 830');
    expect(l.cloture!.valeur).toBe('1 850');
    expect(l.valeur!.valeur).toBe('2,9 M FCFA');
    expect(l.transactions!.valeur).toBe('29');
  });

  it("n'affiche aucune ligne sans donnée", () => {
    const l = parCle(base);
    for (const cle of ['rendement', 'rendementNet', 'dividende', 'note', 'alpha', 'evenement']) expect(l[cle]).toBeUndefined();
  });

  it('masque un PER simplement indisponible, garde le motif « perte »', () => {
    expect(parCle({ ...base, per: { valeur: null, motif: 'non disponible' } }).per).toBeUndefined();
    expect(parCle({ ...base, bpa: { valeur: 12, motif: null }, per: { valeur: 14.25, motif: null } }).per!.valeur).toBe('14,25x');
  });

  it('retire les comptes quand les fondamentaux sont verrouillés', () => {
    const l = parCle({ ...base, fondamentauxVisibles: false });
    for (const cle of ['ca', 'resultat', 'bpa', 'per']) expect(l[cle]).toBeUndefined();
    expect(l.capitalisation).toBeDefined();
  });

  it('rend dividende, rendement, note, alpha et événement à venir quand ils existent', () => {
    const l = parCle({
      ...base,
      rendementDividende: { pct: 6.2, exercice: 2021, net: true, ancien: true },
      rendementNetIrvm: null,
      dernierDividende: { montant: 120, exercice: 2025, exDate: '2026-07-01' },
      noteTechnique: 'B',
      combinedAlpha: 61.4,
      prochainEvenement: { titre: 'Assemblée générale ordinaire', date: '2026-12-01' },
    });
    expect(l.rendement!.libelle).toBe('Rendement du dividende net');
    expect(l.rendement!.valeur).toBe('6,20 %');
    expect(l.rendement!.complement).toBe("ex. 2021, antérieur de plus d'un an au dernier exercice publié");
    expect(l.dividende!.valeur).toBe('120 FCFA');
    expect(l.dividende!.complement).toBe('ex. 2025, détaché le 1er juillet 2026');
    expect(l.note!.valeur).toBe('B');
    expect(l.alpha!.valeur).toBe('61/100');
    expect(l.evenement!.valeur).toBe('1er décembre 2026');
    expect(l.evenement!.complement).toBe('Assemblée générale ordinaire');
  });

  it('sans exercice précédent, aucune évolution', () => {
    const l = parCle({ ...base, chiffreAffairesPrecedent: null, resultatNetPrecedent: null });
    expect(l.ca!.complement).toBeNull();
    expect(l.resultat!.complement).toBeNull();
  });
});

describe('phrasePerformance', () => {
  it('reprend le modèle de STAC', () => {
    expect(phrasePerformance({ nom: 'SETAO CI', exercice: 2025, chiffreAffaires: 3_878_254_000, chiffreAffairesPrecedent: 1_793_360_000, resultatNet: -96_558_000, resultatNetPrecedent: -348_195_000 }))
      .toBe("Sur l'exercice 2025, le chiffre d'affaires de SETAO CI s'élève à 3,88 Md FCFA, en hausse de 116,3 % ; la perte nette se réduit de 72,3 %.");
  });
  it('bénéfice en hausse, sans chiffre d’affaires précédent', () => {
    expect(phrasePerformance({ nom: 'X', exercice: 2024, chiffreAffaires: 10e9, chiffreAffairesPrecedent: null, resultatNet: 2e9, resultatNetPrecedent: 1e9 }))
      .toBe("Sur l'exercice 2024, le chiffre d'affaires de X s'élève à 10,00 Md FCFA ; le résultat net progresse de 100,0 %, à 2,00 Md FCFA.");
  });
  it('sans chiffre d’affaires, la phrase part du résultat', () => {
    expect(phrasePerformance({ nom: 'X', exercice: 2024, chiffreAffaires: null, chiffreAffairesPrecedent: null, resultatNet: -5e8, resultatNetPrecedent: null }))
      .toBe("Sur l'exercice 2024, X enregistre une perte nette de 500,0 M FCFA.");
  });
  it('rien sans exercice ni chiffre', () => {
    expect(phrasePerformance({ nom: 'X', exercice: null, chiffreAffaires: 1, chiffreAffairesPrecedent: null, resultatNet: 1, resultatNetPrecedent: null })).toBeNull();
    expect(phrasePerformance({ nom: 'X', exercice: 2024, chiffreAffaires: null, chiffreAffairesPrecedent: null, resultatNet: null, resultatNetPrecedent: null })).toBeNull();
  });
  it('perte qui se creuse, passage en perte, retour au bénéfice', () => {
    const p = (rn: number, rn1: number) => phrasePerformance({ nom: 'X', exercice: 2024, chiffreAffaires: null, chiffreAffairesPrecedent: null, resultatNet: rn, resultatNetPrecedent: rn1 });
    expect(p(-2e9, -1e9)).toBe("Sur l'exercice 2024, la perte nette de X se creuse de 100,0 %, à 2,00 Md FCFA.");
    expect(p(-1e9, 1e9)).toBe("Sur l'exercice 2024, X passe en perte, avec un résultat net de −1,00 Md FCFA.");
    expect(p(1e9, -1e9)).toBe("Sur l'exercice 2024, X revient au bénéfice, avec un résultat net de 1,00 Md FCFA.");
  });
});

describe('serieAnnuelle', () => {
  it('préfère le compte de résultat, complète avec les fondamentaux, garde 5 exercices croissants', () => {
    const s = serieAnnuelle(
      [{ periode: '2025', revenu_total: 3, resultat_net: -1 }],
      [
        { year: 2025, revenue: 99, net_income: 99, is_manual: false },
        { year: 2024, revenue: 2, net_income: -3, is_manual: false },
        { year: 2024, revenue: 5, net_income: -4, is_manual: true },
        { year: 2020, revenue: 1, net_income: 1, is_manual: false },
        { year: 2021, revenue: 1, net_income: 1, is_manual: false },
        { year: 2022, revenue: 1, net_income: 1, is_manual: false },
        { year: 2023, revenue: null, net_income: null, is_manual: false },
      ],
    );
    expect(s.map((x) => x.exercice)).toEqual([2020, 2021, 2022, 2024, 2025]);
    expect(s.at(-1)).toEqual({ exercice: 2025, chiffreAffaires: 3, resultatNet: -1 });
    expect(s.at(-2)).toEqual({ exercice: 2024, chiffreAffaires: 5, resultatNet: -4 });
  });
  it('écarte un exercice sans aucun chiffre', () => {
    expect(serieAnnuelle([], [{ year: 2023, revenue: null, net_income: null, is_manual: false }])).toEqual([]);
  });
});

describe('dateEnLettres et libelleFamille', () => {
  it('écrit la date en toutes lettres', () => {
    expect(dateEnLettres('2026-11-02')).toBe('2 novembre 2026');
    expect(dateEnLettres('2007-02-01')).toBe('1er février 2007');
    expect(dateEnLettres('2026-11-02T10:00:00Z')).toBe('2 novembre 2026');
    expect(dateEnLettres(null)).toBeNull();
    expect(dateEnLettres('n/a')).toBeNull();
  });
  it('nomme la famille comptable', () => {
    expect(libelleFamille('banque')).toBe('Banque');
    expect(libelleFamille('general')).toBe('Plan comptable général');
    expect(libelleFamille(null)).toBeNull();
  });
});
