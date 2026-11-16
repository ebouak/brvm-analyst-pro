import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BarreDessin, { OUTILS } from '@/components/graphique/BarreDessin';

const base = {
  outil: 'fibonacci' as const,
  onOutil: () => {},
  couleur: 'warn',
  onCouleur: () => {},
  epaisseur: 2 as const,
  onEpaisseur: () => {},
  aSelection: false,
  onSupprimer: () => {},
  nbDessins: 3,
  onToutEffacer: () => {},
};

describe('BarreDessin (rendu)', () => {
  it('expose une barre d’outils nommée, chaque outil libellé avec son raccourci', () => {
    const html = renderToStaticMarkup(createElement(BarreDessin, base));
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="Outils de dessin"');
    for (const o of OUTILS) expect(html).toContain(`aria-label="${o.libelle} (${o.raccourci})"`);
  });
  it('signale l’outil actif et la couleur choisie par aria-pressed', () => {
    const html = renderToStaticMarkup(createElement(BarreDessin, base));
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Retracement de Fibonacci \(F\)"/);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Couleur Ambre"/);
  });
  it('désactive « supprimer » sans sélection, et tout en mode comparaison', () => {
    const html = renderToStaticMarkup(createElement(BarreDessin, base));
    expect(html).toMatch(/disabled=""[^>]*aria-label="Supprimer le dessin sélectionné \(Suppr\)"/);
    const bloque = renderToStaticMarkup(createElement(BarreDessin, { ...base, desactive: true, raisonDesactive: 'x' }));
    expect((bloque.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(OUTILS.length + 2);
  });
  it('n’utilise aucun emoji', () => {
    const html = renderToStaticMarkup(createElement(BarreDessin, base));
    expect(/\p{Extended_Pictographic}/u.test(html)).toBe(false);
  });
});
