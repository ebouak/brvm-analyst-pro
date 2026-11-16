import { describe, expect, it } from 'vitest';
import {
  agreger,
  bornesPeriode,
  cleIntervalle,
  debutPeriode,
  normaliserSeances,
  partOhlc,
  periodeCouverte,
  variationPeriode,
  type LigneCours,
} from './donnees';
import { avancerDate, dateVersLogique, logiqueVersDate, mesurer, niveauxFibonacci } from './geometrie';
import { alignerSur, base100, ecartFinal, rebaserTout } from './comparaison';
import { construireTableau, nomFichier, versCsv, versTxt, versXlsx } from './exports';
import { deplacerDessin, validerDessins } from './dessins';

const L = (date: string, c: number | null, o?: number | null, h?: number | null, b?: number | null, extra: Partial<LigneCours> = {}): LigneCours => ({
  date_marche: date,
  cours_jour: c,
  ouverture: o ?? null,
  plus_haut: h ?? null,
  plus_bas: b ?? null,
  variation_pct: null,
  volume: 10,
  valeur_echangee: 1000,
  ...extra,
});

describe('normaliserSeances', () => {
  it('écarte les clôtures nulles, nulles à zéro, trie et dédoublonne', () => {
    const s = normaliserSeances([L('2026-01-06', 110), L('2026-01-05', 100), L('2026-01-07', 0), L('2026-01-08', null), L('2026-01-06', 111)]);
    expect(s.map((x) => [x.date, x.cloture])).toEqual([
      ['2026-01-05', 100],
      ['2026-01-06', 111],
    ]);
  });
  it("ne garde l'OHLC que complet et cohérent", () => {
    const [a, b, c] = normaliserSeances([
      L('2026-01-05', 100, 98, 102, 97),
      L('2026-01-06', 100, 98, null, 97), // incomplet
      L('2026-01-07', 100, 98, 99, 97), // haut < clôture : incohérent
    ]);
    expect([a!.ouverture, a!.haut, a!.bas]).toEqual([98, 102, 97]);
    expect([b!.ouverture, b!.haut, b!.bas]).toEqual([null, null, null]);
    expect([c!.ouverture, c!.haut, c!.bas]).toEqual([null, null, null]);
  });
  it('lit les nombres renvoyés en texte par PostgREST', () => {
    const [s] = normaliserSeances([{ date_marche: '2026-01-05', cours_jour: '1250.5', volume: '30', variation_pct: '-1.2', valeur_echangee: null }]);
    expect(s).toMatchObject({ cloture: 1250.5, volume: 30, variationPct: -1.2, valeur: null });
  });
});

describe('agreger', () => {
  const seances = normaliserSeances([
    L('2026-01-05', 100, 99, 101, 98, { variation_pct: 1 }), // lundi S2
    L('2026-01-06', 104, 100, 105, 99),
    L('2026-01-09', 103, 104, 106, 102), // vendredi S2
    L('2026-01-12', 110, 103, 111, 103), // lundi S3
    L('2026-01-13', 108, null, null, null, { volume: null }),
    L('2026-02-02', 120, 118, 121, 117),
  ]);
  it('jour : une barre par séance, variation publiée', () => {
    const b = agreger(seances, 'jour');
    expect(b).toHaveLength(6);
    expect(b[0]!.variationPct).toBe(1);
  });
  it('semaine : OHLC agrégé, volume sommé, clé lundi ISO', () => {
    expect(cleIntervalle('2026-01-09', 'semaine')).toBe('2026-01-05');
    expect(cleIntervalle('2026-01-11', 'semaine')).toBe('2026-01-05'); // dimanche
    const b = agreger(seances, 'semaine');
    expect(b).toHaveLength(3);
    expect(b[0]).toMatchObject({ date: '2026-01-09', debut: '2026-01-05', ouverture: 99, haut: 106, bas: 98, cloture: 103, volume: 30, valeur: 3000, nbSeances: 3, variationPct: null });
    // S3 : une séance sans OHLC ni volume => pas de mèche, pas de somme partielle
    expect(b[1]).toMatchObject({ date: '2026-01-13', ouverture: null, haut: null, bas: null, cloture: 108, volume: null });
    expect(b[1]!.variationPct).toBeCloseTo(((108 - 103) / 103) * 100, 10);
  });
  it('mois : regroupe par mois calendaire', () => {
    const b = agreger(seances, 'mois');
    expect(b.map((x) => [x.debut, x.date, x.cloture])).toEqual([
      ['2026-01-05', '2026-01-13', 108],
      ['2026-02-02', '2026-02-02', 120],
    ]);
    expect(partOhlc(b)).toBe(0.5);
  });
});

describe('périodes', () => {
  it('début de période, fin de mois bornée', () => {
    expect(debutPeriode('2026-11-13', '1M')).toBe('2026-10-13');
    expect(debutPeriode('2026-03-31', '1M')).toBe('2026-02-28');
    expect(debutPeriode('2026-11-13', '10A')).toBe('2016-11-13');
    expect(debutPeriode('2026-11-13', 'MAX')).toBeNull();
  });
  it('une période plus longue que l’historique est déclarée non couverte', () => {
    expect(periodeCouverte('2022-12-30', '2026-11-13', '3A')).toBe(true);
    expect(periodeCouverte('2022-12-30', '2026-11-13', '5A')).toBe(false);
    expect(periodeCouverte('2022-12-30', '2026-11-13', 'MAX')).toBe(true);
  });
  it('bornes et variation sur la période', () => {
    const b = agreger(normaliserSeances([L('2026-09-01', 100), L('2026-10-20', 120), L('2026-11-13', 90)]), 'jour');
    expect(bornesPeriode(b, '1M')).toEqual([1, 2]);
    const v = variationPeriode(b, 1, 2)!;
    expect(v.ecart).toBe(-30);
    expect(v.ecartPct).toBeCloseTo(-25, 10);
    expect(variationPeriode(b, 2, 2)).toBeNull();
  });
});

describe('géométrie', () => {
  const barres = [{ date: '2026-11-11' }, { date: '2026-11-12' }, { date: '2026-11-13' }];
  it('jours ouvrés : vendredi + 1 = lundi', () => {
    expect(avancerDate('2026-11-13', 1, 'jour')).toBe('2026-11-16');
    expect(avancerDate('2026-01-31', 1, 'mois')).toBe('2026-02-28');
  });
  it('date ↔ position logique, extrapolation à droite', () => {
    expect(dateVersLogique(barres, '2026-11-12', 'jour')).toBe(1);
    expect(dateVersLogique(barres, '2026-11-17', 'jour')).toBe(4);
    expect(logiqueVersDate(barres, 4.2, 'jour')).toBe('2026-11-17');
    expect(logiqueVersDate(barres, -3, 'jour')).toBe('2026-11-11');
  });
  it('Fibonacci : 0 % au second point, 100 % au premier', () => {
    const n = niveauxFibonacci({ t: '2026-01-01', p: 1000 }, { t: '2026-06-01', p: 2000 });
    expect(n.map((x) => x.libelle)).toEqual(['0 %', '23,6 %', '38,2 %', '50 %', '61,8 %', '78,6 %', '100 %']);
    expect(n[0]!.prix).toBe(2000);
    expect(n[2]!.prix).toBeCloseTo(1618, 6);
    expect(n[6]!.prix).toBe(1000);
  });
  it('mesure : écart signé, % et séances cotées', () => {
    const seances = [{ date: '2026-11-10' }, { date: '2026-11-11' }, { date: '2026-11-13' }];
    const m = mesurer({ t: '2026-11-13', p: 110 }, { t: '2026-11-10', p: 100 }, seances);
    expect(m).toMatchObject({ ecart: 10, seances: 2, debut: '2026-11-10', fin: '2026-11-13' });
    expect(m.ecartPct).toBeCloseTo(10, 10);
  });
});

describe('base 100', () => {
  it('rebase sur la première date commune de la fenêtre', () => {
    const a = [
      { date: '2026-05-20', valeur: 50 },
      { date: '2026-05-26', valeur: 80 },
      { date: '2026-05-27', valeur: 88 },
    ];
    const b = [
      { date: '2026-05-26', valeur: 200 },
      { date: '2026-05-27', valeur: 190 },
    ];
    const r = base100(a, b, '2026-05-01', null)!;
    expect(r.dateBase).toBe('2026-05-26');
    expect(r.principale.map((p) => p.valeur)).toEqual([100, 110.00000000000001]);
    expect(r.comparee.map((p) => p.valeur)).toEqual([100, 95]);
    expect(ecartFinal(r)).toMatchObject({ date: '2026-05-27', comparee: 95 });
  });
  it('rebase une série entière sans couper l’axe des temps', () => {
    const s = [{ date: '2026-01-01', valeur: 50 }, { date: '2026-01-02', valeur: 100 }, { date: '2026-01-03', valeur: 150 }];
    expect(rebaserTout(s, '2026-01-02')!.map((p) => p.valeur)).toEqual([50, 100, 150]);
    expect(rebaserTout(s, '2026-02-01')).toBeNull();
  });
  it('aligne une série sur les barres sans reporter d’une période sur l’autre', () => {
    const indice = [{ date: '2026-01-05', valeur: 10 }, { date: '2026-01-07', valeur: 12 }, { date: '2026-01-14', valeur: 13 }];
    const semaine = (a: string, b: string) => cleIntervalle(a, 'semaine') === cleIntervalle(b, 'semaine');
    // barres hebdo datées de leur dernière séance : S2 (09/01), S3 (16/01), S4 (23/01)
    expect(alignerSur(['2026-01-09', '2026-01-16', '2026-01-23'], indice, semaine)).toEqual([
      { date: '2026-01-09', valeur: 12 },
      { date: '2026-01-16', valeur: 13 },
    ]);
    const jour = (a: string, b: string) => a === b;
    expect(alignerSur(['2026-01-05', '2026-01-06'], indice, jour)).toEqual([{ date: '2026-01-05', valeur: 10 }]);
  });
  it('sans date commune : pas de comparaison', () => {
    expect(base100([{ date: '2026-01-01', valeur: 1 }], [{ date: '2026-01-02', valeur: 1 }], null, null)).toBeNull();
  });
});

describe('exports', () => {
  const barres = agreger(
    normaliserSeances([
      L('2026-11-12', 1250.5, null, null, null, { variation_pct: 1.234, volume: 30, valeur_echangee: null }),
      L('2026-11-13', 1260, 1250, 1270, 1240, { variation_pct: 0.76, volume: 12, valeur_echangee: 15120 }),
    ]),
    'jour',
  );
  const meta = { code: 'SNTS', designation: 'SONATEL; SA', intervalle: 'jour' as const, extraitLe: new Date(Date.UTC(2026, 10, 16, 9, 5)) };
  const t = construireTableau(barres, meta);
  it('mentionne source et date d’extraction, cellules absentes vides', () => {
    expect(t.mentions.join('\n')).toContain('Source : Bourse Régionale des Valeurs Mobilières');
    expect(t.mentions.join('\n')).toContain('Extraction : 16/11/2026 à 09:05 UTC');
    expect(t.lignes[0]).toEqual(['2026-11-12', null, null, null, 1250.5, 1.23, 30, null]);
  });
  it('CSV : BOM, point-virgule, virgule décimale, échappement', () => {
    const csv = versCsv(t);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Cours SNTS — SONATEL; SA"');
    expect(csv).toContain('2026-11-12;;;;1250,5;1,23;30;\r\n');
    expect(csv).toContain('Date;Ouverture;Plus haut;Plus bas;Clôture;Variation (%);Volume (titres);Valeur échangée (FCFA)');
  });
  it('TXT : tabulé', () => {
    expect(versTxt(t)).toContain('2026-11-13\t1250\t1270\t1240\t1260\t0,76\t12\t15120');
  });
  it('nom de fichier', () => {
    expect(nomFichier(t, meta, 'csv')).toBe('SNTS_cours_jour_2026-11-12_2026-11-13.csv');
  });
  it('XLSX relu : mentions, en-tête et valeurs numériques', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const buf = await versXlsx(t);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Cours')!;
    const textes = new Map<number, string>();
    ws.eachRow((r, n) => textes.set(n, String(r.getCell(1).value)));
    expect([...textes.values()].some((x) => x.startsWith('Source :'))).toBe(true);
    const idx = [...textes.entries()].find(([, v]) => v === 'Date')![0];
    const ligne = ws.getRow(idx + 2);
    expect(ligne.getCell(5).value).toBe(1260);
    expect(ligne.getCell(1).value).toBeInstanceOf(Date);
    expect(ws.getRow(idx + 1).getCell(2).value).toBeNull();
  }, 30_000);
});

describe('dessins', () => {
  it('revalide le JSON lu en base', () => {
    const d = validerDessins([
      { id: 'a1', type: 'horizontale', a: { t: '2026-11-13', p: 100 }, couleur: 'warn', epaisseur: 2 },
      { id: 'a2', type: 'tendance', a: { t: '2026-11-13', p: 100 } }, // b manquant
      { id: 'a3', type: 'inconnu', a: { t: '2026-11-13', p: 100 } },
      { id: 'a4', type: 'texte', a: { t: '2026-11-13', p: 100 }, texte: '  x  ', couleur: '<script>' },
      { id: '<x>', type: 'horizontale', a: { t: '2026-11-13', p: 100 } },
      'n’importe quoi',
    ]);
    expect(d.map((x) => x.id)).toEqual(['a1', 'a4']);
    expect(d[1]).toMatchObject({ texte: 'x', couleur: 'accent', epaisseur: 1 });
    expect(validerDessins(null)).toEqual([]);
  });
  it('déplacement en temps et en prix', () => {
    const d = deplacerDessin({ id: 'a', type: 'segment', a: { t: '2026-11-12', p: 100 }, b: { t: '2026-11-13', p: 200 }, couleur: 'accent', epaisseur: 1 }, (t) => avancerDate(t, 1, 'jour'), 1.1);
    expect(d.a).toEqual({ t: '2026-11-13', p: 110.00000000000001 });
    expect(d.b!.t).toBe('2026-11-16');
  });
});
