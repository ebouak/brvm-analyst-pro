import { describe, expect, it } from 'vitest';
import { pctTexte, dateLongue, releve, sceneIndice, traceSerie, casesMosaique, motsBandeau, plusFortesVariations } from './seance';
import { CANAUX } from '@/lib/canaux';
import canaux from '../../../remotion/canaux.json';

const sp = (s: string) => s.replace(/[  ]/g, ' ');

describe('vitrine : séance', () => {
  it('pourcentages à la française, zéro sans signe', () => {
    expect(sp(pctTexte(7.18))).toBe('+7,18 %');
    expect(sp(pctTexte(-6.97))).toBe('−6,97 %');
    expect(sp(pctTexte(0.001))).toBe('0,00 %');
  });
  it('dates et relevé', () => {
    expect(dateLongue('2026-11-11')).toBe('11 novembre 2026');
    expect(releve('2026-11-11T17:04:00Z')).toBe('relevé le 11/11 à 17:04 UTC');
    expect(releve(null)).toBeNull();
  });
  it('scène de l’indice : 60 dernières séances avec leurs dates, bornes', () => {
    const serie = Array.from({ length: 80 }, (_, i) => ({ d: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`, v: 500 + i }));
    const s = sceneIndice(579, 0.5, serie)!;
    expect(s.serie).toHaveLength(60);
    expect(s.bas).toBe(520);
    expect(s.haut).toBe(579);
    expect(sceneIndice(null, null, serie)).toBeNull();
    expect(sceneIndice(1, 0, [{ d: '2026-01-01', v: 1 }])).toBeNull();
  });
  it('tracé : premier point en M, dernier à droite', () => {
    const d = traceSerie([1, 2, 3]);
    expect(d.startsWith('M0.0 ')).toBe(true);
    expect(d).toContain('L560.0 8.0');
  });
  it('mosaïque triée, tons et lecture', () => {
    const c = casesMosaique([
      { code: 'AAA', cours_jour: 1000, variation_pct: 0.5 },
      { code: 'BBB', cours_jour: 2910, variation_pct: 7.18 },
      { code: 'CCC', cours_jour: 3535, variation_pct: -6.97 },
      { code: 'DDD', cours_jour: 100, variation_pct: 0 },
      { code: 'EEE', cours_jour: null, variation_pct: null },
    ]);
    expect(c.map((x) => x.code)).toEqual(['BBB', 'AAA', 'DDD', 'EEE', 'CCC']);
    expect(c.map((x) => x.ton)).toEqual(['hausse-pleine', 'hausse', 'stable', 'stable', 'baisse-pleine']);
    expect(sp(c[0]!.lecture)).toBe('BBB · 2 910 FCFA · +7,18 %');
    expect(c[3]!.lecture).toContain('cours non disponible');
    expect(plusFortesVariations(c).map((x) => x.code)).toEqual(['BBB', 'AAA', 'CCC']);
  });
  it('bandeau : un chiffre absent retire son mot', () => {
    const [l1, l2] = motsBandeau({ indice: 517.17, variation: 0.85, hausses: 15, stables: 10, baisses: 23, capitaux: null, titres: 858599, transactions: 1, meilleure: { code: 'CABC', variation: 7.18 }, pire: null, nbValeurs: 48 });
    expect(l1.map(sp)).toEqual(['517,17', '▲ +0,85 %', '15 hausses', 'la séance', '23 baisses']);
    expect(l2.map(sp)).toEqual(['CABC +7,18 %', '48 valeurs', 'au chiffre près', '858 599 titres', '1 transaction']);
  });
  it('canaux : source unique alignée sur remotion/canaux.json', () => {
    expect(CANAUX.whatsappChaine).toBe(`https://${canaux.chaine}`);
    expect(CANAUX.telegram).toBe(`https://${canaux.telegram}`);
    expect(CANAUX.whatsappNumero).toBe(canaux.numero);
  });
});
