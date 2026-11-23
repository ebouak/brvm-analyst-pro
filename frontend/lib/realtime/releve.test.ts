import { describe, expect, it } from 'vitest';
import { etatReleve, phraseReleve, phraseReleveCourte, dernierReleveDe, echangesDuMarche } from './releve';

const d = (iso: string) => new Date(iso);

describe('etatReleve / phraseReleve', () => {
  it('relevé récent : heure, âge, prochain vers', () => {
    expect(phraseReleve({ dernier: d('2026-11-23T12:15:59Z'), maintenant: d('2026-11-23T12:20:10Z') }))
      .toBe('Relevé de 12:15 · il y a 4 min · prochain vers 12:30');
  });
  it('juste arrivé : « à l’instant »', () => {
    expect(phraseReleve({ dernier: d('2026-11-23T12:15:59Z'), maintenant: d('2026-11-23T12:16:20Z') }))
      .toBe("Relevé de 12:15 · à l'instant · prochain vers 12:30");
  });
  it('au-delà de 25 min : relevé en retard, plus de « prochain vers »', () => {
    const e = etatReleve(d('2026-11-23T12:15:00Z'), d('2026-11-23T12:41:00Z'));
    expect(e.enRetard).toBe(true);
    expect(phraseReleve({ dernier: d('2026-11-23T12:15:00Z'), maintenant: d('2026-11-23T12:41:00Z') }))
      .toBe('Relevé de 12:15 · il y a 26 min · relevé en retard');
  });
  it('après la séance : aucun prochain relevé annoncé, jamais « en retard »', () => {
    const e = etatReleve(d('2026-11-23T15:50:00Z'), d('2026-11-23T18:00:00Z'));
    expect(e.prochain).toBeNull();
    expect(e.enRetard).toBe(false);
    expect(phraseReleve({ dernier: d('2026-11-23T15:50:00Z'), maintenant: d('2026-11-23T18:00:00Z') }))
      .toBe('Relevé de 15:50 · il y a 2 h');
  });
  it('aucun échange depuis l’ouverture : dit tel quel', () => {
    expect(phraseReleve({ dernier: d('2026-11-23T09:45:00Z'), maintenant: d('2026-11-23T09:50:00Z'), echanges: false }))
      .toBe("Aucun échange relevé depuis l'ouverture · relevé de 09:45");
    expect(phraseReleveCourte({ dernier: d('2026-11-23T09:45:00Z'), maintenant: d('2026-11-23T09:50:00Z'), echanges: false }))
      .toBe("aucun échange depuis l'ouverture · relevé de 09:45");
  });
  it('version courte : sans l’âge', () => {
    expect(phraseReleveCourte({ dernier: d('2026-11-23T12:15:00Z'), maintenant: d('2026-11-23T12:20:00Z'), echanges: true }))
      .toBe('relevé de 12:15 · prochain vers 12:30');
  });
});

describe('dernierReleveDe', () => {
  it('prend la plus récente updated_at, ignore les absentes', () => {
    expect(dernierReleveDe([{ updated_at: '2026-11-23T12:00:58Z' }, { updated_at: null }, { updated_at: '2026-11-23T12:15:59Z' }, {}])?.toISOString())
      .toBe('2026-11-23T12:15:59.000Z');
    expect(dernierReleveDe([{}, { updated_at: null }])).toBeNull();
  });
});

describe('echangesDuMarche', () => {
  const lignes = (n: number, volume: number | null) => Array.from({ length: n }, () => ({ volume }));
  it('tous les volumes à zéro : false', () => {
    expect(echangesDuMarche(lignes(48, 0))).toBe(false);
  });
  it('un seul échange suffit : true', () => {
    expect(echangesDuMarche([...lignes(47, 0), { volume: 120 }])).toBe(true);
  });
  it('trop peu de valeurs pour parler du marché, ou volumes inconnus : null', () => {
    expect(echangesDuMarche(lignes(1, 0))).toBeNull();
    expect(echangesDuMarche(lignes(48, null))).toBeNull();
  });
});
