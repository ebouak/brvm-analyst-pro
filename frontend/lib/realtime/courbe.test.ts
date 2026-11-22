import { describe, it, expect } from 'vitest';
import { pointsDuJour, ajouterPoint, valeurPortefeuilleDuJour, cheminCourbe } from './courbe';
import type { ImageSeance } from './rejeu';

const h = (hh: number, mm = 0) => `2026-11-20T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+00:00`;

describe('pointsDuJour', () => {
  it('trie les relevés et écarte les trous', () => {
    const p = pointsDuJour([
      { captured_at: h(9, 30), valeur: 101 },
      { captured_at: h(9, 15), valeur: 100 },
      { captured_at: h(9, 45), valeur: null },
      { captured_at: h(10), valeur: '0' },
    ]);
    expect(p.map((x) => x.v)).toEqual([100, 101]);
  });

  it('écarte les relevés tardifs qui répètent la dernière valeur', () => {
    const p = pointsDuJour([
      { captured_at: h(15, 45), valeur: 102 },
      { captured_at: h(18), valeur: 102 },
      { captured_at: h(21, 30), valeur: 102 },
    ]);
    expect(p).toHaveLength(1);
  });

  it('garde un relevé tardif qui change la valeur, à son heure réelle', () => {
    const p = pointsDuJour([
      { captured_at: h(15, 45), valeur: 102 },
      { captured_at: h(21, 30), valeur: 103 },
    ]);
    expect(p).toHaveLength(2);
    expect(new Date(p[1]!.t).getUTCHours()).toBe(21);
  });
});

describe('ajouterPoint', () => {
  const base = [{ t: 1000, v: 100 }];
  it('ajoute un point plus récent', () => {
    expect(ajouterPoint(base, { t: 2000, v: 101 })).toHaveLength(2);
  });
  it('refuse un point plus ancien ou invalide (même référence)', () => {
    expect(ajouterPoint(base, { t: 500, v: 101 })).toBe(base);
    expect(ajouterPoint(base, { t: 3000, v: 0 })).toBe(base);
  });
});

describe('valeurPortefeuilleDuJour', () => {
  const images: ImageSeance[] = [
    { t: h(9, 15), cours: { SNTS: 25800 }, volumes: {} },
    { t: h(9, 30), cours: { SNTS: 25900, PALC: 7600 }, volumes: {} },
  ];
  it('valorise chaque relevé, la veille servant tant qu’une valeur n’est pas relevée', () => {
    const r = valeurPortefeuilleDuJour(
      [{ code: 'SNTS', quantite: 10 }, { code: 'PALC', quantite: 100 }],
      images,
      { SNTS: 25500, PALC: 7450 },
    );
    expect(r.reference).toBe(10 * 25500 + 100 * 7450);
    expect(r.points.map((p) => p.v)).toEqual([10 * 25800 + 100 * 7450, 10 * 25900 + 100 * 7600]);
  });
  it('écarte une position sans veille connue', () => {
    const r = valeurPortefeuilleDuJour([{ code: 'SNTS', quantite: 10 }, { code: 'XXXX', quantite: 5 }], images, { SNTS: 25500 });
    expect(r.reference).toBe(255000);
  });
  it('rien à tracer sans aucune veille', () => {
    expect(valeurPortefeuilleDuJour([{ code: 'SNTS', quantite: 10 }], images, {})).toEqual({ reference: null, points: [] });
  });
});

describe('cheminCourbe', () => {
  const pts = [{ t: 0, v: 100 }, { t: 50, v: 110 }, { t: 100, v: 105 }];
  it('place le premier point à gauche et le dernier à droite, à l’échelle', () => {
    const c = cheminCourbe(pts, { largeur: 108, hauteur: 58, marge: 4 });
    expect(c.d.startsWith('M4.0 ')).toBe(true);
    expect(c.dernier![0]).toBe(104);
    expect(c.hausse).toBe(true);
  });
  it('inclut la référence dans l’échelle et signale une baisse sous la veille', () => {
    const c = cheminCourbe(pts, { largeur: 100, hauteur: 50, reference: 120 });
    expect(c.yReference).not.toBeNull();
    expect(c.yReference!).toBeLessThan(c.dernier![1]);
    expect(c.hausse).toBe(false);
  });
  it('vide sans point', () => {
    expect(cheminCourbe([], { largeur: 10, hauteur: 10 }).d).toBe('');
  });
});
