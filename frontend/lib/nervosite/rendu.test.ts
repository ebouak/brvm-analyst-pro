import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ApercuNervosite from '@/components/nervosite/ApercuNervosite';
import CourbeNervosite from '@/components/nervosite/CourbeNervosite';
import BlocMarcheDuJour from '@/components/dashboard/blocs/BlocMarcheDuJour';
import type { LigneNervosite } from './affichage';

const ligne = (date_marche: string, valeur: number | null, extra: Partial<LigneNervosite> = {}): LigneNervosite => ({
  date_marche, valeur, rapide: valeur, lente: valeur, rang: null, regime: null, n_titres: 47, ...extra,
});
const sain = (html: string) => {
  expect(html).not.toMatch(/NaN|Infinity|undefined/);
  return html;
};

describe('aperçu du tableau de bord — rendu sans données', () => {
  it('lecture impossible : le bloc le dit, sans chiffre', () => {
    const html = sain(renderToStaticMarkup(h(ApercuNervosite, { resume: null, dateMarche: '2026-11-13' })));
    expect(html).toContain('indisponible');
    expect(html).not.toMatch(/\d+,\d\s%/);
    expect(html).not.toContain('<svg');
  });

  it('historique trop court : pas de zéro inventé', () => {
    const d = ligne('2026-11-13', null);
    const html = sain(renderToStaticMarkup(h(ApercuNervosite, { resume: { derniere: d, debut: null, courbe: [] }, dateMarche: '2026-11-13' })));
    expect(html).toContain('Historique encore insuffisant');
    expect(html).not.toContain('0,0');
  });

  it('valeur sans rang : pas de régime affiché', () => {
    const c = [ligne('2026-11-12', 11.4), ligne('2026-11-13', 11.2)];
    const html = sain(renderToStaticMarkup(h(ApercuNervosite, { resume: { derniere: c[1]!, debut: '2026-11-12', courbe: c }, dateMarche: '2026-11-13' })));
    expect(html).toMatch(/11,2\s%/);
    expect(html).toContain('Régime non classé');
    expect(html).not.toMatch(/Calme|Normal|Agité|Tendu/);
  });

  it('valeur, régime et rang ; séance plus ancienne signalée', () => {
    const c = [ligne('2026-11-12', 11.4), ligne('2026-11-13', 11.2, { rang: 56.39, regime: 'normal' })];
    const html = sain(renderToStaticMarkup(h(ApercuNervosite, { resume: { derniere: c[1]!, debut: '2008-01-21', courbe: c }, dateMarche: '2026-11-14' })));
    expect(html).toContain('Normal');
    expect(html).toContain('56 % des séances');
    expect(html).toContain('séance du 13/11/2026');
  });
});

describe('indice de nervosité sur le tableau de bord', () => {
  it('uses the WESTBOURSE name and explains its annualized value and historical rank', () => {
    const d = ligne('2026-11-16', 11.3, { rang: 93, regime: 'tendu' });
    const html = sain(renderToStaticMarkup(h(BlocMarcheDuJour, {
      dateMarche: '2026-11-16',
      secteurs: null,
      largeur: null,
      obligations: null,
      nervosite: {
        derniere: d,
        debut: '2021-11-16',
        courbe: [ligne('2026-11-13', 11.4), d],
      },
    })));

    expect(html).toContain('Indice de nervosité WESTBOURSE');
    expect(html).toContain('ampleur des variations récentes');
    expect(html).toContain('93 % des séances');
    expect(html).not.toContain('BRVM-V');
  });
});

describe('courbe', () => {
  it('moins de deux points : rien', () => {
    expect(renderToStaticMarkup(h(CourbeNervosite, { lignes: [ligne('2026-11-13', 11)], titre: 't' }))).toBe('');
  });
  it('une séance sans valeur coupe le tracé au lieu de le relier', () => {
    const html = sain(renderToStaticMarkup(h(CourbeNervosite, {
      lignes: [ligne('2026-01-01', 10), ligne('2026-01-02', 12), ligne('2026-01-03', null), ligne('2026-01-04', 11), ligne('2026-01-05', 13)],
      titre: 't',
    })));
    const chemin = /<path d="([^"]*)" fill="none" class="stroke-accent"/.exec(html)![1]!;
    expect((chemin.match(/M/g) ?? []).length).toBe(2);
  });
});
