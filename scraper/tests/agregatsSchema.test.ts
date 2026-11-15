import { describe, expect, it } from 'vitest';
import { schemaLecture, promptAgregats } from '../src/agregats/schema.js';

const valide = {
  devise: 'FCFA',
  date_arrete: '2026-06-30',
  date_arrete_comparative: '2025-06-30',
  cumul_depuis_debut_exercice: true,
  provisoire: false,
  valeurs: [
    { indicateur: 'pnb', trouve: true, texte: '152 345', unite: 'millions', perimetre: 'individuel', page: 3,
      libelle_exact: 'Produit net bancaire', extrait: 'Produit net bancaire 152 345 138 210', colonne: 'courante' },
    { indicateur: 'cout_du_risque', trouve: false, texte: null, unite: null, perimetre: 'non_precise', page: null,
      libelle_exact: null, extrait: null },
  ],
};

describe('schemaLecture', () => {
  it('accepte une réponse conforme et pose les défauts', () => {
    const r = schemaLecture.parse(valide);
    expect(r.valeurs[1]).toMatchObject({ colonne: 'courante', comparateur: '=', approximation: false });
  });
  it('refuse un indicateur inconnu (un ratio calculé, par exemple)', () => {
    const r = schemaLecture.safeParse({ ...valide, valeurs: [{ ...valide.valeurs[0], indicateur: 'coefficient_exploitation' }] });
    expect(r.success).toBe(false);
  });
  it('refuse une date mal formée', () => {
    expect(schemaLecture.safeParse({ ...valide, date_arrete: '30/06/2026' }).success).toBe(false);
  });
});

describe('promptAgregats', () => {
  it('nomme chaque indicateur et interdit tout calcul et toute conversion', () => {
    const { systeme, consigne } = promptAgregats('SGBC', 'Rapport d’activités - 1er semestre 2026');
    expect(systeme).toContain('marge_interets');
    expect(systeme).toContain('ratio_tier1');
    expect(systeme).toMatch(/ne calcule jamais/i);
    expect(systeme).toMatch(/islamique/i);
    expect(systeme).toMatch(/USD/);
    expect(consigne).toContain('SGBC');
  });
});
