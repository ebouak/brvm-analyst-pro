import { describe, expect, it } from 'vitest';
import { sectorCommentary, eventCommentary, marketDailyCommentary, mediane } from './reportCommentary';

// Porté depuis reportCommentary.test.mjs (jamais lancé par la CI), avec les cas d'accord 0, 1 et 2 titres.
const tout = (xs: string[]) => xs.join(' | ');

describe('mediane', () => {
  it('trie avant de médianer', () => {
    expect(mediane([])).toBeNull();
    expect(mediane([5])).toBe(5);
    expect(mediane([3, 1, 2])).toBe(2);
    expect(mediane([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('sectorCommentary', () => {
  it('cas réel « Services financiers »', () => {
    const fin = sectorCommentary({
      periodeLabel: '3 mois',
      perfs: [125.8, 104.5, 92.3, 48.3, 42.4, 31.3, 25.9, 23.3, 21.3, 18, 12, 8, 5, 2, -8, -21.5],
      nbTitresTotal: 16, averagePerf: 33.16, dispersion: 39.16,
      best: { code: 'ETIT', perf: 125.8 }, worst: { code: 'ORGT', perf: -21.5 }, nbEvenements: 0,
    });
    expect(fin[0]).toContain('14 titres en hausse et 2 en baisse');
    expect(tout(fin)).toContain('tirée vers le haut');
    expect(tout(fin)).toContain('n’évoluent pas en bloc');
    expect(tout(fin)).toContain('147,3 points');
    expect(tout(fin)).not.toMatch(/\d\.\d/);
    expect(tout(fin)).not.toMatch(/-\d/); // moins typographique seulement
  });
  it('couverture partielle et non-causalité', () => {
    const p = sectorCommentary({
      periodeLabel: '3 mois', perfs: [10, -5], nbTitresTotal: 6, averagePerf: 2.5, dispersion: 7.5,
      best: { code: 'AAA', perf: 10 }, worst: { code: 'BBB', perf: -5 }, nbEvenements: 2,
    });
    expect(tout(p)).toMatch(/4 titres du secteur sont exclus/);
    expect(tout(p)).toContain('aucun lien de cause à effet');
  });
  it('aucune donnée', () => {
    const v = sectorCommentary({ periodeLabel: '1 semaine', perfs: [], nbTitresTotal: 3, averagePerf: null, dispersion: null, best: null, worst: null, nbEvenements: 0 });
    expect(v).toHaveLength(1);
  });
});

describe('eventCommentary : accords', () => {
  it('0 titre mesuré', () => {
    const ev = eventCommentary({ impacts: [{ code: 'AAA', rendementAnormalPct: null }], nbTitresLies: 1, fenetreSeances: 5 });
    expect(ev).toHaveLength(1);
    expect(ev[0]).toContain('Aucun rendement');
  });
  it('1 titre : « le titre lié », jamais « les 1 titre liés »', () => {
    const ev = eventCommentary({ impacts: [{ code: 'SNTS', rendementAnormalPct: -15 }], nbTitresLies: 1, fenetreSeances: 5 });
    expect(ev[0]).toBe('Le titre lié (SNTS) a fait moins bien que l’indice sur les 5 séances suivant l’événement, avec un écart de −15,00 %.');
    expect(tout(ev)).not.toMatch(/les 1 titre|0 a fait|1 titres/);
  });
  it('2 titres, aucun au-dessus de l’indice', () => {
    const ev = eventCommentary({
      impacts: [{ code: 'AAA', rendementAnormalPct: -1 }, { code: 'BBB', rendementAnormalPct: -3 }], nbTitresLies: 2, fenetreSeances: 5,
    });
    expect(ev[0]).toContain('Sur les 2 titres liés, aucun n’a fait mieux que l’indice et 2 moins bien');
    expect(ev[1]).toContain('BBB');
  });
  it('3 titres mesurés sur 4, non-causalité en dernier', () => {
    const ev = eventCommentary({
      impacts: [
        { code: 'AAA', rendementAnormalPct: 2.5 }, { code: 'BBB', rendementAnormalPct: -1.2 },
        { code: 'CCC', rendementAnormalPct: -4.8 }, { code: 'DDD', rendementAnormalPct: null },
      ],
      nbTitresLies: 4, fenetreSeances: 5,
    });
    expect(ev[0]).toContain('3 titres liés, 1 a fait mieux');
    expect(ev[1]).toContain('CCC');
    expect(tout(ev)).toContain('1 titre lié sans historique');
    expect(ev[ev.length - 1]).toContain('ne lui sont pas attribués');
  });
});

describe('marketDailyCommentary', () => {
  it('participation et concentration', () => {
    const s = marketDailyCommentary({
      variations: [3.2, 1.1, 0, -2.4, 7.5], nbTitresCotes: 47,
      valeursEchangees: [500_000_000, 300_000_000, 150_000_000, 50_000_000, 0], nbEvenements: 1,
    });
    expect(s[0]).toContain('3 hausses, 1 baisse et 1 titre inchangé');
    expect(tout(s)).toMatch(/4 titres sur 47 .*8,5\s%/);
    expect(tout(s)).toMatch(/95,0\s% .*concentrent|concentrent 95,0\s%/);
    expect(tout(s)).toContain('sans lien de causalité');
  });
});
