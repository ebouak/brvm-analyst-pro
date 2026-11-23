import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PARCOURS, simulerParcours, tauxInterne, type SourceParcours } from './parcours';

const DIR = fileURLToPath(new URL('./contenus/niveau2/sources/', import.meta.url));
const src = JSON.parse(readFileSync(`${DIR}cours-parcours.json`, 'utf-8')) as SourceParcours;
const fige = JSON.parse(readFileSync(`${DIR}parcours-resultats.json`, 'utf-8')) as Record<string, unknown>;

describe('parcours reconstitués — moteur', () => {
  it('le taux interne d’un placement doublé en un an vaut 100 %', () => {
    expect(tauxInterne([{ date: '2020-01-01', montant: -100 }, { date: '2021-01-01', montant: 200 }])).toBeCloseTo(1, 2);
  });

  it.each(Object.entries(PARCOURS))('%s : comptes équilibrés au franc près', (_nom, regles) => {
    const r = simulerParcours(src, regles);
    const investi = r.lignes.reduce((s, l) => s + l.cout, 0);
    // Tout franc versé ou reçu en dividende est soit investi, soit en liquidités.
    expect(investi + r.liquidites).toBe(r.verse + r.dividendes);
    expect(r.valeur_finale).toBe(r.valeur_titres + r.liquidites);
    expect(r.achats.reduce((s, a) => s + a.cout, 0)).toBe(investi);
    for (const a of r.achats) expect(Number.isInteger(a.titres) && a.titres > 0).toBe(true);
    // Quotité Sonatel : dix titres ajustés = un titre d'avant le fractionnement du 26/10/2026.
    for (const a of r.achats) if (a.code === 'SNTS' && a.seance < '2026-10-26') expect(a.titres % 10).toBe(0);
  });

  it('les résultats figés, cités dans la leçon 7, sont ceux du calcul', () => {
    for (const [nom, regles] of Object.entries(PARCOURS)) {
      const { achats, ...r } = simulerParcours(src, regles);
      expect({ ...r, nb_achats: achats.length }, nom).toEqual(fige[nom]);
    }
  });

  it('le parcours de dix ans passe sous les sommes versées de 2017 à 2020', () => {
    const r = simulerParcours(src, PARCOURS.annuel);
    for (const p of r.points.filter((x) => x.ancre <= '2020-11-20')) expect(p.valeur).toBeLessThan(p.verse);
    expect(r.valeur_finale).toBeGreaterThan(r.verse);
  });
});
