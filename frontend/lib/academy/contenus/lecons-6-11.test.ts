import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonSchema, type Lesson } from '../types';
import { capitalPourObjectif, simulerReinvestissement } from '../simulations';
import l6 from './lecon6-risques.json';
import l7 from './lecon7-scolarite.json';
import l8 from './lecon8-strategies.json';
import l9 from './lecon9-compte-ordre.json';
import l10 from './lecon10-diaspora.json';
import l11 from './lecon11-comparaison.json';

/**
 * Leçons 6 à 11 du Niveau 1, réécrites sur le modèle de la leçon 5
 * (2026-10-20). Règles communes + vérification des réponses de calcul :
 * un index de bonne réponse décalé passerait le schéma sans rien signaler.
 */
const LECONS: [number, unknown][] = [[6, l6], [7, l7], [8, l8], [9, l9], [10, l10], [11, l11]];
const parse = (brut: unknown): Lesson => lessonSchema.parse(brut);
const bonne = (l: Lesson, i: number) => l.quiz![i]!.options[l.quiz![i]!.correct];
const APP = fileURLToPath(new URL('../../../app/', import.meta.url));

describe.each(LECONS)('leçon %i — règles éditoriales', (n, brut) => {
  const l = parse(brut);

  it('titre numéroté comme sa position dans le cours', () => {
    expect(l.titre.startsWith(`Leçon ${n} — `)).toBe(true);
  });

  it('au moins 5 questions ; la question unique historique reprend la première', () => {
    expect(l.quiz?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(l.qcm).toEqual(l.quiz![0]);
  });

  it('avertissement, sous-titre et paragraphes courts', () => {
    expect(l.avertissement).toContain('pas un conseil en investissement');
    expect(l.sous_titre).toBeTruthy();
    for (const s of l.sections) for (const p of s.contenu.split(/\n+/)) expect(p.length, s.titre).toBeLessThanOrEqual(320);
  });

  it('« Cas réel » seulement adossé à des données réelles lues en base', () => {
    for (const s of l.sections) if (s.reel) expect(s.donnees_reelles, s.titre).toBeTruthy();
    expect(l.sections.some((s) => s.donnees_reelles)).toBe(true);
  });

  it('les simulations se calculent', () => {
    for (const s of l.sections) {
      if (s.simulation?.type === 'reinvestissement') expect(simulerReinvestissement(s.simulation).length).toBe(s.simulation.annees);
      if (s.simulation?.type === 'objectif') expect(capitalPourObjectif(s.simulation.revenu_cible, s.simulation.rendements_pct).length).toBeGreaterThan(0);
    }
  });

  it('les liens « pratiquer » mènent à des pages qui existent', () => {
    for (const lien of l.liens) expect(existsSync(`${APP}${lien.href.replace(/^\//, '')}/page.tsx`), lien.href).toBe(true);
  });
});

describe('réponses de calcul : la bonne option est bien le bon résultat', () => {
  it('leçon 6 — une ligne sur cinq divise son dividende par deux : −10 %', () => {
    expect(bonne(parse(l6), 1)).toContain('10 %');
    expect(bonne(parse(l6), 4)).toContain('1 200 000');
  });
  it('leçon 7 — revenu 200 × 1 200 + 100 × 400 = 280 000 ; capital 1 000 000 ÷ 8 % = 12 500 000 ; 1,1¹⁰ ≈ 2,594', () => {
    expect(200 * 1200 + 100 * 400).toBe(280_000);
    expect(bonne(parse(l7), 0)).toContain('280 000');
    expect(capitalPourObjectif(1_000_000, [8])[0]!.capital).toBe(12_500_000);
    expect(bonne(parse(l7), 1)).toContain('12 500 000');
    expect(Math.round(1000 * 1.1 ** 10)).toBe(2594);
    expect(bonne(parse(l7), 3)).toContain('2 594');
  });
  it('leçon 8 — PER 12 000 ÷ 1 500 = 8', () => {
    expect(12_000 / 1_500).toBe(8);
    expect(bonne(parse(l8), 1)).toBe('8');
  });
  it('leçon 9 — 20 × 10 000 + 1 % de frais = 202 000', () => {
    expect(20 * 10_000 * 1.01).toBe(202_000);
    expect(bonne(parse(l9), 3)).toContain('202 000');
  });
  it('leçon 10 — 1 000 € × 655,957 = 655 957 FCFA', () => {
    expect(Math.round(1000 * 655.957)).toBe(655_957);
    expect(bonne(parse(l10), 0)).toContain('655 957');
  });
  it('leçon 11 — (400 + 10 600 − 10 000) ÷ 10 000 = 10 %', () => {
    expect(((400 + 10_600 - 10_000) / 10_000) * 100).toBe(10);
    expect(bonne(parse(l11), 1)).toBe('10 %');
  });
});
