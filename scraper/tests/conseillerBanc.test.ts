import { describe, it, expect } from 'vitest';
import { datesRebalancement, ecartsParDate, verdictBanc, construirePaniers, ecartsAchatMarche, DEBUT_HISTORIQUE, PROTOCOLE } from '../src/conseiller/banc.js';
import { indiceEquipondere } from '../src/conseiller/indice.js';
import { calendrier, univers } from './conseillerFabrique.js';

describe('datesRebalancement', () => {
  it('prend une date toutes les 20 séances, avec 21 séances de recul à la fin', () => {
    const cal = calendrier(100);
    const ds = datesRebalancement(cal, cal[0]!, 20);
    expect(ds[0]).toBe(cal[0]);
    expect(ds[1]).toBe(cal[20]);
    expect(cal.indexOf(ds.at(-1)!) + 1 + 20 < cal.length).toBe(true);
  });
});

describe('ecartsParDate', () => {
  it('fait la moyenne Acheter − moyenne Vendre, coûts déduits, et saute une date sans les deux', () => {
    const r = ecartsParDate([
      { date: 'd1', achats: [0.05, 0.03], ventes: [0.01] },
      { date: 'd2', achats: [0.02], ventes: [] },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.ecart).toBeCloseTo(0.04 - 0.01 - PROTOCOLE.cout, 10);
  });
});

describe('ecartsAchatMarche', () => {
  it('renvoie moyenne(achats) − coût pour chaque date avec achat, saute les autres', () => {
    const r = ecartsAchatMarche([
      { date: 'd1', achats: [0.05, 0.03], ventes: [] },
      { date: 'd2', achats: [], ventes: [0.01] },
      { date: 'd3', achats: [0.02], ventes: [0.5] },
    ]);
    expect(r.map((x) => x.date)).toEqual(['d1', 'd3']);
    expect(r[0]!.ecart).toBeCloseTo(0.04 - PROTOCOLE.cout, 10);
    expect(r[1]!.ecart).toBeCloseTo(0.02 - PROTOCOLE.cout, 10);
  });
  it('le début d historique est 2007-01-01', () => {
    expect(DEBUT_HISTORIQUE).toBe('2007-01-01');
  });
});

describe('verdictBanc', () => {
  it('« prouvé » si la borne basse unilatérale dépasse 0 avec ≥ 30 dates', () => {
    expect(verdictBanc(Array.from({ length: 60 }, (_, i) => 0.02 + (i % 3) * 0.001)).verdict).toBe('prouve');
  });
  it('« non prouvé » sur du bruit centré', () => {
    expect(verdictBanc(Array.from({ length: 60 }, (_, i) => (i % 2 ? 0.05 : -0.05))).verdict).toBe('non_prouve');
  });
  it('« insuffisant » sous 30 dates', () => {
    expect(verdictBanc([0.1, 0.1, 0.1]).verdict).toBe('insuffisant');
  });
});

describe('construirePaniers', () => {
  const pentes = Array.from({ length: 20 }, (_, k) => (k - 10) / 20);

  it('espace les dates de l horizon choisi (60 séances sans chevauchement)', () => {
    const d = univers(400, pentes);
    const { paniers } = construirePaniers(d, indiceEquipondere(d), { debut: d.calendrier[0]!, horizon: 60 });
    const idx = paniers.map((p) => d.calendrier.indexOf(p.date));
    expect(idx.length).toBeGreaterThan(2);
    for (let i = 1; i < idx.length; i++) expect(idx[i]! - idx[i - 1]!).toBeGreaterThanOrEqual(60);
  });

  it('ignore une date dont la sortie dépasse la fin demandée', () => {
    const d = univers(300, pentes);
    const fin = d.calendrier[100]!;
    const { paniers } = construirePaniers(d, indiceEquipondere(d), { debut: d.calendrier[0]!, fin });
    expect(paniers.length).toBeGreaterThan(0);
    for (const p of paniers) expect(d.calendrier.indexOf(p.date) + 1 + PROTOCOLE.horizon).toBeLessThanOrEqual(100);
  });

  it('exclureCD retire les valeurs C/D de l univers au lieu de les compter en Conserver', () => {
    const d = univers(200, pentes);
    for (const v of d.series.values()) {
      v.volumes = v.volumes.map(() => 100000);
      v.valeurs = v.cours.map((c) => c * 100000);
    }
    for (const code of ['V15', 'V16', 'V17', 'V18', 'V19']) {
      const v = d.series.get(code)!;
      for (let i = 0; i < v.volumes.length; i++) if (i % 10 !== 0) { v.volumes[i] = 0; v.valeurs[i] = 0; }
    }
    const ind = indiceEquipondere(d);
    const opts = { debut: d.calendrier[150]!, fin: d.calendrier[199]! };
    const avec = construirePaniers(d, ind, opts).conserves.get('2020')!;
    const sans = construirePaniers(d, ind, { ...opts, exclureCD: true }).conserves.get('2020')!;
    expect(avec.total).toBeGreaterThan(sans.total);
    expect(sans.total).toBe(avec.total - 5 * (avec.total / 20));
  });
});
