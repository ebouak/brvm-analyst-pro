import { describe, it, expect } from 'vitest';
import { detaillerAlertes } from './alertes';

const a = (o: Partial<{ code: string; type: string; seuil: number | null; declenchee_le: string | null }>) => ({
  code: 'SNTS', type: 'prix_au_dessus', seuil: 25000, declenchee_le: '2026-10-01T10:00:00Z', ...o,
});
const NBSP = /[  ]/g;
const norm = (s: string) => s.replace(NBSP, ' ');

describe('detaillerAlertes', () => {
  it('prix_au_dessus', () => {
    const [d] = detaillerAlertes([a({})], new Map([['SNTS', 1.5]]));
    expect(norm(d.motif)).toBe('Cours au-dessus de 25 000 FCFA');
    expect(d.variationPct).toBe(1.5);
  });
  it('prix_en_dessous', () => {
    const [d] = detaillerAlertes([a({ type: 'prix_en_dessous', seuil: 1200 })], new Map());
    expect(norm(d.motif)).toBe('Cours en dessous de 1 200 FCFA');
  });
  it('variation utilise la valeur absolue', () => {
    const [d] = detaillerAlertes([a({ type: 'variation', seuil: -5 })], new Map());
    expect(norm(d.motif)).toMatch(/^Variation au-delà de 5,00 %$/);
  });
  it('type inconnu', () => {
    expect(detaillerAlertes([a({ type: 'zzz' })], new Map())[0].motif).toBe('Seuil franchi');
  });
  it('seuil nul ou non fini : aucun nombre', () => {
    expect(detaillerAlertes([a({ seuil: null })], new Map())[0].motif).toBe('Seuil franchi');
    expect(detaillerAlertes([a({ seuil: Number.NaN })], new Map())[0].motif).toBe('Seuil franchi');
  });
  it('tri décroissant, plafond et normalisation des codes', () => {
    const r = detaillerAlertes(
      [
        a({ code: ' bicc ', declenchee_le: '2026-10-01T08:00:00Z' }),
        a({ code: 'abjc', declenchee_le: '2026-10-03T08:00:00Z' }),
        a({ code: 'snts', declenchee_le: '2026-10-02T08:00:00Z' }),
        a({ code: 'sgbc', declenchee_le: '2026-09-01T08:00:00Z' }),
      ],
      new Map(),
    );
    expect(r.map((x) => x.code)).toEqual(['ABJC', 'SNTS', 'BICC']);
  });
  it('variation absente de la table : null', () => {
    expect(detaillerAlertes([a({})], new Map())[0].variationPct).toBeNull();
    expect(detaillerAlertes([a({})], new Map([['SNTS', null]]))[0].variationPct).toBeNull();
  });
});
