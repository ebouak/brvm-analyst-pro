import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonSchema, type Lesson } from '../../types';

/**
 * Niveau 2 « Analyse fondamentale », réécrit le 2026-11-14 au format du
 * niveau 1 : chiffres de marché lus en base (blocs donnees_reelles, dont la
 * vue « ratios »), graphiques d'exemple déclarés comme tels, 5 questions.
 */
const DIR = fileURLToPath(new URL('./', import.meta.url));
const APP = fileURLToPath(new URL('../../../../app/', import.meta.url));
const FICHIERS = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const LECONS: [string, Lesson, string][] = FICHIERS.map((f) => {
  const brut = readFileSync(`${DIR}${f}`, 'utf-8');
  return [f, lessonSchema.parse(JSON.parse(brut)), brut];
});

describe('niveau 2 — structure', () => {
  it('dix leçons, numérotées dans l’ordre des fichiers', () => {
    expect(LECONS).toHaveLength(10);
    LECONS.forEach(([, l], i) => expect(l.titre.startsWith(`Leçon ${i + 1} — `), l.titre).toBe(true));
  });
});

describe.each(LECONS)('%s — règles éditoriales', (_f, l, brut) => {
  it('cinq questions, réponses dans les options ; la question unique reprend la première', () => {
    expect(l.quiz).toHaveLength(5);
    for (const q of l.quiz!) expect(q.correct).toBeLessThan(q.options.length);
    expect(l.qcm).toEqual(l.quiz![0]);
  });

  it('avertissement, sous-titre, module et paragraphes courts', () => {
    expect(l.avertissement).toContain('pas un conseil en investissement');
    expect(l.sous_titre).toBeTruthy();
    expect(l.module).toMatch(/^Module [1-3] — /);
    for (const s of l.sections) for (const p of s.contenu.split(/\n+/)) expect(p.length, s.titre).toBeLessThanOrEqual(320);
  });

  it('un cas « réel » lit ses chiffres en base ; un graphique écrit à la main est un exemple', () => {
    for (const s of l.sections) if (s.reel) expect(s.donnees_reelles, s.titre).toBeTruthy();
    for (const c of l.charts) {
      expect(c.reel).toBe(false);
      expect(c.note.toLowerCase()).toMatch(/exemple/);
    }
  });

  it('ni témoignage inventé, ni ancien nom du régulateur employé seul', () => {
    expect(brut).not.toMatch(/\b(M\.|Mme|Mlle) [A-ZÉ]/);
    expect(brut).not.toMatch(/[Tt]émoignage/);
    for (const m of brut.matchAll(/CREPMF/g)) expect(brut.slice(Math.max(0, m.index! - 60), m.index)).toMatch(/succédé|ex-/);
  });

  it('les liens « pratiquer » mènent à des pages qui existent', () => {
    for (const lien of l.liens) expect(existsSync(`${APP}${lien.href.replace(/^\//, '')}/page.tsx`), lien.href).toBe(true);
  });
});

describe('réponses de calcul : la bonne option est le bon résultat', () => {
  const bonne = (n: number, i: number) => {
    const q = LECONS[n - 1]![1].quiz![i]!;
    return q.options[q.correct];
  };
  it('PER, BPA, ROE, P/B, rendement', () => {
    expect(bonne(2, 0)).toBe(String(4500 / 300));
    expect(bonne(2, 1)).toBe(`${5e9 / 2e7} FCFA`);
    expect(bonne(3, 0)).toBe(`${(10 / 50) * 100} %`);
    expect(bonne(3, 1)).toBe(String(8 * 0.25));
    expect(bonne(3, 2)).toBe(`${Math.round((140 / 2000) * 100)} %`);
    expect(bonne(4, 1)).toBe(`${(48 / 120) * 100} %`);
  });
  it('DPS, simulation, fiscalité, obligations, OPCVM', () => {
    expect(bonne(6, 0)).toBe(`${(8000 - 6000) / 4} FCFA`);
    expect(bonne(6, 1)).toBe('7 500 FCFA');
    expect(bonne(7, 0)).toBe('5 000 000 FCFA');
    expect(bonne(7, 1)).toBe(String((100 * 600) / 10000));
    expect(bonne(8, 0)).toBe('1 320 FCFA');
    expect(bonne(9, 0)).toBe(`${Math.round(10000 * 0.07)} FCFA`);
    expect(bonne(10, 0)).toBe('5 000 FCFA');
    expect(bonne(10, 1)).toBe('1 940 000 FCFA');
  });
});
