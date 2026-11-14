import { describe, expect, it } from 'vitest';
import { SaisieInvalide } from './simulateurs';
import { lectureMacd, lectureMoyennes, lectureRsi, lectureVariation, lireBougie, type PointSerie } from './simTechnique';

/** Série synthétique : n séances, cours donné par f(i). */
function serie(n: number, f: (i: number) => number): PointSerie[] {
  const debut = Date.UTC(2025, 0, 1);
  return Array.from({ length: n }, (_, i) => ({ date: new Date(debut + i * 86_400_000).toISOString().slice(0, 10), cours: f(i) }));
}

describe('variation selon l’horizon', () => {
  it('mesure chaque horizon depuis la bonne séance', () => {
    const s = serie(300, (i) => 1_000 + i);
    const r = lectureVariation(s);
    const unMois = r.lignes[0]!;
    expect(unMois.variationPct).toBeCloseTo((1_299 / 1_278 - 1) * 100, 6);
    expect(r.lecture).toMatch(/Hausse sur tous/);
  });
  it('dit quand une hausse courte cache une baisse longue', () => {
    // Baisse de 2 000 à 1 000 sur 280 séances, puis remontée sur les 20 dernières.
    const s = serie(300, (i) => (i < 280 ? 2_000 - i * (1_000 / 280) : 1_000 + (i - 280) * 10));
    const r = lectureVariation(s);
    expect(r.lignes[0]!.variationPct!).toBeGreaterThan(0);
    expect(r.lignes[3]!.variationPct!).toBeLessThan(0);
    expect(r.lecture).toMatch(/pas sur le même horizon/);
  });
  it('laisse vides les horizons hors historique', () => {
    const r = lectureVariation(serie(30, (i) => 100 + i));
    expect(r.lignes[3]!.variationPct).toBeNull();
    expect(r.alertes.length).toBe(1);
  });
  it('ignore les zéros (trous de collecte)', () => {
    const s = serie(40, (i) => (i === 20 ? 0 : 100));
    expect(lectureVariation(s).lignes[0]!.variationPct).toBe(0);
  });
});

describe('moyennes mobiles', () => {
  it('cours au-dessus des deux moyennes sur une hausse régulière, pente montante', () => {
    const r = lectureMoyennes(serie(120, (i) => 1_000 + 5 * i), 20, 50);
    expect(r.position).toBe('au-dessus des deux');
    expect(r.pente).toBe('monte');
    expect(r.derniere.courte).toBeCloseTo(1_000 + 5 * (119 - 9.5), 6);
  });
  it('cours sous ses moyennes mais moyenne longue encore montante : pas de contradiction', () => {
    // Cas réel SNTS du 13/11/2026 : longue hausse, puis repli récent sous les deux moyennes.
    const r = lectureMoyennes(serie(120, (i) => (i < 110 ? 1_000 + 10 * i : 2_090 - 60 * (i - 109))), 20, 50);
    expect(r.position).toBe('sous les deux');
    expect(r.pente).toBe('monte');
    expect(r.lecture).not.toMatch(/tendance de fond (vont|va) .*vers le bas/);
    expect(r.lecture).toMatch(/n’a pas encore retourné la tendance de fond/);
  });
  it('marché plat : pente plate', () => {
    const r = lectureMoyennes(serie(120, (i) => 1_000 + (i % 2 === 0 ? 5 : -5)), 20, 50);
    expect(r.pente).toBe('plate');
  });
  it('refuse un historique trop court et des périodes inversées', () => {
    expect(() => lectureMoyennes(serie(40, () => 1), 20, 50)).toThrow(SaisieInvalide);
    expect(() => lectureMoyennes(serie(200, () => 1), 50, 20)).toThrow(SaisieInvalide);
  });
  it('la lecture décrit, ne recommande pas', () => {
    const r = lectureMoyennes(serie(120, (i) => 1_000 + 5 * i), 20, 50);
    expect(r.lecture).toMatch(/pas ce qui va se passer/);
    expect(r.lecture).not.toMatch(/achet|vend/i);
  });
});

describe('RSI', () => {
  it('hausse continue : surachat', () => {
    const r = lectureRsi(serie(60, (i) => 100 + i), 14, 70, 30);
    expect(r.dernier).toBe(100);
    expect(r.zone).toBe('surachat');
    expect(r.lecture).toMatch(/ne veut pas dire « trop cher »/);
  });
  it('compte les séances par zone', () => {
    const r = lectureRsi(serie(60, (i) => 100 + i), 14, 70, 30);
    expect(r.repartition.surachat + r.repartition.neutre + r.repartition.survente).toBe(60 - 14);
  });
  it('seuils incohérents refusés', () => {
    expect(() => lectureRsi(serie(60, (i) => i + 1), 14, 30, 70)).toThrow(SaisieInvalide);
  });
});

describe('MACD', () => {
  it('accélération haussière : histogramme positif et croissant', () => {
    const r = lectureMacd(serie(120, (i) => 1_000 + 0.05 * i * i));
    expect(r.etat).toBe('positif_croissant');
    expect(r.dernier.macd).toBeGreaterThan(0);
  });
  it('hausse qui s’essouffle : positif et décroissant', () => {
    const r = lectureMacd(serie(115, (i) => (i <= 110 ? 1_000 + 0.05 * i * i : 1_605 + 11 * (i - 110))));
    expect(r.etat).toBe('positif_decroissant');
  });
  it('historique trop court refusé', () => {
    expect(() => lectureMacd(serie(30, (i) => i + 1))).toThrow(SaisieInvalide);
  });
});

describe('chandelier', () => {
  it('exemple de la leçon : 1 000 / 1 060 / 980 / 1 040 → bougie haussière, mèche haute', () => {
    const r = lireBougie({ ouverture: 1_000, haut: 1_060, bas: 980, cloture: 1_040 });
    expect(r.corps).toBe(40);
    expect(r.mecheHaute).toBe(20);
    expect(r.mecheBasse).toBe(20);
    expect(r.figure).toBe('haussiere');
    expect(r.lecture).toMatch(/vendeurs ont repris/);
  });
  it('doji, marteau, étoile filante, baissière', () => {
    expect(lireBougie({ ouverture: 1_000, haut: 1_050, bas: 950, cloture: 1_005 }).figure).toBe('doji');
    expect(lireBougie({ ouverture: 1_000, haut: 1_025, bas: 900, cloture: 1_020 }).figure).toBe('marteau');
    expect(lireBougie({ ouverture: 1_020, haut: 1_120, bas: 995, cloture: 1_000 }).figure).toBe('etoile_filante');
    expect(lireBougie({ ouverture: 1_100, haut: 1_110, bas: 990, cloture: 1_000 }).figure).toBe('baissiere');
  });
  it('bougie impossible refusée', () => {
    expect(() => lireBougie({ ouverture: 1_000, haut: 990, bas: 950, cloture: 980 })).toThrow(SaisieInvalide);
  });
});
