import { describe, it, expect } from 'vitest';
import { lessonSchema } from '../types';
import { capitalPourObjectif, simulerReinvestissement } from '../simulations';
import brut from './lecon5-dividendes.json';

const lecon = lessonSchema.parse(brut);

describe('leçon 5 — dividendes (contenu éditorial)', () => {
  it('est valide pour le schéma et tient en huit sections', () => {
    expect(lecon.sections).toHaveLength(8);
  });

  it('la simulation de réinvestissement redonne l’exemple du texte : 300 000 puis 346 500', () => {
    const sim = lecon.sections.find((s) => s.simulation?.type === 'reinvestissement')!.simulation!;
    if (sim.type !== 'reinvestissement') throw new Error('type inattendu');
    const [a1, a2] = simulerReinvestissement(sim);
    expect(a1).toMatchObject({ revenuReinvest: 300_000, actionsAchetees: 30 });
    expect(a2).toMatchObject({ actionsReinvest: 330, revenuReinvest: 346_500 });
  });

  it('l’objectif redonne 10 000 000 à 6 % et 7 500 000 à 8 %', () => {
    const sim = lecon.sections.find((s) => s.simulation?.type === 'objectif')!.simulation!;
    if (sim.type !== 'objectif') throw new Error('type inattendu');
    expect(capitalPourObjectif(sim.revenu_cible, sim.rendements_pct).map((l) => l.capital)).toEqual([10_000_000, 7_500_000]);
  });

  it('aucun exemple ne se présente comme réel ; l’avertissement est présent', () => {
    expect(lecon.sections.some((s) => s.reel)).toBe(false);
    expect(lecon.avertissement).toContain('Les dividendes ne sont pas garantis');
  });

  it('quiz d’au moins 5 questions, chacune expliquée', () => {
    expect(lecon.quiz?.length ?? 0).toBeGreaterThanOrEqual(5);
    for (const q of lecon.quiz ?? []) expect(q.explication.length).toBeGreaterThan(20);
  });

  it('exemples réels déclarés par codes seulement : rendement (300 actions) et historique', () => {
    const vues = lecon.sections.flatMap((s) => (s.donnees_reelles ? [s.donnees_reelles] : []));
    expect(vues.map((v) => v.vue)).toEqual(['rendement', 'historique']);
    expect(vues[0]).toMatchObject({ actions: 300 });
  });

  it('chaque paragraphe reste court (≤ 320 caractères)', () => {
    for (const s of lecon.sections) {
      for (const p of s.contenu.split(/\n+/)) expect(p.length, s.titre).toBeLessThanOrEqual(320);
    }
  });
});
