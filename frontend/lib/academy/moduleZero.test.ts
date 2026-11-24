import { describe, expect, it } from 'vitest';
import { badgeEnsemble, badgeNouveaute, DUREE_NOUVEAUTE_JOURS } from './nouveaute';
import { calculerCroissance, calculerEndettement, calculerRoeMoyen, SaisieInvalide } from './simulateurs';
import { chartSchema, lessonSchema, sectionSchema } from './types';

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('badge Nouveau / Mis à jour', () => {
  it('visible depuis la date, éteint après la durée', () => {
    const n = { type: 'nouveau' as const, depuis: '2026-11-24' };
    expect(badgeNouveaute(n, d('2026-11-24'))?.libelle).toBe('Nouveau');
    expect(badgeNouveaute(n, d('2026-11-23'))).toBeNull();
    expect(badgeNouveaute(n, new Date(Date.parse('2026-11-24T00:00:00Z') + (DUREE_NOUVEAUTE_JOURS + 1) * 86_400_000))).toBeNull();
    expect(badgeNouveaute({ type: 'mis_a_jour', depuis: '2026-11-24' }, d('2026-12-01'))?.libelle).toBe('Mis à jour');
  });
  it('date illisible ou absente : pas de badge', () => {
    expect(badgeNouveaute(null, d('2026-11-24'))).toBeNull();
    expect(badgeNouveaute({ type: 'nouveau', depuis: '24/11/2026' }, d('2026-11-24'))).toBeNull();
  });
  it('un ensemble prend « Nouveau » avant « Mis à jour »', () => {
    const b = badgeEnsemble([
      { nouveaute: { type: 'mis_a_jour', depuis: '2026-11-20' } },
      { nouveaute: { type: 'nouveau', depuis: '2026-11-24' } },
      {},
    ], d('2026-11-25'));
    expect(b?.type).toBe('nouveau');
    expect(badgeEnsemble([{}], d('2026-11-25'))).toBeNull();
  });
});

describe('simulateur croissance (TCAM)', () => {
  it('PNB d’ECOC 2021 → 2025 en base : 90,5 → 132,7, soit environ 10 % par an', () => {
    const r = calculerCroissance({ valeur_initiale: 90.5, valeur_finale: 132.7, annees: 4 });
    expect(r.croissanceTotalePct).toBeCloseTo(46.63, 1);
    expect(r.tcamPct).toBeCloseTo(10.04, 1);
    expect(r.trajectoire).toHaveLength(5);
    expect(r.trajectoire.at(-1)).toBeCloseTo(132.7, 6);
  });
  it('refuse une valeur nulle ou un nombre d’années non entier', () => {
    expect(() => calculerCroissance({ valeur_initiale: 0, valeur_finale: 10, annees: 2 })).toThrow(SaisieInvalide);
    expect(() => calculerCroissance({ valeur_initiale: 1, valeur_finale: 10, annees: 1.5 })).toThrow(SaisieInvalide);
  });
});

describe('simulateur endettement', () => {
  it('dette nette, gearing et couverture', () => {
    const r = calculerEndettement({ dettes_financieres: 300, tresorerie: 100, capitaux_propres: 400, resultat_operationnel: 120, charges_interets: 20 });
    expect(r.detteNette).toBe(200);
    expect(r.gearingPct).toBe(50);
    expect(r.couverture).toBe(6);
  });
  it('trésorerie nette : gearing négatif, dit comme tel', () => {
    const r = calculerEndettement({ dettes_financieres: 50, tresorerie: 150, capitaux_propres: 400, resultat_operationnel: 120, charges_interets: 0 });
    expect(r.detteNette).toBe(-100);
    expect(r.couverture).toBeNull();
    expect(r.lecture).toMatch(/trésorerie nette/);
  });
});

describe('simulateur ROE moyen', () => {
  it('ECOC 2025 en base : 63,5 de résultat, capitaux 199,4 → 218,6', () => {
    const r = calculerRoeMoyen({ resultat_net: 63.5, capitaux_debut: 199.4, capitaux_fin: 218.6, actif_debut: 2050.7, actif_fin: 2054.5 });
    expect(r.roeClotPct).toBeCloseTo(29.05, 1);
    expect(r.roeMoyenPct).toBeCloseTo(30.38, 1);
    expect(r.roaMoyenPct).toBeCloseTo(3.09, 2);
    expect(r.lecture).toMatch(/sous-estime/);
  });
});

describe('schéma : plafonds relevés', () => {
  it('un graphique à plusieurs séries, avec une année sans donnée et un second axe', () => {
    const c = chartSchema.parse({
      type: 'bar', titre: 'PNB', labels: ['2021', '2022'], note: 'Sources : test 2026.', reel: true,
      series: [{ nom: 'A', valeurs: [null, 1] }, { nom: 'PER', valeurs: [5, 6], type: 'line', axe: 'droite' }],
    });
    expect(c.valeurs).toEqual([]);
    expect(c.series[1]!.axe).toBe('droite');
  });
  it('une série de mauvaise longueur est refusée', () => {
    expect(() => chartSchema.parse({ type: 'bar', titre: 'x', labels: ['a', 'b'], note: 'n', series: [{ nom: 'A', valeurs: [1] }] })).toThrow();
  });
  it('un tableau de 16 lignes et une section à 12 formules passent', () => {
    const s = sectionSchema.parse({
      type: 'definition', titre: 't', contenu: 'c',
      tableau: { colonnes: ['a', 'b'], lignes: Array.from({ length: 16 }, (_, i) => [`l${i}`, '1']) },
      formules: Array.from({ length: 12 }, (_, i) => ({ nom: `f${i}`, expression: 'x = y' })),
    });
    expect(s.tableau!.lignes).toHaveLength(16);
  });
  it('une leçon de 16 sections passe', () => {
    const l = lessonSchema.parse({
      titre: 't', resume: 'r',
      sections: Array.from({ length: 16 }, () => ({ type: 'definition', titre: 't', contenu: 'c' })),
    });
    expect(l.sections).toHaveLength(16);
  });
});
