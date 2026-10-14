import { describe, it, expect } from 'vitest';
import { detaillerAlertes } from './alertes';

const a = (o: Partial<{ code: string; type: string; seuil: number | null; declenchee_le: string | null }>) => ({
  code: 'SNTS', type: 'prix_au_dessus', seuil: 25000, declenchee_le: '2026-10-01T10:00:00Z', ...o,
});
const NBSP = /[  ]/g;
const norm = (s: string) => s.replace(NBSP, ' ');

describe('detaillerAlertes', () => {
  it('prix_au_dessus', () => {
    const [d] = detaillerAlertes([a({})]);
    expect(norm(d.motif)).toBe('Cours au-dessus de 25 000 FCFA');
    expect(d.le).toBe('2026-10-01');
  });
  it('prix_en_dessous', () => {
    const [d] = detaillerAlertes([a({ type: 'prix_en_dessous', seuil: 1200 })]);
    expect(norm(d.motif)).toBe('Cours en dessous de 1 200 FCFA');
  });
  it('variation utilise la valeur absolue', () => {
    const [d] = detaillerAlertes([a({ type: 'variation', seuil: -5 })]);
    expect(norm(d.motif)).toMatch(/^Variation au-delà de 5,00 %$/);
  });
  it('type inconnu', () => {
    expect(detaillerAlertes([a({ type: 'zzz' })])[0].motif).toBe('Seuil franchi');
  });
  it('seuil nul ou non fini : aucun nombre', () => {
    expect(detaillerAlertes([a({ seuil: null })])[0].motif).toBe('Seuil franchi');
    expect(detaillerAlertes([a({ seuil: Number.NaN })])[0].motif).toBe('Seuil franchi');
  });
  it('tri décroissant, plafond et normalisation des codes', () => {
    const r = detaillerAlertes(
      [
        a({ code: ' bicc ', declenchee_le: '2026-10-01T08:00:00Z' }),
        a({ code: 'abjc', declenchee_le: '2026-10-03T08:00:00Z' }),
        a({ code: 'snts', declenchee_le: '2026-10-02T08:00:00Z' }),
        a({ code: 'sgbc', declenchee_le: '2026-09-01T08:00:00Z' }),
      ],
    );
    expect(r.map((x) => x.code)).toEqual(['ABJC', 'SNTS', 'BICC']);
  });
  it('date de déclenchement : jour UTC, absente ou invalide → null', () => {
    expect(detaillerAlertes([a({ declenchee_le: '2026-10-08T23:30:00Z' })])[0].le).toBe('2026-10-08');
    expect(detaillerAlertes([a({ declenchee_le: null })])[0].le).toBeNull();
    expect(detaillerAlertes([a({ declenchee_le: 'n/a' })])[0].le).toBeNull();
  });
});
