import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { FragmentPdf } from '../src/carnet/parse.js';
import { natureCle, parseAssemblees } from '../src/boc/assemblees.js';
import { echeance, parseInformations, typeOperation } from '../src/boc/informations.js';
import { codeEmetteur, estEmetteurHorsActions } from '../src/boc/noms.js';
import {
  agAttenduesLe, cleNaturelleAvis, cleNaturelleOperation, fusionnerAvis, fusionnerSuivi, preparer,
} from '../src/boc/versBase.js';
import { cellules, dateEnTete, dateFr, dateLongue, joindre, lignes } from '../src/boc/tableau.js';

/**
 * Fixture : bulletin RÉEL du 22/09/2026 (tests/fixtures/boc_20260922.pdf),
 * pages 10 (Informations), 17 et 18 (Calendrier des AG). Fragments extraits
 * avec leur position — même forme que ce que pdfjs rend en production.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const brut = JSON.parse(readFileSync(join(__dirname, 'fixtures/boc-20260922-ag-infos.json'), 'utf8')) as {
  page: number;
  items: { s: string; x: number; y: number }[];
}[];

/** Les 20 pages du bulletin ; celles absentes de la fixture sont vides. */
function pagesDuBulletin(): FragmentPdf[][] {
  const pages: FragmentPdf[][] = Array.from({ length: 20 }, () => []);
  for (const p of brut) pages[p.page - 1] = p.items.map((i) => ({ x: i.x, y: i.y, texte: i.s }));
  return pages;
}

const F = (y: number, paires: [number, string][]): FragmentPdf[] => paires.map(([x, texte]) => ({ x, y, texte }));

describe('calendrier des AG — bulletin réel du 22/09/2026', () => {
  const res = parseAssemblees(pagesDuBulletin());

  it('lit les 49 AG sur les pages 17 et 18, sans rejet', () => {
    // 49 = compte indépendant par pdftotext sur les mêmes pages.
    expect(res.lignes).toHaveLength(49);
    expect(res.pages).toEqual([17, 18]);
    expect(res.rejets).toEqual([]);
  });

  it('lit la date de RÉUNION, l’heure, la nature et le lieu', () => {
    expect(res.lignes[0]).toEqual({
      societe: 'SONATEL', nature: 'Extraordinaire', natureCle: 'extraordinaire',
      date: '2026-10-08', heure: '15:00:00',
      lieu: 'VISIOCONFERENCE, au 64, Voie de Dégagement Nord', annee: 2026,
    });
  });

  it('recolle un lieu écrit sur plusieurs lignes', () => {
    const bollore = res.lignes.find((l) => l.societe === 'BOLLORE TRANSPORT & LOGISTICS')!;
    expect(bollore.lieu).toBe('Amphithéâtre de l’immeuble CRRAE-UMOA, sis au Plateau, Avenue Delafosse, à Abidjan');
    expect(bollore.natureCle).toBe('mixte');
  });

  it('recolle sans espace un mot coupé par un trait d’union (adresse électronique comprise)', () => {
    const orange = res.lignes.find((l) => l.societe === 'ORANGE CI')!;
    expect(orange.lieu).toContain('ag2026-orangeci@quorumenligne.com');
  });

  it('suit le tableau sur la page de suite SANS en-tête, jusqu’à la dernière ligne', () => {
    const p18 = res.lignes.filter((l) => l.date <= '2026-04-29');
    expect(p18[0]?.societe).toBe('ORANGE CI'); // dernière ligne de la page 17
    expect(res.lignes[res.lignes.length - 1]).toMatchObject({ societe: 'BANK OF AFRICA BF', date: '2026-03-23' });
  });

  it('distingue deux AG d’une même société (ECOBANK TG : extraordinaire et ordinaire)', () => {
    const eti = res.lignes.filter((l) => l.societe === 'ECOBANK TG').map((l) => `${l.date} ${l.natureCle}`);
    expect(eti).toEqual(['2026-08-13 extraordinaire', '2026-06-03 ordinaire', '2026-05-07 extraordinaire']);
  });

  it('rattache CHAQUE société du calendrier à un code coté', () => {
    const sansCode = res.lignes.filter((l) => codeEmetteur(l.societe) == null).map((l) => l.societe);
    expect(sansCode).toEqual([]);
    // 49 AG, 46 sociétés distinctes (SONATEL : 2 AG, ECOBANK TG : 3) → 46 codes,
    // sans qu'aucun code ne soit attribué à deux noms.
    expect(new Set(res.lignes.map((l) => l.societe)).size).toBe(46);
    expect(new Set(res.lignes.map((l) => codeEmetteur(l.societe))).size).toBe(46);
  });

  it('ne lit pas de page de suite si la page suivante n’a aucune ligne d’AG', () => {
    const pages = pagesDuBulletin();
    pages[17] = F(700, [[16, 'AFRICABOURSE ASSET'], [120, 'FCP AAM EPARGNE'], [400, '13 757,22']]);
    const r = parseAssemblees(pages);
    expect(r.pages).toEqual([17]);
    expect(r.lignes.at(-1)?.societe).toBe('ORANGE CI');
  });

  it('nomme une ligne sans société au lieu de l’inventer', () => {
    const r = parseAssemblees([[
      ...F(760, [[16, 'ANNEE : 2026']]),
      ...F(746, [[16, 'Société'], [152, 'Nature'], [258, 'Date'], [336, 'Heure'], [401, 'Lieu']]),
      ...F(731, [[152, 'Ordinaire'], [258, '08/10/2026'], [336, '15:00:00'], [401, 'Dakar']]),
    ]]);
    expect(r.lignes).toEqual([]);
    expect(r.rejets[0]).toContain('société ou nature absente');
  });
});

describe('page Informations — bulletin réel du 22/09/2026', () => {
  const res = parseInformations(pagesDuBulletin());

  it('reconnaît les trois sections de la page 10, sans rejet', () => {
    expect(res.pages).toEqual([10]);
    expect(res.sections).toEqual(['OPERATIONS EN COURS', 'AVIS', 'COMMUNIQUES']);
    expect(res.rejets).toEqual([]);
  });

  it('lit les 5 opérations en cours, texte recollé, type et échéance', () => {
    expect(res.operations.map((o) => [o.emetteur, o.typeOperation, o.dateOperation])).toEqual([
      ['TPCI', 'premiere_cotation', '2026-09-25'],
      ['BRVM', 'premiere_cotation', '2026-09-24'],
      ['ETAT DU SENEGAL', 'premiere_cotation', '2026-09-22'],
      ['VIVO ENERGY CI', 'dividende', '2026-09-25'],
      ['SERVAIR ABIDJAN CI', 'dividende', '2026-09-30'],
    ]);
    expect(res.operations[3]?.operation).toBe(
      'Paiement de dividendes de 96,67 F CFA par action (IRVM applicable de 12 % pour les personnes physiques et 10 % pour les personnes morales), le 25/09/2026',
    );
  });

  it('lit les 4 avis numérotés, objet recollé sur trois lignes', () => {
    expect(res.avis.map((a) => [a.categorie, a.entite, a.numero, a.nature])).toEqual([
      ['avis', 'BRVM', '277-2026', 'Première cotation'],
      ['avis', 'BRVM', '278-2026', 'Paiement Intérêts'],
      ['avis', 'BRVM', '279-2026', 'Paiement Intérêts'],
      ['avis', 'BRVM', '280-2026', 'Paiement Intérêts'],
    ]);
    expect(res.avis[0]?.objet).toBe(
      'Résultats de première cotation - « ETAT DU SENEGAL 6,40 % 2026-2029 », « ETAT DU SENEGAL 6,60 % 2026-2031 », « ETAT DU SENEGAL 6,75 % 2026-2033 » et « ETAT DU SENEGAL 6,95 % 2026-2036 »',
    );
  });

  it('lit un communiqué d’émetteur', () => {
    const r = parseInformations([[
      ...F(500, [[16, 'COMMUNIQUES']]),
      ...F(486, [[16, 'Emetteur'], [72, 'N°'], [169, 'Nature'], [308, 'Objet']]),
      ...F(470, [[16, 'SONATEL'], [72, '12-2026'], [169, 'Communiqué'], [308, 'Fractionnement du nominal de l’action']]),
      ...F(462, [[308, 'SONATEL par 10']]),
    ]]);
    expect(r.avis).toEqual([{
      categorie: 'communique', entite: 'SONATEL', numero: '12-2026', nature: 'Communiqué',
      objet: 'Fractionnement du nominal de l’action SONATEL par 10',
    }]);
  });

  it('ferme une section devant un titre INCONNU au lieu de le coller à l’émetteur précédent', () => {
    const r = parseInformations([[
      ...F(700, [[16, 'OPERATIONS EN COURS']]),
      ...F(686, [[16, 'Emetteur'], [190, 'Opération']]),
      ...F(670, [[16, 'SONATEL'], [190, 'Paiement de dividendes, le 15/05/2026']]),
      ...F(640, [[16, 'SUSPENSIONS']]),
      ...F(620, [[16, 'XYZ'], [190, 'Suspension de cotation']]),
    ]]);
    expect(r.operations).toHaveLength(1);
    expect(r.operations[0]?.emetteur).toBe('SONATEL');
    expect(r.rejets[0]).toContain('SUSPENSIONS');
  });

  it('suit des avis qui débordent sur la page suivante', () => {
    const p1 = [
      ...F(300, [[16, 'AVIS']]),
      ...F(286, [[16, 'Entité'], [72, 'N°'], [169, 'Nature'], [308, 'Objet']]),
      ...F(270, [[16, 'BRVM'], [72, '300-2026'], [169, 'Dividende'], [308, 'Paiement de dividendes - SONATEL']]),
    ];
    const p2 = [
      ...F(801, [[457, 'mardi 22 septembre 2026']]),
      ...F(788, [[16, 'BRVM'], [72, '301-2026'], [169, 'Dividende'], [308, 'Paiement de dividendes - ORANGE CI']]),
      ...F(30, [[290, '11']]),
    ];
    const r = parseInformations([p1, p2]);
    expect(r.pages).toEqual([1, 2]);
    expect(r.avis.map((a) => a.numero)).toEqual(['300-2026', '301-2026']);
  });
});

describe('échéance d’une opération', () => {
  it('prend la dernière date écrite après « le », ignore les millésimes d’emprunt', () => {
    expect(echeance('TPCI 5,45 % 2026-2031 - Première cotation le 25 septembre 2026')).toBe('2026-09-25');
    expect(echeance('Paiement de dividendes de 229 F CFA par action, le 30/09/2026')).toBe('2026-09-30');
    expect(echeance('Paiement le 1er octobre 2026')).toBe('2026-10-01');
    expect(echeance('Emprunt 6,40 % 2026-2029')).toBeNull();
  });
  it('refuse une date impossible', () => {
    expect(echeance('Paiement le 31/02/2026')).toBeNull();
  });
});

describe('petits lecteurs', () => {
  it('nature de l’AG', () => {
    expect(natureCle('Ordinaire')).toBe('ordinaire');
    expect(natureCle('Extraordinaire')).toBe('extraordinaire');
    expect(natureCle('Mixte')).toBe('mixte');
    expect(natureCle('Ordinaire et Extraordinaire')).toBe('mixte');
    expect(natureCle('Spéciale')).toBe('autre');
  });
  it('type d’opération', () => {
    expect(typeOperation('Paiement des intérêts semestriels - TPBF')).toBe('interets');
    expect(typeOperation('Augmentation de capital par incorporation')).toBe('augmentation_capital');
    expect(typeOperation('Divers')).toBe('autre');
  });
  it('dates', () => {
    expect(dateFr('08/10/2026')).toBe('2026-10-08');
    expect(dateFr('31/04/2026')).toBeNull();
    expect(dateLongue('22 septembre 2026')).toBe('2026-09-22');
    expect(dateLongue('5 août 2026')).toBe('2026-08-05');
  });
  it('date de séance en tête de page', () => {
    expect(dateEnTete(lignes(pagesDuBulletin()[9]!))).toBe('2026-09-22');
  });
  it('reconnaît un en-tête dont pdfjs a coupé un libellé en deux', () => {
    const r = parseInformations([[
      ...F(300, [[16, 'AVIS']]),
      ...F(286, [[16, 'Entité'], [72, 'N'], [79, '°'], [169, 'Nature'], [308, 'Objet']]),
      ...F(270, [[16, 'BRVM'], [72, '277-2026'], [169, 'Cotation'], [308, 'Résultats']]),
    ]]);
    expect(r.avis.map((a) => a.numero)).toEqual(['277-2026']);
  });
  it('colle deux fragments jointifs d’un même mot, sépare les autres', () => {
    const l = lignes([
      { x: 16, y: 500, texte: 'Résul', largeur: 20 },
      { x: 36, y: 500, texte: 'tats', largeur: 15 },
      { x: 60, y: 500, texte: 'définitifs' },
    ]);
    expect(cellules(l[0]!, [{ nom: 'Objet', x: 16 }])).toEqual(['Résultats définitifs']);
  });
  it('recolle les lignes de suite', () => {
    expect(joindre('Abidjan-', 'Plateau')).toBe('Abidjan-Plateau');
    expect(joindre('Première cotation -', 'TPCI')).toBe('Première cotation - TPCI');
    expect(joindre(null, 'Dakar')).toBe('Dakar');
  });
  it('noms d’émetteurs : table curée, aucun repli flou', () => {
    expect(codeEmetteur('TOTAL')).toBe('TTLC');
    expect(codeEmetteur('TOTALENERGIES MARKETING SN')).toBe('TTLS');
    expect(codeEmetteur('ECOBANK TG')).toBe('ETIT');
    expect(codeEmetteur('Ecobank CI')).toBe('ECOC');
    expect(codeEmetteur('SONATELL')).toBeNull();
    expect(codeEmetteur('NSBC', new Set(['NSBC']))).toBe('NSBC');
    expect(estEmetteurHorsActions('ETAT DU SENEGAL')).toBe(true);
    expect(estEmetteurHorsActions('TPCI')).toBe(true);
    expect(estEmetteurHorsActions('SONATEL')).toBe(false);
  });
});

describe('préparation et fusion avec la base', () => {
  const id = (s: string) => s; // empreinte identité : clés lisibles dans les tests
  const ag = parseAssemblees(pagesDuBulletin());
  const infos = parseInformations(pagesDuBulletin());

  it('prépare les lignes du bulletin, émetteurs hors actions non signalés', () => {
    const p = preparer({ assemblees: ag.lignes, operations: infos.operations, avis: infos.avis }, '2026-09-22', id);
    expect(p.assemblees).toHaveLength(49);
    expect(p.operations).toHaveLength(5);
    expect(p.avis).toHaveLength(4);
    // TPCI, BRVM, ETAT DU SENEGAL : sans code, et c'est normal.
    expect(p.nonRapproches).toEqual([]);
    expect(p.assemblees[0]).toMatchObject({
      cle: 'ag|SONATEL|2026-10-08|extraordinaire', code: 'SNTS', date_ag: '2026-10-08',
      premier_bulletin: '2026-09-22', dernier_bulletin: '2026-09-22',
    });
    expect(p.operations.find((o) => o.emetteur === 'VIVO ENERGY CI')).toMatchObject({ code: 'SHEC', type_operation: 'dividende' });
    expect(p.avis[0]?.cle).toBe('avis|BRVM|277-2026');
  });

  it('signale un émetteur coté inconnu, pas un émetteur obligataire', () => {
    const p = preparer({
      assemblees: [{ societe: 'NOUVELLE SA', nature: 'Ordinaire', natureCle: 'ordinaire', date: '2026-12-01', heure: null, lieu: null, annee: 2026 }],
      operations: [{ emetteur: 'ETAT DU MALI', operation: 'Première cotation le 2 décembre 2026', typeOperation: 'premiere_cotation', dateOperation: '2026-12-02' }],
      avis: [],
    }, '2026-11-10', id);
    expect(p.nonRapproches).toEqual(['NOUVELLE SA']);
    expect(p.assemblees[0]?.code).toBeNull();
  });

  it('fusionne deux fois la même clé d’un bulletin en une seule ligne', () => {
    const l = ag.lignes[0]!;
    const p = preparer({ assemblees: [l, { ...l, lieu: 'Dakar' }], operations: [], avis: [] }, '2026-09-22', id);
    expect(p.assemblees).toHaveLength(1);
    expect(p.assemblees[0]?.lieu).toBe('Dakar');
  });

  it('élargit les bornes de bulletins quel que soit l’ordre de lecture', () => {
    const base = { cle: 'k', lieu: 'récent', premier_bulletin: '2026-09-20', dernier_bulletin: '2026-11-10' };
    // Reprise d'antériorité : on lit un bulletin PLUS ANCIEN après coup.
    const vieux = fusionnerSuivi({ ...base, lieu: 'ancien', premier_bulletin: '2026-06-02', dernier_bulletin: '2026-06-02' }, base);
    expect(vieux).toEqual({ cle: 'k', lieu: 'récent', premier_bulletin: '2026-06-02', dernier_bulletin: '2026-11-10' });
    // Passage quotidien : un bulletin plus récent apporte son contenu.
    const neuf = fusionnerSuivi({ ...base, lieu: 'corrigé', premier_bulletin: '2026-11-11', dernier_bulletin: '2026-11-11' }, base);
    expect(neuf).toEqual({ cle: 'k', lieu: 'corrigé', premier_bulletin: '2026-09-20', dernier_bulletin: '2026-11-11' });
    expect(fusionnerSuivi(base, undefined)).toBe(base);
  });

  it('un avis garde la date de sa PREMIÈRE parution', () => {
    const a = { cle: 'a', categorie: 'avis' as const, entite: 'BRVM', code: null, numero: '277-2026', nature: 'X', objet: 'v2', date_bulletin: '2026-09-23' };
    expect(fusionnerAvis(a, { ...a, objet: 'v1', date_bulletin: '2026-09-22' })).toMatchObject({ objet: 'v2', date_bulletin: '2026-09-22' });
  });

  it('clés naturelles stables malgré casse, accents et espaces', () => {
    expect(cleNaturelleOperation({ emetteur: 'Vivo  Energy CI', operation: 'Paiement  de dividendes' }))
      .toBe(cleNaturelleOperation({ emetteur: 'VIVO ENERGY CI', operation: 'PAIEMENT DE DIVIDENDES' }));
    expect(cleNaturelleAvis({ categorie: 'avis', entite: 'BRVM', numero: '277 - 2026', objet: 'x' })).toBe('avis|BRVM|277-2026');
    expect(cleNaturelleAvis({ categorie: 'communique', entite: 'Sonatel', numero: null, objet: 'Résultats' })).toBe('communique|SONATEL|objet:RESULTATS');
  });

  it('calendrier des AG exigé de mars à décembre seulement', () => {
    expect(agAttenduesLe('2026-01-15')).toBe(false);
    expect(agAttenduesLe('2026-03-02')).toBe(true);
  });
});
