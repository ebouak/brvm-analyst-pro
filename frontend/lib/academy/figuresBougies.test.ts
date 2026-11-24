import { describe, expect, it } from 'vitest';
import {
  figureDeuxBougies,
  figureTroisBougies,
  figureUneBougie,
  lireFigureFictive,
  lireSeances,
  repererFigures,
  type BougieSeance,
} from './figuresBougies';
import { lireBougie } from './simTechnique';

const b = (o: number, h: number, bas: number, c: number) => ({ o, h, b: bas, c });
const s = (date: string, o: number | null, h: number | null, bas: number | null, c: number, volume: number | null = 100): BougieSeance => ({ date, ouverture: o, haut: h, bas, cloture: c, volume });

describe('figures à une bougie : mêmes seuils que lireBougie (leçon 1)', () => {
  const cas: [number, number, number, number][] = [
    [1000, 1012, 940, 1010], // marteau
    [1000, 1030, 970, 1000], // doji
    [1000, 1060, 995, 1010], // étoile filante
    [1000, 1060, 980, 1050], // haussière ordinaire
    [4150, 4350, 4050, 4200], // exercice 4 de la leçon 1
  ];
  it.each(cas)('ouverture %d, haut %d, bas %d, clôture %d', (o, h, bas, c) => {
    const ref = lireBougie({ ouverture: o, haut: h, bas, cloture: c }).figure;
    const attendu = ref === 'haussiere' || ref === 'baissiere' ? null : ref;
    expect(figureUneBougie(b(o, h, bas, c))).toBe(attendu);
  });
});

describe('figures à deux bougies', () => {
  it('avalement haussier : la haussière englobe le corps de la baissière', () => {
    expect(figureDeuxBougies(b(1010, 1012, 995, 1000), b(998, 1020, 996, 1015))).toBe('avalement_haussier');
  });
  it('avalement baissier', () => {
    expect(figureDeuxBougies(b(1000, 1012, 998, 1010), b(1012, 1014, 990, 995))).toBe('avalement_baissier');
  });
  it('harami : petite bougie dans le corps d’une grande', () => {
    expect(figureDeuxBougies(b(1000, 1032, 998, 1030), b(1010, 1016, 1008, 1014))).toBe('harami');
  });
});

describe('figures à trois bougies (sans écart d’ouverture exigé)', () => {
  it('étoile du matin : grande baisse, petit corps bas, hausse au-dessus du milieu', () => {
    expect(figureTroisBougies(b(1000, 1002, 968, 970), b(970, 974, 962, 968), b(968, 992, 966, 990))).toBe('etoile_du_matin');
  });
  it('étoile du soir : le miroir', () => {
    expect(figureTroisBougies(b(1000, 1032, 998, 1030), b(1030, 1038, 1026, 1032), b(1032, 1034, 1006, 1008))).toBe('etoile_du_soir');
  });
  it('pas d’étoile du matin si la troisième bougie ne dépasse pas le milieu de la première', () => {
    expect(figureTroisBougies(b(1000, 1002, 968, 970), b(970, 974, 962, 968), b(968, 982, 966, 980))).toBeNull();
  });
  it('trois soldats blancs et trois corbeaux noirs', () => {
    expect(figureTroisBougies(b(1000, 1011, 999, 1010), b(1010, 1021, 1009, 1020), b(1020, 1031, 1019, 1030))).toBe('trois_soldats');
    expect(figureTroisBougies(b(1030, 1031, 1019, 1020), b(1020, 1021, 1009, 1010), b(1010, 1011, 999, 1000))).toBe('trois_corbeaux');
  });
  it('trois petites hausses (corps sous 0,5 % du cours) ne font pas trois soldats', () => {
    expect(figureTroisBougies(b(1000, 1003, 999, 1002), b(1002, 1005, 1001, 1004), b(1004, 1007, 1003, 1006))).toBeNull();
  });
});

describe('repérage sur une suite de séances', () => {
  it('six baisses de suite donnent deux trois corbeaux distincts, jamais une séance partagée', () => {
    const closes = [1050, 1040, 1030, 1020, 1010, 1000];
    const seances = closes.map((c, i) => {
      const o = i === 0 ? 1060 : closes[i - 1]!;
      return s(`2026-01-0${i + 1}`, o, o + 1, c - 1, c);
    });
    const corbeaux = repererFigures(seances).filter((f) => f.figure === 'trois_corbeaux');
    expect(corbeaux).toHaveLength(2);
    expect(corbeaux[0]!.fin).toBeLessThan(corbeaux[1]!.debut);
  });
  it('une séance sans échange ou sans prix complets n’est jamais lue, ni enjambée', () => {
    const seances = [
      s('2026-01-01', 1000, 1002, 968, 970),
      s('2026-01-02', 970, 970, 970, 970, 0),
      s('2026-01-03', 968, 992, 966, 990),
    ];
    expect(repererFigures(seances).some((f) => f.figure === 'etoile_du_matin')).toBe(false);
    expect(repererFigures([s('2026-01-01', null, null, null, 1000), s('2026-01-02', null, null, null, 1010)])).toEqual([]);
  });
  it('lireSeances : sans ouverture ni plus haut publiés, le dit au lieu d’inventer une bougie', () => {
    const l = lireSeances([s('2026-01-01', null, null, null, 1000), s('2026-01-02', null, null, null, 1010)]);
    expect(l.exploitables).toBe(0);
    expect(l.lecture).toMatch(/ne sont pas publiés/);
  });
  it('lireSeances : compte les ouvertures égales à la clôture de la veille', () => {
    const l = lireSeances([s('2026-01-01', 990, 1001, 989, 1000), s('2026-01-02', 1000, 1011, 999, 1010), s('2026-01-03', 1010, 1021, 1009, 1020)]);
    expect(l.ouvertureEgaleVeille).toBe(2);
    expect(l.lecture).not.toMatch(/achetez|vendez|conseil d’achat/i);
  });
});

describe('atelier de bougies fictives', () => {
  it('nomme la figure des trois dernières bougies', () => {
    const r = lireFigureFictive([
      { ouverture: 1000, haut: 1002, bas: 968, cloture: 970 },
      { ouverture: 970, haut: 974, bas: 962, cloture: 968 },
      { ouverture: 968, haut: 992, bas: 966, cloture: 990 },
    ]);
    expect(r.figure).toBe('etoile_du_matin');
    expect(r.lecture).toMatch(/ne dit rien de la séance suivante/);
  });
  it('refuse une bougie impossible, en nommant la bougie fautive', () => {
    expect(() => lireFigureFictive([
      { ouverture: 1000, haut: 990, bas: 980, cloture: 985 },
      { ouverture: 985, haut: 1000, bas: 980, cloture: 995 },
    ])).toThrow(/Bougie 1/);
  });
});
