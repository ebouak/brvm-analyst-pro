import { describe, it, expect } from 'vitest';
import { versSignalPublic, signauxPublicsDeLaSeance, type LigneSignalPublic } from './publics';

const l = (code: string, date: string, extra: Partial<LigneSignalPublic> = {}): LigneSignalPublic => ({
  code,
  date_marche: date,
  signal: 'HOLD',
  score_total: 0.1,
  confiance: 0.8,
  ...extra,
});

describe('versSignalPublic', () => {
  it('garde la note publique et laisse les sous-scores à null', () => {
    const s = versSignalPublic(l('SNTS', '2026-11-10', { score_total: -0.3365 }))!;
    expect(s).toMatchObject({ code: 'SNTS', signal: 'HOLD', score_total: -0.3365, confiance: 0.8 });
    expect(s.score_variation).toBeNull();
    expect(s.explication).toBeNull();
  });

  it('convertit les numeric reçus en chaîne', () => {
    const s = versSignalPublic({ ...l('A', '2026-11-10'), score_total: '0.24' as unknown as number, confiance: '0.5' as unknown as number })!;
    expect(s.score_total).toBe(0.24);
    expect(s.confiance).toBe(0.5);
  });

  it('écarte un signal inconnu ou un score absent au lieu d’inventer', () => {
    expect(versSignalPublic(l('A', '2026-11-10', { signal: 'ACHAT' }))).toBeNull();
    expect(versSignalPublic(l('A', '2026-11-10', { signal: null }))).toBeNull();
    expect(versSignalPublic(l('A', '2026-11-10', { score_total: null }))).toBeNull();
  });

  it('garde une confiance absente à null', () => {
    expect(versSignalPublic(l('A', '2026-11-10', { confiance: null }))!.confiance).toBeNull();
  });
});

describe('signauxPublicsDeLaSeance', () => {
  it('ne garde que la séance demandée (une valeur suspendue porte une note plus ancienne)', () => {
    const r = signauxPublicsDeLaSeance([l('A', '2026-11-10'), l('B', '2026-10-02'), l('C', '2026-11-10')], '2026-11-10');
    expect(r.map((s) => s.code)).toEqual(['A', 'C']);
  });
});
