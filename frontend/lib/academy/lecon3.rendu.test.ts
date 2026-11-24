import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AtelierMoyenne from '@/components/academy/lecon/AtelierMoyenne';
import DonneesReelles from '@/components/academy/lecon/DonneesReelles';
import { simulationSchema } from './types';

/**
 * Rendu des blocs ajoutés à la leçon 3 du niveau 3 (2026-11-24) : un composant
 * qui lève au rendu casserait toute la page de la leçon après la migration.
 */
describe('leçon 3 — rendu', () => {
  it('l’atelier « la moyenne qui glisse » affiche le calcul pas à pas', () => {
    const sim = simulationSchema.parse({ type: 'moyenne_glissante', consigne: 'Essai', clotures: [100, 102, 101, 105, 107, 108, 106, 104], periode: 5 });
    if (sim.type !== 'moyenne_glissante') throw new Error('type inattendu');
    const html = renderToStaticMarkup(createElement(AtelierMoyenne, { sim }));
    expect(html).toContain('La moyenne qui glisse, séance par séance');
    for (const v of ['103', '104,6', '105,4', '106']) expect(html).toContain(`>${v}<`);
    expect(html).toContain('100 · 102 · 101 · 105 · 107');
    expect(html).toMatch(/les 4 premières séances n’en ont pas/);
    expect(html).not.toMatch(/NaN|undefined/);
  });

  it('le tableau « Données réelles » affiche l’écart à chaque moyenne, signe moins compris', () => {
    const html = renderToStaticMarkup(createElement(DonneesReelles, {
      donnees: {
        vue: 'technique',
        date: '2026-11-24',
        manquants: [],
        lignes: [{
          code: 'SNTS', nom: 'SONATEL', date: '2026-11-24', cours: 3900, mm20: 4119, mm50: 4250,
          ecart20Pct: (3900 / 4119 - 1) * 100, ecart50Pct: (3900 / 4250 - 1) * 100,
          rsi14: 39, position: 'sous les deux', zoneRsi: 'neutre',
        }],
      },
    }));
    expect(html).toContain('écart −5,3 %');
    expect(html).toContain('écart −8,2 %');
    expect(html).toContain('(cours − moyenne) ÷ moyenne');
  });
});
