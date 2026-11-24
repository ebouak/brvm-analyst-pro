import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AtelierMacd from '@/components/academy/lecon/AtelierMacd';
import SimulateurTechnique from '@/components/academy/lecon/SimulateurTechnique';
import { simulationSchema } from './types';

/**
 * Rendu des blocs ajoutés à la leçon 5 du niveau 3 (2026-11-24) : un composant
 * qui lève au rendu casserait toute la page de la leçon après la migration.
 */
describe('leçon 5 — rendu', () => {
  it('l’atelier MACD pas à pas affiche le tableau, les composantes et le scénario cours figé', () => {
    const sim = simulationSchema.parse({
      type: 'atelier_macd',
      consigne: 'Essai MACD',
      clotures: [100, 100, 101, 102, 103, 105, 108, 112, 115, 116, 114, 111],
      rapide: 3,
      lente: 6,
      signal: 3,
    });
    if (sim.type !== 'atelier_macd') throw new Error('type inattendu');
    const html = renderToStaticMarkup(createElement(AtelierMacd, { sim }));
    expect(html).toContain('Le MACD pas à pas (3, 6, 3)');
    expect(html).toContain('Tester un cours figé (sans échange)');
    expect(html).toContain('103,54');
    expect(html).toContain('+1,71');
    expect(html).toContain('−0,83');
    expect(html).not.toMatch(/NaN|undefined/);
  });

  it('le simulateur technique MACD expose les trois curseurs 12 / 26 / 9', () => {
    const sim = simulationSchema.parse({
      type: 'technique',
      indicateur: 'macd',
      codes: ['ORAC', 'SGBC'],
      rapide: 12,
      lente: 26,
      signal: 9,
    });
    if (sim.type !== 'technique') throw new Error('type inattendu');
    const html = renderToStaticMarkup(createElement(SimulateurTechnique, { sim }));
    expect(html).toContain('Le MACD et son histogramme sur une série réelle');
    expect(html).toContain('Moyenne rapide');
    expect(html).toContain('Moyenne lente');
    expect(html).toContain('Ligne de signal');
    expect(html).not.toMatch(/NaN|undefined/);
  });
});
