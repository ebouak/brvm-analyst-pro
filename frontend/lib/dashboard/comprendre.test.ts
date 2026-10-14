import { describe, it, expect } from 'vitest';
import { comprendreSeance, type MetriquesSeance } from './comprendre';
import { fmtNumber, fmtFcfa } from '@/lib/format';

const seance: MetriquesSeance = {
  dateMarche: '2026-10-12',
  hausses: 15, baisses: 22, stables: 11,
  composite: { valeur: 545.46, variationPct: -0.26 },
  secteurMeneur: { nom: 'Industriels', variationPct: 1.95 },
  valeurEchangee: 2_919_495_128, valeurEchangeeVeille: 2_956_520_400,
  plusEchangee: { code: 'STBC', nom: 'SITAB CI', valeur: 894_433_710 },
};

describe('comprendreSeance', () => {
  it('cinq constats, chacun avec son explication', () => {
    const c = comprendreSeance(seance);
    expect(c.map((x) => x.id)).toEqual(['largeur', 'composite', 'secteur', 'activite', 'vedette']);
    for (const x of c) expect(x.sens.length).toBeGreaterThan(20);
  });

  it('largeur : nombres exacts et accords', () => {
    expect(comprendreSeance(seance)[0]!.texte).toBe('22 valeurs ont baissé, 15 ont monté et 11 sont restées stables.');
  });

  it('composite : le verbe porte le sens, la variation est en absolu', () => {
    const t = comprendreSeance(seance).find((x) => x.id === 'composite')!.texte;
    expect(t).toBe(`Le BRVM Composite a reculé de ${fmtNumber(0.26, 2)} % à ${fmtNumber(545.46, 2)} points.`);
  });

  it('activité : valeur et écart à la veille, arrondis comme les panneaux', () => {
    const t = comprendreSeance(seance).find((x) => x.id === 'activite')!.texte;
    const d = Math.abs((2_919_495_128 / 2_956_520_400 - 1) * 100);
    expect(t).toBe(`${fmtFcfa(2_919_495_128)} FCFA ont été échangés, en baisse de ${fmtNumber(d, 1)} % sur la séance précédente.`);
  });

  it('une métrique manquante supprime la phrase, jamais un zéro', () => {
    const c = comprendreSeance({ ...seance, composite: null, valeurEchangee: null });
    expect(c.map((x) => x.id)).toEqual(['largeur', 'secteur', 'vedette']);
    expect(c.map((x) => x.texte).join(' ')).not.toMatch(/\b0 FCFA|\b0 %/);
  });

  it('secteur tous en baisse : « a le mieux résisté »', () => {
    const t = comprendreSeance({ ...seance, secteurMeneur: { nom: 'Énergie', variationPct: -0.1 } })
      .find((x) => x.id === 'secteur')!.texte;
    expect(t).toBe(`Le secteur Énergie a le mieux résisté (−${fmtNumber(0.1, 2)} %).`);
  });

  it('aucun conseil ni prédiction', () => {
    const tout = comprendreSeance(seance).map((x) => `${x.texte} ${x.sens}`).join(' ');
    expect(tout).not.toMatch(/achet|vend[rez]|conseil|devrai|va (monter|baisser)|opportunit/i);
  });
});
