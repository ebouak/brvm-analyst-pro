import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonSchema, type Lesson } from '../types';
import { exemplesCours, lectureIndices } from '../donneesReelles';
import l1 from './lecon1-brvm.json';
import l2 from './lecon2-acteurs.json';
import l3 from './lecon3-budget.json';
import l4 from './lecon4-gagner.json';

/**
 * Leçons 1 à 4 du Niveau 1, réécrites le 2026-11-13 sur le modèle des leçons
 * 5 à 11. Les versions précédentes affichaient comme « données réelles » des
 * cours faux (8 sur 8 au 17/07/2026) et trois cas présentés comme réels qui
 * étaient inventés. Ces tests empêchent leur retour.
 */
const LECONS: [number, unknown][] = [[1, l1], [2, l2], [3, l3], [4, l4]];
const parse = (brut: unknown): Lesson => lessonSchema.parse(brut);
const bonne = (l: Lesson, i: number) => l.quiz![i]!.options[l.quiz![i]!.correct];
const APP = fileURLToPath(new URL('../../../app/', import.meta.url));

describe.each(LECONS)('leçon %i — règles éditoriales', (n, brut) => {
  const l = parse(brut);
  const texte = JSON.stringify(brut);

  it('titre numéroté comme sa position dans le cours', () => {
    expect(l.titre.startsWith(`Leçon ${n} — `)).toBe(true);
  });

  it('cinq questions ; la question unique historique reprend la première', () => {
    expect(l.quiz?.length).toBe(5);
    expect(l.qcm).toEqual(l.quiz![0]);
  });

  it('avertissement, sous-titre et paragraphes courts', () => {
    expect(l.avertissement).toContain('pas un conseil en investissement');
    expect(l.sous_titre).toBeTruthy();
    for (const s of l.sections) for (const p of s.contenu.split(/\n+/)) expect(p.length, s.titre).toBeLessThanOrEqual(320);
  });

  it('aucun graphique écrit à la main : les chiffres de marché viennent de la base', () => {
    expect(l.charts).toEqual([]);
    expect(l.chart ?? null).toBeNull();
    for (const s of l.sections) if (s.reel) expect(s.donnees_reelles, s.titre).toBeTruthy();
  });

  it('ni témoignage, ni ancien nom du régulateur employé seul', () => {
    expect(texte).not.toMatch(/\b(M\.|Mme|Mlle) [A-ZÉ]/);
    expect(texte).not.toMatch(/[Tt]émoignage|[Cc]as réel/);
    expect(texte).not.toMatch(/crepmf\.org/i);
    // « CREPMF » n'apparaît que pour dire que l'AMF-UMOA lui a succédé.
    for (const m of texte.matchAll(/CREPMF/g)) expect(texte.slice(Math.max(0, m.index! - 60), m.index), 'CREPMF hors contexte').toMatch(/succédé|ex-/);
  });

  it('les liens « pratiquer » mènent à des pages qui existent', () => {
    for (const lien of l.liens) expect(existsSync(`${APP}${lien.href.replace(/^\//, '')}/page.tsx`), lien.href).toBe(true);
  });
});

describe('réponses de calcul : la bonne option est bien le bon résultat', () => {
  it('leçon 3 — 10 × 2 500 + 1 % = 25 250 ; 1,5 % × 2 ≈ 3 % ; 1/5 de 50 000 × 20 % = 2 000', () => {
    expect(10 * 2500 * 1.01).toBe(25_250);
    expect(bonne(parse(l3), 0)).toBe('25 250 FCFA');
    expect(bonne(parse(l3), 1)).toBe('3 %');
    expect((50_000 / 5) * 0.2).toBe(2_000);
    expect(bonne(parse(l3), 3)).toBe('2 000 FCFA');
  });
  it('leçon 4 — (5 600 − 5 000) × 200 = 120 000 ; (80 000 + 120 000) ÷ 1 000 000 = 20 %', () => {
    expect((5600 - 5000) * 200).toBe(120_000);
    expect(bonne(parse(l4), 0)).toBe('120 000 FCFA');
    expect(((80_000 + 120_000) / 1_000_000) * 100).toBe(20);
    expect(bonne(parse(l4), 1)).toBe('20 %');
  });
});

describe('données réelles : cours et indices', () => {
  const cot = [
    { code: 'AAAA', cours: 2500, date: '2026-11-12' },
    { code: 'BBBB', cours: 30000, date: '2026-11-13' },
  ];
  it('cours : coût de N actions, valeur sans cours nommée', () => {
    const r = exemplesCours(['AAAA', 'BBBB', 'CCCC'], { AAAA: 'Société A' }, cot, 10);
    expect(r.lignes.map((l) => [l.code, l.cout])).toEqual([['AAAA', 25_000], ['BBBB', 300_000]]);
    expect(r.lignes[0]!.nom).toBe('Société A');
    expect(r.manquants).toEqual(['CCCC']);
    expect(r.dateCours).toBe('2026-11-13');
  });
  it('cours : sans quantité, aucun coût inventé', () => {
    expect(exemplesCours(['AAAA'], {}, cot).lignes[0]!.cout).toBeNull();
  });
  it('indices : dernière valeur de chaque code, indice absent nommé', () => {
    const r = lectureIndices(['BRVMC', 'BRVM30', 'XXXX'], [
      { code: 'BRVMC', date_marche: '2026-11-12', libelle: 'BRVM Composite', valeur: 520, variation_pct: 0.1 },
      { code: 'BRVMC', date_marche: '2026-11-13', libelle: 'BRVM Composite', valeur: 530, variation_pct: 1.9 },
      { code: 'BRVM30', date_marche: '2026-11-13', libelle: 'BRVM 30', valeur: 0, variation_pct: null },
    ]);
    expect(r.lignes.map((l) => [l.code, l.valeur])).toEqual([['BRVMC', 530]]);
    expect(r.manquants).toEqual(['BRVM30', 'XXXX']);
  });
});
