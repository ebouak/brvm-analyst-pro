import { describe, it, expect } from 'vitest';
import { extremesSecteurs, largeurSeance, type LigneSecteur } from './marcheDuJour';
import { aggregateBySector } from '@/lib/sectors';

const J = '2026-11-02';
const l = (code: string, variation_pct: number | null, secteur: string | null = null, date_marche = J): LigneSecteur => ({
  code, secteur, date_marche, cours_jour: 1000, variation_pct, valeur_echangee: null,
});

const REF = new Map<string, string | null>([
  ['SNTS', 'Télécoms'], ['ORAC', 'Télécoms'],
  ['SGBC', 'Finance'], ['ECOC', 'Finance'],
  ['TTLC', 'Énergie'],
]);

describe('extremesSecteurs', () => {
  it('classe les secteurs par variation moyenne du jour', () => {
    const r = extremesSecteurs([l('SNTS', 1), l('ORAC', 3), l('SGBC', -2), l('ECOC', 0), l('TTLC', -4)], REF, J);
    expect(r).toEqual({
      meilleur: { secteur: 'Télécoms', variation: 2 },
      pire: { secteur: 'Énergie', variation: -4 },
      nbSecteurs: 3,
    });
  });

  it('donne le même meilleur et le même pire que /secteurs (aggregateBySector)', () => {
    const lignes = [l('SNTS', 1), l('ORAC', 3), l('SGBC', -2), l('ECOC', 0), l('TTLC', -4)];
    const page = aggregateBySector(lignes.map((x) => ({ ...x, secteur: REF.get(x.code) ?? null })), J);
    const r = extremesSecteurs(lignes, REF, J)!;
    expect(r.meilleur.secteur).toBe(page[0]!.secteur);
    expect(r.pire.secteur).toBe(page[page.length - 1]!.secteur);
  });

  it('le secteur de la ligne prime sur le référentiel', () => {
    const r = extremesSecteurs([l('SNTS', 5, 'Autre libellé'), l('SGBC', -1)], REF, J)!;
    expect(r.meilleur.secteur).toBe('Autre libellé');
  });

  it('ignore les autres séances et les variations inconnues', () => {
    const r = extremesSecteurs([l('SNTS', 9, null, '2026-10-30'), l('ORAC', 1), l('SGBC', null), l('ECOC', -1)], REF, J)!;
    expect(r.meilleur).toEqual({ secteur: 'Télécoms', variation: 1 });
    expect(r.pire).toEqual({ secteur: 'Finance', variation: -1 });
  });

  it('moins de deux secteurs classables → null', () => {
    expect(extremesSecteurs([l('SNTS', 1), l('ORAC', 2)], REF, J)).toBeNull();
    expect(extremesSecteurs([], REF, J)).toBeNull();
    expect(extremesSecteurs([l('SNTS', null), l('SGBC', null)], REF, J)).toBeNull();
  });
});

describe('largeurSeance', () => {
  it('reprend les compteurs connus', () => {
    expect(largeurSeance({ hausses: 18, baisses: 22, stables: 7 })).toEqual({ hausses: 18, baisses: 22, stables: 7 });
  });
  it('compteurs inconnus ou séance vide → null', () => {
    expect(largeurSeance({ hausses: null, baisses: null, stables: null })).toBeNull();
    expect(largeurSeance({ hausses: 0, baisses: 0, stables: 0 })).toBeNull();
  });
});
