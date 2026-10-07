import { describe, it, expect } from 'vitest';
import { construireAlias, emetteurDuTitre, emetteurContredit, emetteurDuFichier, emetteurDuDocument, documentEtranger, codeDeCollecte } from '../src/publications/emetteur.js';

const alias = construireAlias([
  { code: 'SIBC', designation: "SOCIETE IVOIRIENNE DE BANQUE COTE D'IVOIRE" },
  { code: 'SGBC', designation: 'SGBCI' },
  { code: 'CFAC', designation: 'CFAO MOTORS CI' },
  { code: 'PRSC', designation: 'TRACTAFRIC MOTORS CI' },
  { code: 'ABJC', designation: 'SERVAIR ABIDJAN CI' },
  { code: 'ECOC', designation: "ECOBANK COTE D'IVOIRE" },
  { code: 'ETIT', designation: 'ETI TG' },
]);

describe('émetteur nommé par le titre (titres réels de la base)', () => {
  it.each([
    ['Notation Financière - SIB CI', 'SIBC'],
    ['SGBCI: Avis de reprise de coation', 'SGBC'],
    ['Etats financiers - Exercice 2016: BOA CI', 'BOAC'],
    ['Rapport d’activités du 1er trimestre 2023 - SGCI', 'SGBC'],
    ['Etats financiers - Exercice 2023 - TRACTAFRIC MOTORS CI (Annule et remplace le précédent)', 'PRSC'],
    ['Etats financiers - Exercice 2014: TM CI', 'PRSC'],
    ['Bilan semestriel du contrat de liquidité - ABJC', 'ABJC'],
    ["Rapport d'activités au 3ème trimestre 2020 - ECOBANK CI", 'ECOC'],
    ["Rapport d'Activité du 3e trimestre 2017 - ETI TG", 'ETIT'],
    ['Etats Financiers certifiés - Exercice 2025 - AFRICA GLOBAL LOGISTICS CI', 'SDSC'],
  ])('%s → %s', (libelle, code) => {
    expect(emetteurDuTitre(libelle, alias)).toBe(code);
  });

  it('un titre sans émetteur ne conclut rien', () => {
    expect(emetteurDuTitre('Etats financiers provisoires exercice 2009', alias)).toBeNull();
    expect(emetteurDuTitre('Avis de convocation', alias)).toBeNull();
    expect(emetteurDuTitre("Rapport d'activités du 1er semestre 2012", alias)).toBeNull();
  });

  it('« ECOBANK » seul (groupe) ≠ « ECOBANK CI » (filiale)', () => {
    expect(emetteurDuTitre('Rapport annuel 2015 - ECOBANK', alias)).toBe('ETIT');
    expect(emetteurDuTitre('Rapport annuel 2015 - ECOBANK CI', alias)).toBe('ECOC');
  });
});

describe('fautes de BDFIN et ancien nom de Tractafric', () => {
  it.each([
    ["Rapport d'acticités du 1er semestre 2020 - TRACTAFRIC MORTORS CI", 'PRSC'],
    ["Convocation à l'AGO du 19 mai 2014 - TRACTAFRIC MTORS", 'PRSC'],
    ["Rapport d'activités et Attestation des CAC-1er semestre 2015 -  TMCI", 'PRSC'],
    ['SDA CI: Etats Financiers approuvés 2011', 'PRSC'],
    ['Projet de résolutions AGM du 29 juin 2018- TRACTAFRIC MOTORS CI', 'PRSC'],
    ['Prorogation - Assemblée Générale - EVIOSYS PACKAGING SIEM (EX CROWN SIEM)', 'SEMC'],
  ])('%s → %s', (libelle, code) => {
    expect(emetteurDuTitre(libelle, alias)).toBe(code);
  });
});

describe('nom du fichier, pour un document partagé sans émetteur dans le titre', () => {
  const candidats = new Set(['CFAC', 'PRSC']);
  it('tranche quand il désigne une seule des sociétés', () => {
    const url = 'https://bfin.brvm.org/0/Communiques_emetteurs/20171121%20-%20Avis%20de%20convocation%20-%20TRACTAFRIC%20MOTORS%20CI.pdf';
    expect(emetteurDuFichier(url, alias, candidats)).toBe('PRSC');
  });
  it('ne tranche pas quand le fichier ne nomme personne', () => {
    expect(emetteurDuFichier('https://bfin.brvm.org/0/x/20171121%20-%20Avis%20de%20convocation.pdf', alias, candidats)).toBeNull();
  });
  it('ignore une société nommée qui n’est pas candidate', () => {
    expect(emetteurDuFichier('https://bfin.brvm.org/0/x/Rapport%20-%20SIB%20CI.pdf', alias, candidats)).toBeNull();
  });
});

describe('le document fait foi face au titre (recoupement RichBourse)', () => {
  const codes = new Set(['SIBC', 'SGBC', 'CFAC', 'PRSC', 'ABJC', 'ECOC', 'ETIT', 'NEIC', 'SEMC', 'ORAC']);
  const a2 = construireAlias([...codes].map((code) => ({ code, designation: null as string | null })).concat([
    { code: 'NEIC', designation: 'NEI CEDA CI' }, { code: 'ORAC', designation: "ORANGE COTE D'IVOIRE" },
  ]));
  it('titre ≠ fichier → conflit, aucun rattachement (NEI-CEDA titré « ECOBANK CI »)', () => {
    const r = emetteurDuDocument("Rapport d'activités au 3ème trimestre 2020 - ECOBANK CI",
      'https://bfin.brvm.org/0/x/20201030%20-%20Rapport%20au%203%C3%A8me%20trimestre%202020%20-%20NEI-CEDA%20CI.pdf', a2, codes);
    expect(r).toMatchObject({ code: null, conflit: true, titre: 'ECOC', fichier: 'NEIC' });
  });
  it('titre et fichier d’accord → le code', () => {
    const r = emetteurDuDocument('Etats financiers - Exercice 2025 - TRACTAFRIC MOTORS CI',
      'https://bfin.brvm.org/0/x/Etats%20financiers%202025%20-%20TRACTAFRIC%20MOTORS%20CI.pdf', a2, codes);
    expect(r).toMatchObject({ code: 'PRSC', conflit: false });
  });
  it('extraction : un PDF étranger est refusé même si le titre est juste (SEMC lié au PDF d’Orange)', () => {
    expect(documentEtranger('SEMC', 'Prorogation - Assemblée Générale - EVIOSYS PACKAGING SIEM (EX CROWN SIEM)',
      'https://bfin.brvm.org/0/x/20230630%20-%20Rapport%20d%27activit%C3%A9s%20-%201er%20Trimestre%202023%20-%20ORANGE%20CI.pdf', a2, codes)).toBe('ORAC');
    expect(documentEtranger('SEMC', 'Rapport annuel 2023 - EVIOSYS PACKAGING SIEM CI',
      'https://bfin.brvm.org/0/x/Rapport%20annuel%202023%20-%20EVIOSYS%20PACKAGING%20SIEM%20CI.pdf', a2, codes)).toBeNull();
  });
});

describe('collecteur : on ne quitte la page que si titre ET fichier désignent la même société', () => {
  const codes = new Set(['ECOC', 'ETIT', 'CFAC', 'PRSC', 'SIBC', 'SGBC']);
  const a3 = construireAlias([...codes].map((code) => ({ code, designation: null as string | null })));
  it('titre seul (fichier muet) : on reste sur la page — le PDF « … : ETIT » était celui d’Ecobank CI', () => {
    expect(codeDeCollecte('ECOC', 'Etats financiers - Exercice 2017: ETIT', 'https://bfin.brvm.org/0/x/Etats%20financiers%202017.pdf', a3, codes)).toBe('ECOC');
  });
  it('titre et fichier d’accord : on rattache à la société nommée', () => {
    expect(codeDeCollecte('CFAC', 'Etats financiers - Exercice 2025 - TRACTAFRIC MOTORS CI',
      'https://bfin.brvm.org/0/x/Etats%20financiers%202025%20-%20TRACTAFRIC%20MOTORS%20CI.pdf', a3, codes)).toBe('PRSC');
  });
  it('titre et fichier en désaccord : on reste sur la page', () => {
    expect(codeDeCollecte('SGBC', 'Notation Financière - SIB CI', 'https://bfin.brvm.org/0/x/Notation%20-%20SGBCI.pdf', a3, codes)).toBe('SGBC');
  });
});

describe('lecture du nom de fichier et preuves de contenu (PDF lus le 2026-10-07)', () => {
  const codes = new Set(['ECOC', 'ETIT', 'ONTBF', 'BOAC', 'CIEC', 'TTLS', 'PRSC', 'CFAC']);
  const a4 = construireAlias([...codes].map((code) => ({ code, designation: null as string | null })));
  const B = 'https://bfin.brvm.org/0/Communiques_emetteurs/';
  it('la correspondance la plus longue l’emporte : « ECOBANK CI » n’est pas « ECOBANK »', () => {
    expect(emetteurDuFichier(`${B}ETATS%20FINANCIERS%202017%20ECOBANK%20CI.PDF`, a4, codes)).toBe('ECOC');
  });
  it('mots entiers de 3 lettres et anciens noms', () => {
    expect(emetteurDuFichier(`${B}20220429%20-%20Etats%20financiers%20%20SYSCOHADA%20exercice%202021%20-%20CIE.pdf`, a4, codes)).toBe('CIEC');
    expect(emetteurDuFichier(`${B}20180709-ONATEL%20Communique%20de%20presse%20-%20juillet%202018.pdf`, a4, codes)).toBe('ONTBF');
    expect(emetteurDuFichier(`${B}Etats%20Financiers%20PEYRISSAC%20Exo%202004%20%20%2007-06-2005.pdf`, a4, codes)).toBe('PRSC');
  });
  it('extraction : un fichier qui nomme la ligne lui appartient, même sous un titre faux', () => {
    expect(documentEtranger('ECOC', 'Etats financiers - Exercice 2017: ETIT', `${B}ETATS%20FINANCIERS%202017%20ECOBANK%20CI.PDF`, a4, codes)).toBeNull();
    expect(documentEtranger('ONTBF', 'Notation Finanière - BOA CI', `${B}20180709-ONATEL%20Communique%20de%20presse%20-%20juillet%202018.pdf`, a4, codes)).toBeNull();
    expect(documentEtranger('ETIT', 'Etats financiers - Exercice 2017: ETIT', `${B}ETATS%20FINANCIERS%202017%20ECOBANK%20CI.PDF`, a4, codes)).toBe('ECOC');
  });
  it('preuve de contenu : le document sans nom est rendu à ETI', () => {
    const url = `${B}20171031%20-%20Pr%C3%A9sentation%20R%C3%A9sultats%20Fin%20Sept%202017.pdf`;
    expect(documentEtranger('ECOC', "Rapport d'Activité du 3e trimestre 2017 - ETI TG", url, a4, codes)).toBe('ETIT');
    expect(codeDeCollecte('ECOC', "Rapport d'Activité du 3e trimestre 2017 - ETI TG", url, a4, codes)).toBe('ETIT');
  });
});

describe('contradiction entre le titre et le code rattaché', () => {
  it('signale le bon code quand le titre en nomme un autre', () => {
    expect(emetteurContredit('SGBC', 'Notation Financière - SIB CI', alias)).toBe('SIBC');
    expect(emetteurContredit('CFAC', 'Etats financiers - 3ème trimestre 2025 - TRACTAFRIC MOTORS CI', alias)).toBe('PRSC');
  });

  it('ne dit rien quand le titre confirme le code ou ne nomme personne', () => {
    expect(emetteurContredit('SIBC', 'Notation Financière - SIB CI', alias)).toBeNull();
    expect(emetteurContredit('CFAC', 'Avis de convocation', alias)).toBeNull();
  });
});
