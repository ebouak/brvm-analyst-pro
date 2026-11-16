import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agregerHebdo, lundiDeLaSemaine, serieCloture, serieVolume, type PointCours } from './serieCours';

const pts: PointCours[] = [
  { date: '2026-11-09', close: 100, volume: 10 },
  { date: '2026-11-10', close: null, volume: null },
  { date: '2026-11-11', close: 0, volume: 5 },
  { date: '2026-11-12', close: 103, volume: null },
  { date: '2026-11-16', close: 104, volume: null },
];

describe('courbe de clôture de la fiche', () => {
  it('ne garde que les séances dont la clôture existe', () => {
    expect(serieCloture(pts)).toEqual([
      { date: '2026-11-09', valeur: 100 },
      { date: '2026-11-12', valeur: 103 },
      { date: '2026-11-16', valeur: 104 },
    ]);
  });

  it('un volume absent n’est pas un zéro', () => {
    expect(serieVolume(pts)).toEqual([
      { date: '2026-11-09', valeur: 10 },
      { date: '2026-11-11', valeur: 5 },
    ]);
  });

  it('hebdomadaire : dernière clôture connue, volume null si aucun volume connu', () => {
    expect(lundiDeLaSemaine('2026-11-12')).toBe('2026-11-09');
    expect(lundiDeLaSemaine('2026-11-16')).toBe('2026-11-16');
    expect(agregerHebdo(pts)).toEqual([
      { date: '2026-11-09', close: 103, volume: 10 },
      { date: '2026-11-16', close: 104, volume: null },
    ]);
  });
});

describe('aucune bougie fabriquée', () => {
  // Le composant ne reçoit que clôture et volume : toute bougie y serait construite
  // à partir de valeurs absentes (ouverture = veille, extrêmes à ±0,1 %).
  const source = readFileSync(join(__dirname, '..', '..', 'components', 'PriceChart.tsx'), 'utf8');

  it('PriceChart ne trace aucune bougie', () => {
    expect(source).not.toMatch(/CandlestickSeries|CandlestickData/);
    expect(source).not.toMatch(/Bougies/);
  });

  it('PriceChart ne fabrique ni ouverture ni plus haut / plus bas', () => {
    expect(source).not.toMatch(/\*\s*1\.001|\*\s*0\.999/);
    expect(source).not.toMatch(/\bopen\s*[:=]/);
    expect(source).not.toMatch(/\bhigh\s*[:=]|\blow\s*[:=]/);
  });

  it('PricePoint ne porte que la clôture et le volume', () => {
    const decl = source.match(/export interface PricePoint \{([\s\S]*?)\}/)?.[1] ?? '';
    expect(decl).not.toMatch(/open|high|low|ouverture|haut|bas/);
  });
});
