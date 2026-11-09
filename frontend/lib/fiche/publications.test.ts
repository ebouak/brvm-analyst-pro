import { describe, it, expect } from 'vitest';
import { documentsCles, filtrerPublications, compteursParType, grouperParAnnee, type Pub } from './publications';

const p = (id: string, date: string, type: string | null, libelle = 'Doc'): Pub => ({ id, date_publication: date, libelle, type_publication: type, source_url: 'https://x/' + id });
const liste: Pub[] = [
  p('1', '2025-04-30', 'etats_financiers', 'Etats financiers annuels'),
  p('2', '2024-04-30', 'etats_financiers'),
  p('3', '2025-06-10', 'ag', 'Assemblée générale ordinaire'),
  p('4', '2025-05-02', 'rapport', "Rapport d'activités"),
  p('5', '2023-01-02', null, 'Divers'),
  p('6', '2022-01-02', 'inconnu', 'Autre chose'),
];

describe('documentsCles', () => {
  it('prend le plus récent de chaque type clé', () => {
    const k = documentsCles(liste);
    expect(k.etats?.id).toBe('1');
    expect(k.rapport?.id).toBe('4');
    expect(k.ag?.id).toBe('3');
  });
  it('null si absent', () => {
    expect(documentsCles([]).ag).toBeNull();
  });
});

describe('compteursParType', () => {
  it('somme les types connus et isole « sans type »', () => {
    const c = compteursParType(liste);
    expect(c.total).toBe(6);
    expect(c.parType.etats_financiers).toBe(2);
    expect(c.sansType).toBe(2);
  });
});

describe('filtrerPublications', () => {
  it('recherche insensible aux accents et à la casse', () => {
    expect(filtrerPublications(liste, 'all', 'assemblee').map((x) => x.id)).toEqual(['3']);
  });
  it('filtre sans_type', () => {
    expect(filtrerPublications(liste, 'sans_type', '').map((x) => x.id)).toEqual(['5', '6']);
  });
  it('filtre par type', () => {
    expect(filtrerPublications(liste, 'ag', '').length).toBe(1);
  });
});

describe('grouperParAnnee', () => {
  it('années décroissantes, documents du plus récent au plus ancien', () => {
    const g = grouperParAnnee(liste);
    expect(g.map((x) => x.annee)).toEqual(['2025', '2024', '2023', '2022']);
    expect(g[0]!.items.map((x) => x.id)).toEqual(['3', '4', '1']);
  });
});
