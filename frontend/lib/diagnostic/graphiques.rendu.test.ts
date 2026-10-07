import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Barres, Courbes, BarresH, Pairs, Fourchette, Jauge, CourbeCours, formater } from '@/components/diagnostic/Graphiques';

/** Le rendu SVG ne doit jamais porter de coordonnée invalide. */
const sain = (html: string) => {
  expect(html).not.toMatch(/NaN|Infinity|undefined/);
  return html;
};

describe('graphiques du diagnostic — rendu serveur', () => {
  it('barres : négatif en rouge, trou laissé en blanc', () => {
    const html = sain(renderToStaticMarkup(h(Barres, {
      annees: ['2023', '2024', '2025'], format: 'fcfa', resume: 'r',
      series: [{ nom: 'PNB', ton: 'accent', valeurs: [263e9, null, 276e9] }, { nom: 'RN', ton: 'up', valeurs: [-5e9, 101e9, 101e9], negatifEnRouge: true }],
    })));
    expect(html).toContain('fill-down');                 // le résultat négatif
    expect((html.match(/<rect x=/g) ?? []).length).toBe(5); // 6 points, 1 trou (les pastilles de légende n'ont pas de x)
    expect((html.match(/<svg aria-hidden/g) ?? []).length).toBe(2); // pastilles en SVG : elles s'impriment
    expect(html).toContain('PNB');                        // légende dès deux séries
  });

  it('un exercice sans aucune valeur sort de l’axe ; un flux négatif garde sa couleur', () => {
    const html = sain(renderToStaticMarkup(h(Barres, {
      annees: ['2021', '2022', '2023'], format: 'fcfa', resume: 'r',
      series: [{ nom: 'Exploitation', ton: 'up', valeurs: [null, 5e9, 6e9] }, { nom: 'Investissement', ton: 'warn', valeurs: [null, -3e9, -2e9] }],
    })));
    expect(html).not.toContain('>2021<');
    expect(html).not.toContain('fill-down');
    expect(html).toContain('fill-warn');
  });

  it('courbes : une ligne de référence et un dernier point étiqueté', () => {
    const html = sain(renderToStaticMarkup(h(Courbes, {
      annees: ['2023', '2024', '2025'], format: 'pct', resume: 'r', reference: { valeur: 100, libelle: '100 %' },
      series: [{ nom: 'Crédits / dépôts', ton: 'accent', valeurs: [90.1, 89.4, 87.6] }],
    })));
    expect(html).toContain('stroke-dasharray');
    expect(html).toContain('87,6 %');
  });

  it('barres horizontales : une valeur absente dit pourquoi', () => {
    const html = sain(renderToStaticMarkup(h(BarresH, {
      max: 10, format: 'note', resume: 'r',
      lignes: [{ libelle: 'Altman', valeur: null, ton: 'muted', note: 'non applicable' }, { libelle: 'Marges', valeur: 4, ton: 'warn', note: '/10' }],
    })));
    expect(html).toContain('non applicable');
    expect(html).toContain('4 /10');
  });

  it('pairs, fourchette, jauge et cours se rendent sans coordonnée invalide', () => {
    sain(renderToStaticMarkup(h(Pairs, { resume: 'r', lignes: [{ libelle: 'PER', unite: 'x', valeur: 12.3, mediane: 15.4, nbPairs: 13, lecture: 'favorable' }, { libelle: 'Croissance', unite: '%', valeur: -2, mediane: 16.3, nbPairs: 11, lecture: 'defavorable' }] })));
    const f = sain(renderToStaticMarkup(h(Fourchette, { resume: 'r', cours: 39000, methodes: [{ libelle: 'Gordon', bas: 25000, centrale: 28389, haut: 33000 }, { libelle: 'PER médian', bas: 50173, centrale: 50173, haut: 50173 }] })));
    expect(f).toContain('cours 39');
    const j = sain(renderToStaticMarkup(h(Jauge, { resume: 'r', valeur: null, minimum: 11.5, absence: 'publié mais non exploitable — sources contradictoires' })));
    expect(j).toContain('sources contradictoires');
    sain(renderToStaticMarkup(h(CourbeCours, { resume: 'r', points: Array.from({ length: 30 }, (_, i) => ({ date: `2026-0${1 + (i % 9)}-15`, cours: 30000 + i * 100 })) })));
  });

  it('formats à la française', () => {
    expect(formater(276_048e6, 'fcfa')).toBe('276 Md');
    expect(formater(2_907_675e6, 'fcfa')).toMatch(/^2\s908 Md$/);   // jamais « 2,91 T »
    expect(formater(12.34, 'pct')).toBe('12,3 %');
    expect(formater(28389, 'fcfa_action')).toMatch(/^28\s389 FCFA$/);
  });
});
