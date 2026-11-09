import { describe, it, expect } from 'vitest';
import { croisement, type EntreesCroisement } from './croisement';

const base: EntreesCroisement = { tiers: {}, periode: 'T3 2026', variationResultatPct: null, variationCaPct: null, nbActualites: 0 };
const run = (e: Partial<EntreesCroisement>) => croisement({ ...base, ...e });

describe('croisement', () => {
  it('valorisation haut + résultat en recul > 10 % : divergence', () => {
    expect(run({ tiers: { valorisation: 'haut' }, variationResultatPct: -31 })).toEqual([
      { type: 'divergence', texte: 'Se paie peu cher, mais le résultat du T3 2026 recule de 31 % sur un an.' },
    ]);
  });
  it('valorisation bas + résultat en hausse > 10 % : divergence', () => {
    expect(run({ tiers: { valorisation: 'bas' }, variationResultatPct: 12.5 })).toEqual([
      { type: 'divergence', texte: 'Se paie cher, mais le résultat du T3 2026 progresse de 12,5 % sur un an.' },
    ]);
  });
  it('tendance haut + CA en hausse : convergence', () => {
    expect(run({ tiers: { tendance: 'haut' }, variationCaPct: 8 })).toEqual([
      { type: 'convergence', texte: "Tendance forte, confirmée par un chiffre d'affaires du T3 2026 en hausse de 8 %." },
    ]);
  });
  it('tendance haut + CA en baisse : divergence', () => {
    expect(run({ tiers: { tendance: 'haut' }, variationCaPct: -4.2 })).toEqual([
      { type: 'divergence', texte: "Tendance forte, alors que le chiffre d'affaires du T3 2026 baisse de 4,2 %." },
    ]);
  });
  it('tendance bas + résultat en hausse > 10 % : divergence', () => {
    expect(run({ tiers: { tendance: 'bas' }, variationResultatPct: 20 })).toEqual([
      { type: 'divergence', texte: 'Tendance faible malgré un résultat du T3 2026 en hausse de 20 %.' },
    ]);
  });
  it('qualité haut + résultat en recul > 10 % : divergence', () => {
    expect(run({ tiers: { qualite: 'haut' }, variationResultatPct: -15 })).toEqual([
      { type: 'divergence', texte: "Rentabilité solide sur l'exercice, mais résultat du T3 2026 en recul de 15 %." },
    ]);
  });
  it('le seuil de 10 % est strict', () => {
    expect(run({ tiers: { valorisation: 'haut' }, variationResultatPct: -10 })).toEqual([
      { type: 'info', texte: 'Les derniers résultats ne contredisent ni ne confirment nettement les facteurs.' },
    ]);
  });
  it('sans donnée intermédiaire : info seule', () => {
    expect(run({ periode: null, tiers: { tendance: 'haut' } })).toEqual([
      { type: 'info', texte: 'Pas de résultat intermédiaire comparable publié.' },
    ]);
  });
  it('plus de 5 actualités : info ajoutée', () => {
    const r = run({ nbActualites: 6, tiers: { tendance: 'haut' }, variationCaPct: 3 });
    expect(r.at(-1)).toEqual({ type: 'info', texte: "Valeur très présente dans l'actualité (6 articles en 30 jours)." });
    expect(run({ nbActualites: 5, periode: null })).toHaveLength(1);
  });
  it('plusieurs règles à la fois', () => {
    const r = run({ tiers: { tendance: 'haut', valorisation: 'haut' }, variationCaPct: 5, variationResultatPct: -20 });
    expect(r.map((p) => p.type)).toEqual(['divergence', 'convergence']);
  });
  it('données présentes mais aucune règle : phrase neutre', () => {
    expect(run({ variationCaPct: 2, variationResultatPct: 1 })).toEqual([
      { type: 'info', texte: 'Les derniers résultats ne contredisent ni ne confirment nettement les facteurs.' },
    ]);
  });
  it('format français des grands nombres', () => {
    expect(run({ tiers: { valorisation: 'bas' }, variationResultatPct: 1234.56 })[0].texte).toContain('1 234,6 %');
  });
});
