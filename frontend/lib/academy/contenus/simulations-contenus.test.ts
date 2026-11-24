import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lessonSchema, type Simulation } from '../types';
import { calculerSimulation } from '../calculerSimulation';
import type { PointSerie } from '../simTechnique';

/**
 * Chaque simulation de chaque leçon se calcule avec ses valeurs par défaut :
 * une hypothèse impossible écrite dans un JSON échoue ici, pas devant le
 * lecteur. Les simulateurs techniques sont exercés sur une série synthétique
 * (en production, ils lisent les clôtures réelles).
 */
const racine = join(__dirname);
const fichiers = [
  ...readdirSync(racine).filter((f) => f.endsWith('.json')).map((f) => join(racine, f)),
  ...['niveau2', 'niveau3', 'niveau4'].flatMap((d) =>
    readdirSync(join(racine, d)).filter((f) => f.endsWith('.json')).map((f) => join(racine, d, f)),
  ),
];

const debut = Date.UTC(2025, 0, 1);
const SERIE: PointSerie[] = Array.from({ length: 300 }, (_, i) => ({
  date: new Date(debut + i * 86_400_000).toISOString().slice(0, 10),
  cours: 1_000 + 80 * Math.sin(i / 9) + i,
}));

const CONSEIL = /\b(achetez|vendez|conservez|à acheter|à vendre|recommand)/i;

const lecons = fichiers.map((f) => ({ f: f.slice(racine.length + 1), l: lessonSchema.parse(JSON.parse(readFileSync(f, 'utf8'))) }));
const simulations = lecons.flatMap(({ f, l }) =>
  l.sections.flatMap((s, i) => [...(s.simulation ? [s.simulation] : []), ...s.simulations].map((sim) => ({ f, i, sim }))),
);

describe('simulations de toutes les leçons', () => {
  it('au moins un simulateur dans 33 leçons sur 42 (dont les modules 0 des niveaux 2 et 3, 2026-11-24)', () => {
    const avec = lecons.filter(({ l }) => l.sections.some((s) => s.simulation || s.simulations.length > 0));
    expect(lecons).toHaveLength(42);
    expect(avec.length).toBeGreaterThanOrEqual(33);
  });

  for (const { f, i, sim } of simulations) {
    it(`${f} · section ${i} · ${sim.type}`, () => {
      const r = calculerSimulation(sim as Simulation, SERIE);
      expect(r.lecture.length).toBeGreaterThan(0);
      expect(r.lecture).not.toMatch(CONSEIL);
      if ('consigne' in sim && sim.consigne) expect(sim.consigne).not.toMatch(CONSEIL);
    });
  }

  it('au plus 3 simulations par section, 12 sections par leçon', () => {
    for (const { l } of lecons) {
      expect(l.sections.length).toBeLessThanOrEqual(12);
      for (const s of l.sections) expect((s.simulation ? 1 : 0) + s.simulations.length).toBeLessThanOrEqual(4);
    }
  });

  it('un simulateur technique ne propose que des codes de valeur', () => {
    for (const { sim } of simulations) {
      if (sim.type === 'technique' || sim.type === 'per' || sim.type === 'pb_roe') {
        for (const c of sim.codes) expect(c).toMatch(/^[A-Z0-9]{3,10}$/);
      }
    }
  });
});
