import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarChart3, Coins } from 'lucide-react';
import { EnteteComparateur } from '@/components/comparateur-sgi/cadre/Cadre';

const rendu = (props: Parameters<typeof EnteteComparateur>[0]) => renderToStaticMarkup(createElement(EnteteComparateur, props));

describe('bandeau commun des outils', () => {
  it('par défaut : surtitre du comparateur, aucun repère, aucun retour', () => {
    const html = rendu({ titre: 'T', sousTitre: 'S' });
    expect(html).toContain('Outil BRVM / UEMOA');
    expect(html).not.toContain('<ul');
    expect(html).not.toContain('Comparateur de SGI');
  });

  it('autre outil : son surtitre et ses repères, tirés de ses données', () => {
    const html = rendu({
      titre: 'Que faire de votre budget ?',
      sousTitre: 'S',
      surtitre: 'Simulateur · BRVM / UEMOA',
      reperes: [
        { icone: BarChart3, valeur: '48 actions', libelle: 'simulables aux cours du jour' },
        { icone: Coins, valeur: '40 actions', libelle: 'au dividende connu' },
      ],
    });
    expect(html).toContain('Simulateur · BRVM / UEMOA');
    expect(html).not.toContain('Outil BRVM / UEMOA');
    expect(html).toContain('simulables aux cours du jour');
    expect(html).toContain('40 actions');
  });

  it('bande de données : chaque élément lisible une fois, la copie de boucle masquée', () => {
    const html = rendu({
      titre: 'T',
      sousTitre: 'S',
      bande: { titre: 'Cours du jour', elements: [{ libelle: 'SNTS', valeur: '25 000 FCFA', detail: '+3,1 % sur 12 mois', ton: 'up' }] },
    });
    expect(html).toContain('aria-label="Cours du jour"');
    expect(html.match(/SNTS/g)).toHaveLength(2); // boucle visuelle…
    expect(html.match(/aria-hidden="true"><li/g)).toHaveLength(1); // …dont une copie muette
    expect(html).toContain('text-up');
    expect(rendu({ titre: 'T', sousTitre: 'S', bande: { titre: 'Vide', elements: [] } })).not.toContain('Vide');
  });

  it('variante épargne : piles de pièces au lieu des bougies', () => {
    const epargne = rendu({ titre: 'T', sousTitre: 'S', variante: 'epargne' });
    expect(epargne).toContain('cmp-pile');
    expect(epargne).not.toContain('cmp-bougie');
    expect(rendu({ titre: 'T', sousTitre: 'S' })).toContain('cmp-bougie');
  });

  it('un lien de retour explicite remplace celui du comparateur', () => {
    expect(rendu({ titre: 'T', sousTitre: 'S', filAriane: true })).toContain('href="/comparateur-sgi"');
    const html = rendu({ titre: 'T', sousTitre: 'S', filAriane: true, retour: { href: '/outils', libelle: 'Outils' } });
    expect(html).toContain('href="/outils"');
    expect(html).not.toContain('href="/comparateur-sgi"');
  });
});
