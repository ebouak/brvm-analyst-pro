import { describe, it, expect } from 'vitest';
import { composeSlides, estAffichable, PERMANENT_SLIDES, MAX_SLIDES, MIN_PERMANENT, type LandingSlideRow, rowToSlide } from './slides';

const NOW = new Date('2026-09-21T10:00:00Z');
const U = 'https://x.supabase.co';
const row = (i: number, over: Partial<LandingSlideRow> = {}): LandingSlideRow => ({
  id: `a${i}`, kind: 'ad', title: `Pub ${i}`, subtitle: null, cta_label: null, link_url: 'https://annonceur.example',
  image_path: `2026-09/${i}.jpg`, sponsor_name: `Annonceur ${i}`, starts_at: '2026-09-01T00:00:00Z', ends_at: null,
  is_active: true, position: i, ...over,
});

describe('estAffichable', () => {
  it('écarte inactif, futur, expiré, sans image', () => {
    expect(estAffichable(row(1), NOW)).toBe(true);
    expect(estAffichable(row(1, { is_active: false }), NOW)).toBe(false);
    expect(estAffichable(row(1, { starts_at: '2026-10-01T00:00:00Z' }), NOW)).toBe(false);
    expect(estAffichable(row(1, { ends_at: '2026-09-20T00:00:00Z' }), NOW)).toBe(false);
    expect(estAffichable(row(1, { image_path: '' }), NOW)).toBe(false);
  });
});

describe('composeSlides', () => {
  it('sans vue admin : les 4 permanentes, dans l’ordre', () => {
    const s = composeSlides(PERMANENT_SLIDES, [], U, NOW);
    expect(s.map((x) => x.id)).toEqual(['p-photo', 'p-note', 'p-brief', 'p-dossiers']);
  });
  it('plafond 10 et au moins 3 permanentes même si un admin programme 12 pubs', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(i + 1));
    const s = composeSlides(PERMANENT_SLIDES, rows, U, NOW);
    expect(s).toHaveLength(MAX_SLIDES);
    expect(s.filter((x) => x.kind === 'permanent')).toHaveLength(MIN_PERMANENT);
    expect(s.filter((x) => x.kind === 'ad')).toHaveLength(7);
  });
  it('avec 3 pubs : 4 permanentes + 3 pubs, triées par position', () => {
    const s = composeSlides(PERMANENT_SLIDES, [row(3), row(1), row(2)], U, NOW);
    expect(s.map((x) => x.id)).toEqual(['p-photo', 'p-note', 'p-brief', 'p-dossiers', 'a1', 'a2', 'a3']);
  });
  it('une pub porte toujours son annonceur ; une annonce maison jamais', () => {
    const ad = rowToSlide(row(1, { sponsor_name: null }), U);
    expect(ad.sponsorName).toBe('Annonceur');
    const house = rowToSlide(row(2, { kind: 'house', sponsor_name: 'X' }), U);
    expect(house.sponsorName).toBeNull();
  });
  it('construit l’URL publique du bucket', () => {
    expect(rowToSlide(row(1), U).imageUrl).toBe('https://x.supabase.co/storage/v1/object/public/landing-slides/2026-09/1.jpg');
  });
});
