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
    expect(c.map((x) => x.texte).join(' ')).not.toMatch(/(^|[^\d,])0(,0+)? (%|FCFA)/);
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

  it('largeur : singular agreement (1 valeur, 1 a monté, 1 est restée stable)', () => {
    const t = comprendreSeance({ ...seance, hausses: 1, baisses: 1, stables: 1 })[0]!.texte;
    expect(t).toBe('1 valeur a baissé, 1 a monté et 1 est restée stable.');
  });

  it('largeur : all zero → no largeur constat', () => {
    const c = comprendreSeance({ ...seance, hausses: 0, baisses: 0, stables: 0 });
    expect(c.map((x) => x.id)).not.toContain('largeur');
  });

  it('largeur : negative count → no largeur constat', () => {
    const c = comprendreSeance({ ...seance, hausses: -1, baisses: 2, stables: 1 });
    expect(c.map((x) => x.id)).not.toContain('largeur');
  });

  it('composite : variationPct -0.004 → est resté stable, no ±0,00', () => {
    const c = comprendreSeance({ ...seance, composite: { valeur: 545.46, variationPct: -0.004 } });
    const t = c.find((x) => x.id === 'composite')!.texte;
    expect(t).toContain('est resté stable');
    expect(t).not.toMatch(/[+−]0,0+/);
  });

  it('composite : variationPct 0.1 → quasi stable with +', () => {
    const t = comprendreSeance({ ...seance, composite: { valeur: 545.46, variationPct: 0.1 } })
      .find((x) => x.id === 'composite')!.texte;
    expect(t).toContain('quasi stable');
    expect(t).toContain('+');
  });

  it('composite : variationPct 0.5 → progressé', () => {
    const t = comprendreSeance({ ...seance, composite: { valeur: 545.46, variationPct: 0.5 } })
      .find((x) => x.id === 'composite')!.texte;
    expect(t).toBe(`Le BRVM Composite a progressé de ${fmtNumber(0.5, 2)} % à ${fmtNumber(545.46, 2)} points.`);
  });

  it('secteur : positive variation → a le plus progressé', () => {
    const t = comprendreSeance({ ...seance, secteurMeneur: { nom: 'Industriels', variationPct: 1.95 } })
      .find((x) => x.id === 'secteur')!.texte;
    expect(t).toBe(`Le secteur Industriels a le plus progressé (+${fmtNumber(1.95, 2)} %).`);
  });

  it('secteur : zero variation → est resté stable', () => {
    const t = comprendreSeance({ ...seance, secteurMeneur: { nom: 'Industriels', variationPct: 0 } })
      .find((x) => x.id === 'secteur')!.texte;
    expect(t).toBe(`Le secteur Industriels est resté stable (${fmtNumber(0, 2)} %).`);
  });

  it('activité : veille null → no comparison clause', () => {
    const t = comprendreSeance({ ...seance, valeurEchangeeVeille: null })
      .find((x) => x.id === 'activite')!.texte;
    expect(t).toBe(`${fmtFcfa(2_919_495_128)} FCFA ont été échangés.`);
  });

  it('activité : veille 0 → no comparison clause', () => {
    const t = comprendreSeance({ ...seance, valeurEchangeeVeille: 0 })
      .find((x) => x.id === 'activite')!.texte;
    expect(t).toBe(`${fmtFcfa(2_919_495_128)} FCFA ont été échangés.`);
  });

  it('activité : equal value → autant que la séance précédente', () => {
    const t = comprendreSeance({ ...seance, valeurEchangee: 3_000_000, valeurEchangeeVeille: 3_000_000 })
      .find((x) => x.id === 'activite')!.texte;
    expect(t).toContain(', autant que la séance précédente.');
  });

  it('activité : valeurEchangee 0 → no activite constat', () => {
    const c = comprendreSeance({ ...seance, valeurEchangee: 0 });
    expect(c.map((x) => x.id)).not.toContain('activite');
  });

  it('vedette : valeur 0 → no vedette constat', () => {
    const c = comprendreSeance({ ...seance, plusEchangee: { code: 'STBC', nom: 'SITAB CI', valeur: 0 } });
    expect(c.map((x) => x.id)).not.toContain('vedette');
  });

  it('non-finite : composite NaN → no composite constat', () => {
    const c = comprendreSeance({ ...seance, composite: { valeur: NaN, variationPct: 1 } });
    expect(c.map((x) => x.id)).not.toContain('composite');
    expect(c.map((x) => x.texte).join(' ')).not.toMatch(/NaN|Infinity/);
  });

  it('non-finite : secteur Infinity → no secteur constat', () => {
    const c = comprendreSeance({ ...seance, secteurMeneur: { nom: 'Test', variationPct: Infinity } });
    expect(c.map((x) => x.id)).not.toContain('secteur');
    expect(c.map((x) => x.texte).join(' ')).not.toMatch(/NaN|Infinity/);
  });

  it('non-finite : valeurEchangee NaN → no activite constat', () => {
    const c = comprendreSeance({ ...seance, valeurEchangee: NaN });
    expect(c.map((x) => x.id)).not.toContain('activite');
    expect(c.map((x) => x.texte).join(' ')).not.toMatch(/NaN|Infinity/);
  });
});
