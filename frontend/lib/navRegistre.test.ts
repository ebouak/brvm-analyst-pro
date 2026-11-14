import { describe, it, expect } from 'vitest';
import { REGISTRE, RUBRIQUES, entreeParChemin, estDynamique, type StatutPage } from './navRegistre';
import { pagesDuDisque } from './navPagesDuDisque';

const PAGES = pagesDuDisque();
const STATUTS: StatutPage[] = ['menu', 'secondaire', 'parcours', 'interne', 'essai', 'public'];

describe('registre de navigation', () => {
  it('lit bien les pages du disque', () => {
    expect(PAGES.length).toBeGreaterThan(100);
    expect(PAGES).toContain('/');
    expect(PAGES).toContain('/actions/[code]');
  });

  it('déclare chaque page de app/ (hors /admin)', () => {
    const declares = new Set(REGISTRE.map((e) => e.chemin));
    const manquantes = PAGES.filter((p) => !declares.has(p));
    expect(manquantes, `pages non déclarées dans lib/navRegistre.ts : ${manquantes.join(', ')}`).toEqual([]);
  });

  it('ne déclare aucune page inexistante', () => {
    const surDisque = new Set(PAGES);
    const fantomes = REGISTRE.map((e) => e.chemin).filter((c) => !surDisque.has(c));
    expect(fantomes, `entrées sans page : ${fantomes.join(', ')}`).toEqual([]);
  });

  it('ne déclare aucune page deux fois', () => {
    const vus = new Set<string>();
    const doublons: string[] = [];
    for (const e of REGISTRE) {
      if (vus.has(e.chemin)) doublons.push(e.chemin);
      vus.add(e.chemin);
    }
    expect(doublons).toEqual([]);
  });

  it('chaque parent existe, et seule une racine en est dépourvue', () => {
    for (const e of REGISTRE) {
      if (e.parent) {
        expect(entreeParChemin(e.parent), `parent introuvable pour ${e.chemin} : ${e.parent}`).toBeDefined();
        expect(e.racine, `${e.chemin} a un parent ET se dit racine`).toBeUndefined();
      } else {
        expect(e.statut === 'menu' || e.racine === true, `${e.chemin} n'a ni parent ni statut de racine`).toBe(true);
      }
    }
  });

  it('aucune boucle de parents', () => {
    for (const e of REGISTRE) {
      const vus = new Set<string>();
      let c: string | undefined = e.chemin;
      while (c) {
        expect(vus.has(c), `boucle de parents depuis ${e.chemin}`).toBe(false);
        vus.add(c);
        c = entreeParChemin(c)?.parent;
      }
    }
  });

  it('statut dans l’énumération fermée, raison obligatoire hors menu', () => {
    for (const e of REGISTRE) {
      expect(STATUTS).toContain(e.statut);
      if (e.statut !== 'menu') expect((e.raison ?? '').trim().length, `raison manquante : ${e.chemin}`).toBeGreaterThan(0);
    }
  });

  it('une entrée du menu a une rubrique et n’est pas dynamique', () => {
    for (const e of REGISTRE.filter((x) => x.statut === 'menu')) {
      expect(e.rubrique, `rubrique manquante : ${e.chemin}`).toBeDefined();
      expect(estDynamique(e.chemin)).toBe(false);
    }
  });

  it('chaque rubrique a au moins une entrée de menu', () => {
    for (const r of RUBRIQUES) {
      expect(REGISTRE.some((e) => e.statut === 'menu' && e.rubrique === r.id), r.libelle).toBe(true);
    }
  });
});
