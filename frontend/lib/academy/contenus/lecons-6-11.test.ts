import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonSchema, type Lesson } from '../types';
import { capitalPourObjectif, simulerReinvestissement } from '../simulations';
import { executerOrdre } from '../carnet';
import { analyserAllocation, simulerScenario } from '../allocation';
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
/** Calcule une simulation quelle qu'elle soit : doit aller au bout sans lever. */
function calculer(sm: Lesson['sections'][number]['simulation']) {
  if (!sm) return;
  if (sm.type === 'carnet') {
    const r = executerOrdre(sm.niveaux, { sens: 'achat', quantite: sm.quantite_defaut, limite: 'au_mieux', condition: 'sans', validite: 'jour' });
    expect(r.statut).toBe('execute');
  }
  if (sm.type === 'allocation') expect(analyserAllocation(sm.secteurs, sm.capital, sm.seuil_secteur_pct).totalPct).toBe(100);
  if (sm.type === 'scenario_baisse') {
    const p = { capital: sm.capital, rendement_pct: sm.rendement_pct, lignes: sm.secteurs };
    expect(simulerScenario(p, { type: 'marche', baisse_pct: 10 }).capitalApres).toBeGreaterThan(0);
    expect(simulerScenario(p, { type: 'secteur', nom: sm.secteurs[0]!.nom, baisse_pct: 30 }).capitalApres).toBeGreaterThan(0);
    expect(simulerScenario(p, { type: 'dividende', nom: sm.secteurs[0]!.nom, facteur: 0.5 }).revenuApres).toBeGreaterThan(0);
  }
}
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
      for (const sm of [s.simulation, ...s.simulations]) calculer(sm);
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

describe('leçon 6 — simulateurs interactifs', () => {
  const l = parse(l6);
  const toutes = l.sections.flatMap((s) => [s.simulation, ...s.simulations]).filter((x) => x != null);

  it('porte les trois simulateurs, dans huit sections au plus', () => {
    expect(l.sections.length).toBeLessThanOrEqual(8);
    expect(toutes.map((x) => x!.type).sort()).toEqual(['allocation', 'carnet', 'scenario_baisse']);
  });

  it('le carnet de la leçon reproduit les exemples de la mise en situation (3 283 de moyenne)', () => {
    const c = toutes.find((x) => x!.type === 'carnet') as Extract<NonNullable<(typeof toutes)[number]>, { type: 'carnet' }>;
    expect(c.quantite_defaut).toBe(5000);
    expect(executerOrdre(c.niveaux, { sens: 'achat', quantite: 5000, limite: 'au_mieux', condition: 'sans', validite: 'jour' }).prixMoyen).toBe(3283);
    expect(executerOrdre(c.niveaux, { sens: 'achat', quantite: 5000, limite: { prix: 3270 }, condition: 'sans', validite: 'jour' }).quantiteServie).toBe(0);
    expect(executerOrdre(c.niveaux, { sens: 'achat', quantite: 10_000, limite: { prix: 3290 }, condition: 'tout_ou_rien', validite: 'jour' }).quantiteServie).toBe(0);
  });

  it('le scénario par défaut reproduit le tableau de la leçon : dividende divisé par deux sur une ligne de 20 % = −10 % de revenu', () => {
    const sc = toutes.find((x) => x!.type === 'scenario_baisse') as Extract<NonNullable<(typeof toutes)[number]>, { type: 'scenario_baisse' }>;
    const r = simulerScenario({ capital: sc.capital, rendement_pct: sc.rendement_pct, lignes: sc.secteurs }, { type: 'dividende', nom: sc.secteurs[0]!.nom, facteur: 0.5 });
    expect([r.revenuAvant, r.revenuApres, r.variationRevenuPct]).toEqual([80_000, 72_000, -10]);
  });
});
