import { describe, expect, it } from 'vitest';
import { bandeauVisible, depuis, exemplesWhatsapp, horodatageUtc, lignesBrief, lignesReponse, lignesSeance, montantCourt, prixOffre } from './basPur';

const sp = (s: string) => s.replace(/[  ]/g, ' ');

describe('horodatageUtc', () => {
  it('lit l’heure et la date en UTC', () => {
    expect(horodatageUtc('2026-11-11T17:04:09Z')).toEqual({ heure: '17:04 UTC', date: '11/11/2026' });
  });
  it('rend null sur une date absente ou illisible', () => {
    expect(horodatageUtc(null)).toBeNull();
    expect(horodatageUtc('pas une date')).toBeNull();
  });
});

describe('depuis', () => {
  it('minutes, heures puis jours', () => {
    expect(depuis(12)).toBe('il y a 12 min');
    expect(depuis(180)).toBe('il y a 3 h');
    expect(depuis(60 * 72)).toBe('il y a 3 jours');
  });
  it('null sans mesure', () => {
    expect(depuis(null)).toBeNull();
    expect(depuis(-5)).toBeNull();
  });
});

describe('exemplesWhatsapp', () => {
  const lignes = [
    { code: 'SNTS', cours_jour: 4190, variation_pct: 4.75, volume: 1200, valeur_echangee: 5_028_000 },
    { code: 'CABC', cours_jour: 2910, variation_pct: 7.18, volume: 10, valeur_echangee: 29_100 },
    { code: 'PRSC', cours_jour: 3000, variation_pct: -6.97, volume: 5, valeur_echangee: 15_000 },
  ];
  const ex = exemplesWhatsapp(lignes, '2026-11-11', 'SNTS', { SNTS: 'SONATEL' });

  it('produit COURS puis PALMARES avec les chiffres de la séance', () => {
    expect(ex.map((e) => e.question)).toEqual(['COURS SNTS', 'PALMARES']);
    const cours = sp(ex[0].reponse.join('\n'));
    expect(cours).toContain('SNTS — SONATEL');
    expect(cours).toContain('Séance du 11/11/2026');
    expect(cours).toContain('4 190 FCFA');
    const palm = sp(ex[1].reponse.join('\n'));
    expect(palm.indexOf('CABC')).toBeLessThan(palm.indexOf('SNTS'));
    expect(palm).toContain('Sur 3 valeurs cotées.');
  });

  it('retire balisage, pictogrammes, liens et pied d’incitation, garde la mention', () => {
    const tout = ex.flatMap((e) => e.reponse).join('\n');
    expect(tout).not.toMatch(/[*_]|https?:\/\/|\p{Extended_Pictographic}/u);
    expect(tout).not.toContain('Recevez vos alertes');
    expect(ex[0].reponse.at(-1)).toBe('Information de marché, pas un conseil en investissement.');
  });

  it('rien sans séance', () => {
    expect(exemplesWhatsapp(lignes, null, 'SNTS', {})).toEqual([]);
    expect(exemplesWhatsapp([], '2026-11-11', 'SNTS', {})).toEqual([]);
  });

  it('sans valeur ciblée, seulement le palmarès', () => {
    expect(exemplesWhatsapp(lignes, '2026-11-11', 'ZZZZ', {}).map((e) => e.question)).toEqual(['PALMARES']);
  });
});

describe('lignesReponse', () => {
  it('coupe après la mention de marché', () => {
    expect(lignesReponse('*A*\n\n_Information de marché, pas un conseil en investissement._\n\nB')).toEqual(['A', 'Information de marché, pas un conseil en investissement.']);
  });
});

describe('lignesBrief', () => {
  const brief = [
    'BRVM — Note de conjoncture du mercredi 11 novembre 2026',
    '',
    'Séance mitigée : 15 hausses · 23 baisses · 9 stables',
    'BRVM-C : 517,17 (+0,85 %)',
    'BRVM-30 : 255,1 (+0,40 %)',
    '',
    'Hausses : CABC +7,18 % · SNTS +4,75 %',
    'Baisses : PRSC −6,97 %',
    'Transactions : 2,55 milliards FCFA',
    '',
    '· Un titre d’actualité tiers',
    '',
    'Note complète → https://www.westbourse.com/brief/2026-11-11',
  ].join('\n');
  it('garde cinq lignes de chiffres, sans titre, actualités ni lien', () => {
    expect(lignesBrief(brief)).toEqual([
      'Séance mitigée : 15 hausses · 23 baisses · 9 stables',
      'BRVM-C : 517,17 (+0,85 %)',
      'BRVM-30 : 255,1 (+0,40 %)',
      'Hausses : CABC +7,18 % · SNTS +4,75 %',
      'Baisses : PRSC −6,97 %',
    ]);
  });
  it('vide sur un brief vide', () => {
    expect(lignesBrief('')).toEqual([]);
  });
});

describe('lignesSeance', () => {
  it('compose des lignes factuelles et retire ce qui manque', () => {
    const l = lignesSeance({ indice: 517.17, variation: 0.85, hausses: 15, baisses: 23, stables: 9, meilleure: { code: 'CABC', variation: 7.18 }, pire: null, capitaux: 2_550_000_000 }).map(sp);
    expect(l).toEqual([
      'BRVM Composite : 517,17 points (+0,85 %).',
      '15 en hausse, 23 en baisse, 9 sans changement.',
      'CABC, plus forte hausse : +7,18 %.',
      'Capitaux échangés : 2,55 Md FCFA.',
    ]);
  });
  it('vide sans aucune donnée', () => {
    expect(lignesSeance({ indice: null, variation: null, hausses: 0, baisses: 0, stables: 0, meilleure: null, pire: null, capitaux: null })).toEqual([]);
  });
});

describe('montantCourt', () => {
  it('Md, M, puis entier', () => {
    expect(sp(montantCourt(2_550_000_000))).toBe('2,55 Md');
    expect(sp(montantCourt(12_400_000))).toBe('12,40 M');
    expect(sp(montantCourt(9500))).toBe('9 500');
  });
});

describe('prixOffre', () => {
  it('gratuit, payant, absent', () => {
    expect(prixOffre({ code: 'free', monthly: 0, yearly: 0 })).toEqual({ mensuel: '0 FCFA', annuel: null });
    const p = prixOffre({ code: 'premium', monthly: 10000, yearly: 90000 });
    expect(sp(p!.mensuel)).toBe('10 000 FCFA');
    expect(sp(p!.annuel!)).toBe('90 000 FCFA');
    expect(prixOffre(undefined)).toBeNull();
  });
});

describe('bandeauVisible', () => {
  const base = { session: 'anonyme' as const, ferme: false, heroDepasse: true, finEnVue: false };
  it('visible pour un anonyme qui a dépassé l’ouverture', () => {
    expect(bandeauVisible(base)).toBe(true);
  });
  it('jamais connecté, ni session inconnue, ni fermé, ni avant l’ouverture, ni près de la fin', () => {
    expect(bandeauVisible({ ...base, session: 'connecte' })).toBe(false);
    expect(bandeauVisible({ ...base, session: 'inconnu' })).toBe(false);
    expect(bandeauVisible({ ...base, ferme: true })).toBe(false);
    expect(bandeauVisible({ ...base, heroDepasse: false })).toBe(false);
    expect(bandeauVisible({ ...base, finEnVue: true })).toBe(false);
  });
});
