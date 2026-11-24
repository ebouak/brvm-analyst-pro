import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AtelierRsi from '@/components/academy/lecon/AtelierRsi';
import { simulationSchema } from './types';

/**
 * Rendu de l'atelier ajouté à la leçon 4 du niveau 3 (2026-11-24) : un composant
 * qui lève au rendu casserait toute la page de la leçon après la migration.
 */
describe('leçon 4 — rendu', () => {
  it('l’atelier « le RSI pas à pas » affiche les moyennes lissées et le RSI à partir de la séance 15', () => {
    const sim = simulationSchema.parse({
      type: 'rsi_pas_a_pas',
      consigne: 'Essai',
      clotures: [1000, 1020, 1015, 1030, 1025, 1040, 1050, 1045, 1060, 1070, 1065, 1080, 1075, 1090, 1100, 1085, 1095],
    });
    if (sim.type !== 'rsi_pas_a_pas') throw new Error('type inattendu');
    const html = renderToStaticMarkup(createElement(AtelierRsi, { sim }));
    expect(html).toContain('Le RSI calculé séance par séance');
    expect(html).toContain('>83,3<');
    expect(html).toContain('>8,93<');
    expect(html).toContain('Figer le cours sur les 5 dernières séances');
    expect(html).toMatch(/il apparaît à la séance 15/);
    expect(html).not.toMatch(/NaN|undefined/);
  });
});
