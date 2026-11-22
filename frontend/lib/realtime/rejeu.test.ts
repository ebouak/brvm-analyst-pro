import { describe, it, expect } from 'vitest';
import { construireRejeu, lignesAuMoment, directionsEntre, veilleDepuisVariation, veillesDe } from './rejeu';

const t1 = '2026-11-20T09:15:00+00:00';
const t2 = '2026-11-20T09:30:00+00:00';
const t3 = '2026-11-20T09:45:00+00:00';
const t4 = '2026-11-20T21:30:00+00:00';

describe('construireRejeu', () => {
  it('une image par relevé, dans l’ordre du temps', () => {
    const images = construireRejeu([
      { code: 'SNTS', captured_at: t2, close: 25900, volume: 20 },
      { code: 'SNTS', captured_at: t1, close: 25800, volume: 10 },
      { code: 'ORAC', captured_at: t1, close: 15000, volume: 5 },
    ]);
    expect(images.map((i) => i.t)).toEqual([t1, t2]);
    expect(images[0]!.cours).toEqual({ SNTS: 25800, ORAC: 15000 });
  });

  it('une valeur absente d’un relevé garde son dernier cours', () => {
    const images = construireRejeu([
      { code: 'SNTS', captured_at: t1, close: 25800 },
      { code: 'ORAC', captured_at: t1, close: 15000 },
      { code: 'SNTS', captured_at: t2, close: 25900 },
    ]);
    expect(images[1]!.cours).toEqual({ SNTS: 25900, ORAC: 15000 });
  });

  it('fusionne les relevés identiques (passages après la clôture)', () => {
    const images = construireRejeu([
      { code: 'SNTS', captured_at: t1, close: 25800, volume: 10 },
      { code: 'SNTS', captured_at: t3, close: 25900, volume: 30 },
      { code: 'SNTS', captured_at: t4, close: 25900, volume: 30 },
    ]);
    expect(images.map((i) => i.t)).toEqual([t1, t3]);
  });

  it('ignore les cours nuls ou absents (trou de collecte)', () => {
    const images = construireRejeu([
      { code: 'SNTS', captured_at: t1, close: 25800 },
      { code: 'SNTS', captured_at: t2, close: null },
      { code: 'SNTS', captured_at: t3, close: '0' },
    ]);
    expect(images).toHaveLength(1);
  });

  it('accepte les nombres renvoyés en texte', () => {
    expect(construireRejeu([{ code: 'SNTS', captured_at: t1, close: '25800.0000' }])[0]!.cours.SNTS).toBe(25800);
  });
});

describe('lignesAuMoment', () => {
  const base = [
    { code: 'SNTS', designation: 'SONATEL', cours_jour: 26000, variation_pct: 1.96, volume: 900 },
    { code: 'ORAC', designation: 'ORANGE CI', cours_jour: 14900, variation_pct: -0.67, volume: 300 },
  ];
  const veilles = { SNTS: 25500, ORAC: 15000 };

  it('recalcule cours et variation contre la veille, garde les champs serveur', () => {
    const lignes = lignesAuMoment(base, { t: t1, cours: { SNTS: 25800 }, volumes: { SNTS: 10 } }, veilles);
    expect(lignes[0]!.designation).toBe('SONATEL');
    expect(lignes[0]!.cours_jour).toBe(25800);
    expect(lignes[0]!.variation_pct).toBeCloseTo((25800 / 25500 - 1) * 100);
    expect(lignes[0]!.volume).toBe(10);
  });

  it('avant son premier relevé, une valeur vaut la veille, variation nulle', () => {
    const lignes = lignesAuMoment(base, { t: t1, cours: { SNTS: 25800 }, volumes: {} }, veilles);
    expect(lignes[1]!.cours_jour).toBe(15000);
    expect(lignes[1]!.variation_pct).toBe(0);
    expect(lignes[1]!.volume).toBe(0);
  });

  it('capitaux et transactions inconnus à cet instant : null, pas le chiffre du soir', () => {
    const avecCapitaux = [{ code: 'SNTS', cours_jour: 26000, variation_pct: 1.96, volume: 900, valeur_echangee: 23_400_000, nb_transactions: 41 }];
    const l = lignesAuMoment(avecCapitaux, { t: t1, cours: { SNTS: 25800 }, volumes: {} }, veilles)[0]!;
    expect(l.valeur_echangee).toBeNull();
    expect(l.nb_transactions).toBeNull();
    expect('valeur_echangee' in lignesAuMoment(base, { t: t1, cours: {}, volumes: {} }, veilles)[0]!).toBe(false);
  });

  it('sans veille connue, aucune variation inventée', () => {
    const lignes = lignesAuMoment(base, { t: t1, cours: { SNTS: 25800 }, volumes: {} }, {});
    expect(lignes[0]!.variation_pct).toBeNull();
    expect(lignes[1]!.cours_jour).toBeNull();
  });
});

describe('directionsEntre', () => {
  it('donne le sens de chaque cours qui a changé', () => {
    const a = { t: t1, cours: { SNTS: 25800, ORAC: 15000, ECOC: 12400 }, volumes: {} };
    const b = { t: t2, cours: { SNTS: 25900, ORAC: 14900, ECOC: 12400 }, volumes: {} };
    expect(directionsEntre(a, b)).toEqual({ SNTS: 'up', ORAC: 'down' });
    expect(directionsEntre(null, b)).toEqual({});
  });
});

describe('veillesDe', () => {
  it('prend cours_precedent quand il existe, sinon le déduit de la variation', () => {
    const v = veillesDe([
      { code: 'SNTS', cours_jour: 26000, variation_pct: 1.96, cours_precedent: 25500 },
      { code: 'ORAC', cours_jour: 102, variation_pct: 2 },
      { code: 'ECOC', cours_jour: null, variation_pct: null, cours_precedent: null },
    ]);
    expect(v.SNTS).toBe(25500);
    expect(v.ORAC).toBeCloseTo(100);
    expect(v.ECOC).toBeNull();
  });
});

describe('veilleDepuisVariation', () => {
  it('déduit la veille du cours et de la variation publiée', () => {
    expect(veilleDepuisVariation(102, 2)).toBeCloseTo(100);
    expect(veilleDepuisVariation(null, 2)).toBeNull();
    expect(veilleDepuisVariation(100, null)).toBeNull();
  });
});
