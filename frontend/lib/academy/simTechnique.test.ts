import { describe, expect, it } from 'vitest';
import { SaisieInvalide } from './simulateurs';
import { atelierMacd, lectureMacd, lectureMoyennes, lectureRsi, lectureVariation, lireBougie, moyenneGlissante, rsiPasAPas, type PointSerie } from './simTechnique';
import { rsiSeries } from '@/lib/indicators';

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
  // Leçon 3 enrichie (2026-11-24) : moyenne exponentielle, croisement des deux
  // moyennes entre elles, écart du cours à chacune.
  it('méthode exponentielle : les moyennes sont celles de emaSeries, plus proches du dernier cours', () => {
    const s = serie(120, (i) => (i < 100 ? 1_000 : 1_000 + 20 * (i - 99)));
    const simple = lectureMoyennes(s, 20, 50);
    const expo = lectureMoyennes(s, 20, 50, 'exponentielle');
    expect(simple.methode).toBe('simple');
    expect(expo.methode).toBe('exponentielle');
    const k = 2 / 21;
    let e = 1_000;
    for (let i = 20; i < 120; i++) e = s[i]!.cours * k + e * (1 - k);
    expect(expo.derniere.courte).toBeCloseTo(e, 6);
    expect(Math.abs(expo.derniere.cours - expo.derniere.courte!)).toBeLessThan(Math.abs(simple.derniere.cours - simple.derniere.courte!));
    expect(expo.lecture).toMatch(/exponentielles/);
  });
  it('repère le dernier croisement des deux moyennes, son sens et sa date', () => {
    // Hausse régulière puis chute : la moyenne courte finit par passer sous la longue.
    const s = serie(160, (i) => (i < 110 ? 1_000 + 10 * i : 2_090 - 40 * (i - 109)));
    const r = lectureMoyennes(s, 20, 50);
    expect(r.croisementMoyennes?.sens).toBe('baissier');
    const i = r.points.length - 1 - r.croisementMoyennes!.seances;
    expect(r.points[i]!.courte! < r.points[i]!.longue!).toBe(true);
    expect(r.points[i - 1]!.courte! >= r.points[i - 1]!.longue!).toBe(true);
    expect(r.croisementMoyennes!.date).toBe(r.points[i]!.date);
    expect(r.lecture).toMatch(/croisement baissier/);
  });
  it('sans croisement des deux moyennes sur la série, rien n’est inventé', () => {
    const r = lectureMoyennes(serie(120, (i) => 1_000 + 5 * i), 20, 50);
    expect(r.croisementMoyennes).toBeNull();
    expect(r.lecture).not.toMatch(/croisement (haussier|baissier)/);
  });
  it('écart du cours à chaque moyenne, en pourcentage', () => {
    const r = lectureMoyennes(serie(120, (i) => 1_000 + 5 * i), 20, 50);
    expect(r.ecartCourtePct).toBeCloseTo((r.derniere.cours / r.derniere.courte! - 1) * 100, 9);
    expect(r.ecartLonguePct).toBeCloseTo((r.derniere.cours / r.derniere.longue! - 1) * 100, 9);
  });
});

// Leçon 4 enrichie (2026-11-24) : RSI pas à pas, et lecture qui tient compte des
// séances sans échange et du RSI figé.
describe('atelier : le RSI pas à pas', () => {
  const CLOTURES = [1000, 1020, 1015, 1030, 1025, 1040, 1050, 1045, 1060, 1070, 1065, 1080, 1075, 1090, 1100, 1085, 1095];
  it('aucun RSI avant 14 variations, soit 15 clôtures ; puis 83,3 (hausses 125, baisses 25)', () => {
    const r = rsiPasAPas(CLOTURES, 14);
    expect(r.lignes.slice(0, 14).every((l) => l.rsi == null)).toBe(true);
    const l15 = r.lignes[14]!;
    expect(l15.moyHausse).toBeCloseTo(125 / 14, 12);
    expect(l15.moyBaisse).toBeCloseTo(25 / 14, 12);
    expect(l15.rs).toBeCloseTo(5, 12);
    expect(l15.rsi).toBeCloseTo(100 - 100 / 6, 12);
  });
  it('lissage de Wilder ensuite : (veille × 13 + séance) ÷ 14', () => {
    const r = rsiPasAPas(CLOTURES, 14);
    const mh = ((125 / 14) * 13 + 0) / 14;
    const mb = ((25 / 14) * 13 + 15) / 14;
    expect(r.lignes[15]!.moyHausse).toBeCloseTo(mh, 12);
    expect(r.lignes[15]!.moyBaisse).toBeCloseTo(mb, 12);
    expect(r.lignes[15]!.rsi).toBeCloseTo(100 - 100 / (1 + mh / mb), 12);
  });
  it('donne exactement le RSI du site (rsiSeries), sur des séries quelconques', () => {
    let graine = 7;
    const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    for (let essai = 0; essai < 20; essai++) {
      const c = [1000];
      for (let i = 1; i < 40; i++) c.push(Math.max(1, Math.round(c[i - 1]! * (1 + (hasard() - 0.5) * 0.1))));
      const periode = 2 + (essai % 13);
      const attendu = rsiSeries(c, periode);
      rsiPasAPas(c, periode).lignes.forEach((l, i) => {
        if (attendu[i] == null) expect(l.rsi).toBeNull();
        else expect(l.rsi!).toBeCloseTo(attendu[i]!, 9);
      });
    }
  });
  it('refuse une période impossible et un cours non positif', () => {
    expect(() => rsiPasAPas(CLOTURES, 1)).toThrow(SaisieInvalide);
    expect(() => rsiPasAPas(CLOTURES.slice(0, 10), 14)).toThrow(SaisieInvalide);
    expect(() => rsiPasAPas([100, 0, 101, 102, 103], 2)).toThrow(SaisieInvalide);
  });
  it('décrit sans recommander', () => {
    expect(rsiPasAPas(CLOTURES, 14).lecture).not.toMatch(/achet|vend/i);
  });
});

describe('RSI : séances sans échange et RSI figé', () => {
  it('signale les séances sans échange de la fenêtre', () => {
    const s = serie(60, (i) => 100 + (i % 3)).map((p, i) => ({ ...p, volume: i >= 55 ? 0 : 500 }));
    const r = lectureRsi(s, 14, 70, 30);
    expect(r.seancesSansEchange).toBe(5);
    expect(r.alertes.join(' ')).toMatch(/5 des 14 dernières séances sans échange/);
  });
  it('un cours inchangé depuis 14 séances ou plus : RSI figé à sa dernière valeur, et dit', () => {
    const s = serie(80, (i) => (i < 50 ? 100 + (i % 4) : 105));
    const r = lectureRsi(s, 14, 70, 30);
    const k = s.findIndex((p) => p.cours === 105);
    expect(r.fige).toBe(true);
    expect(r.dernier).toBeCloseTo(r.points[k]!.rsi!, 9);
    expect(r.alertes.join(' ')).toMatch(/figé/);
  });
  it('sans volume connu, rien n’est affirmé sur les échanges', () => {
    const r = lectureRsi(serie(60, (i) => 100 + i), 14, 70, 30);
    expect(r.seancesSansEchange).toBeNull();
    expect(r.fige).toBe(false);
  });
});

describe('atelier : la moyenne qui glisse', () => {
  const CLOTURES = [100, 102, 101, 105, 107, 108, 106, 104];
  it('reproduit le calcul pas à pas : rien avant la cinquième séance, puis 103 ; 104,6 ; 105,4 ; 106', () => {
    const r = moyenneGlissante(CLOTURES, 5);
    expect(r.lignes.slice(0, 4).every((l) => l.sma == null && l.ema == null && l.fenetre == null)).toBe(true);
    expect(r.lignes.slice(4).map((l) => l.sma)).toEqual([103, 104.6, 105.4, 106]);
    expect(r.lignes[4]!.fenetre).toEqual([100, 102, 101, 105, 107]);
    expect(r.lignes[7]!.ecartSmaPct).toBeCloseTo((104 / 106 - 1) * 100, 9);
    expect(r.lecture).toMatch(/4 premières séances/);
  });
  it('la moyenne exponentielle part de la simple puis pondère : k = 2 ÷ (N + 1)', () => {
    const r = moyenneGlissante(CLOTURES, 5);
    expect(r.lignes[4]!.ema).toBeCloseTo(103, 9);
    expect(r.lignes[5]!.ema).toBeCloseTo(108 / 3 + (103 * 2) / 3, 9);
    expect(r.k).toBeCloseTo(1 / 3, 12);
  });
  it('refuse une période impossible et un cours non positif', () => {
    expect(() => moyenneGlissante(CLOTURES, 1)).toThrow(SaisieInvalide);
    expect(() => moyenneGlissante(CLOTURES, 8)).toThrow(SaisieInvalide);
    expect(() => moyenneGlissante([100, 0, 101, 102], 2)).toThrow(SaisieInvalide);
  });
  it('décrit sans recommander', () => {
    const r = moyenneGlissante(CLOTURES, 5);
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
    expect(r.dernier.macdPct).toBeCloseTo((r.dernier.macd / r.dernier.cours) * 100, 9);
    expect(r.points.at(-1)!.cours).toBe(r.dernier.cours);
  });
  it('hausse qui s’essouffle : positif et décroissant', () => {
    const r = lectureMacd(serie(115, (i) => (i <= 110 ? 1_000 + 0.05 * i * i : 1_605 + 11 * (i - 110))));
    expect(r.etat).toBe('positif_decroissant');
  });
  it('paramètres personnalisés acceptés, alerte affichée et pluriel propre', () => {
    const s = serie(120, (i) => 1_000 + 80 * Math.sin(i / 8) + i);
    const r = lectureMacd(s, 6, 13, 5);
    expect(r.alertes.some((a) => /12, 26, 9/.test(a))).toBe(true);
    expect(r.lecture).not.toMatch(/séance\(s\)/);
    expect(r.lecture).not.toMatch(/achet|vend/i);
  });
  it('historique trop court refusé', () => {
    expect(() => lectureMacd(serie(30, (i) => i + 1))).toThrow(SaisieInvalide);
  });
});

describe('atelier : le MACD pas à pas', () => {
  const PAS = [100, 100, 101, 102, 103, 105, 108, 112, 115, 116, 114, 111];
  const FIGE = [100, 100, 102, 105, 109, 114, 120, 120, 120, 120, 120, 120];
  it('rien avant la 6e séance pour le MACD, premier histogramme à la 8e (6 + 3 − 1)', () => {
    const r = atelierMacd(PAS, 3, 6, 3);
    expect(r.seancesMin).toBe(8);
    expect(r.lignes.slice(0, 5).every((l) => l.macd == null && l.hist == null)).toBe(true);
    expect(r.lignes[5]!.macd).not.toBeNull();
    expect(r.lignes[5]!.hist).toBeNull();
    expect(r.lignes[7]!.hist).toBeGreaterThan(0);
    expect(r.lignes[10]!.hist).toBeLessThan(0);
    expect(r.etat).toBe('negatif_decroissant');
    expect(r.lecture).not.toMatch(/achet|vend/i);
  });
  it('scénario cours figé : histogramme négatif malgré un prix constant à 120', () => {
    const r = atelierMacd(FIGE, 3, 6, 3);
    const dernier = r.lignes.at(-1)!;
    expect(dernier.macd).toBeGreaterThan(0);
    expect(dernier.hist).toBeLessThan(0);
    expect(r.lecture).toMatch(/cours est pourtant resté figé|cours figé/);
  });
  it('refuse des paramètres incohérents ou un cours non positif', () => {
    expect(() => atelierMacd(PAS, 6, 6, 3)).toThrow(SaisieInvalide);
    expect(() => atelierMacd(PAS.slice(0, 6), 3, 6, 3)).toThrow(SaisieInvalide);
    expect(() => atelierMacd([100, 0, 101, 102, 103, 104, 105, 106, 107], 3, 6, 3)).toThrow(SaisieInvalide);
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
