import { describe, expect, it } from 'vitest';
import { normaliser, type DocumentLu } from '../src/agregats/normaliser.js';
import type { Lecture } from '../src/agregats/schema.js';

let n = 0;
const id = () => `id${++n}`;
const doc: DocumentLu = {
  code: 'SGBC', url: 'https://x/sgbc-s1-2026.pdf', libelle: 'Rapport d’activités - 1er semestre 2026',
  date: '2026-07-30', publication_id: 'pub1', periode: { annee: 2026, code: 'S1', dateArrete: '2026-06-30' }, modele: 'gemini:test',
};
const v = (p: Partial<Lecture['valeurs'][number]>): Lecture['valeurs'][number] => ({
  indicateur: 'pnb', trouve: true, texte: '152 345', unite: 'millions', perimetre: 'individuel', page: 3,
  libelle_exact: 'Produit net bancaire', extrait: 'Produit net bancaire 152 345', colonne: 'courante', comparateur: '=', approximation: false, ...p,
});
const lecture = (valeurs: Lecture['valeurs'], extra: Partial<Lecture> = {}): Lecture => ({
  devise: 'FCFA', date_arrete: '2026-06-30', date_arrete_comparative: '2025-06-30', cumul_depuis_debut_exercice: true, provisoire: false, valeurs, ...extra,
});
const de = (obs: ReturnType<typeof normaliser>, indicateur: string, date = '2026-06-30') =>
  obs.filter((o) => o.indicateur === indicateur && o.date_arrete === date);

describe('normaliser', () => {
  it('convertit l’unité imprimée en FCFA, garde texte, unité imprimée, page et extrait', () => {
    const [o] = de(normaliser(lecture([v({})]), doc, id), 'pnb');
    expect(o).toMatchObject({
      statut: 'publie', valeur: 152345e6, unite: 'fcfa', unite_source: 'millions', texte_original: '152 345', decimales: 0,
      periode: 'S1', perimetre: 'individuel', page: 3, publication_id: 'pub1', methode: 'gemini-agregats', controle: 'ok',
    });
  });

  it('chaque indicateur absent de la réponse devient « non_trouve », jamais 0', () => {
    const obs = normaliser(lecture([v({})]), doc, id);
    const cdr = de(obs, 'cout_du_risque');
    expect(cdr).toHaveLength(1);
    expect(cdr[0]).toMatchObject({ statut: 'non_trouve', valeur: null });
  });

  it('colonne comparative : observation datée de l’année précédente, période tirée de la date', () => {
    const obs = normaliser(lecture([v({ colonne: 'comparative', texte: '138 210' })]), doc, id);
    expect(de(obs, 'pnb', '2025-06-30')[0]).toMatchObject({ valeur: 138210e6, periode: 'S1' });
  });

  it('un encours comparé au 31 décembre est rangé en « exercice »', () => {
    const obs = normaliser(
      lecture([v({ indicateur: 'credits_clientele', colonne: 'comparative', texte: '2 100 000' })], { date_arrete_comparative: '2025-12-31' }),
      doc, id,
    );
    expect(de(obs, 'credits_clientele', '2025-12-31')[0]).toMatchObject({ periode: 'exercice', valeur: 2_100_000e6 });
  });

  it('un ratio exige « pct », un montant l’interdit', () => {
    const obs = normaliser(lecture([v({ indicateur: 'solvabilite_total', texte: '14,39', unite: 'millions' }), v({ texte: '12', unite: 'pct' })]), doc, id);
    expect(de(obs, 'solvabilite_total')[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'definition_incompatible', valeur: null });
    expect(de(obs, 'pnb')[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'definition_incompatible' });
  });

  it('valeur propre à la branche islamique : non exploitable (Coris)', () => {
    const obs = normaliser(lecture([v({ indicateur: 'creances_souffrance_brutes', libelle_exact: 'Créances en souffrance — branche islamique', texte: '4 512' })]), doc, id);
    expect(de(obs, 'creances_souffrance_brutes')[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'definition_incompatible' });
  });

  it('document en USD (ETIT) : montant gardé EN USD, sans conversion (décision du 2026-11-15)', () => {
    const obs = normaliser(lecture([v({ texte: '1 234,5', unite: 'millions' }), v({ indicateur: 'solvabilite_total', texte: '13,2', unite: 'pct' })], { devise: 'USD' }), doc, id);
    expect(de(obs, 'pnb')[0]).toMatchObject({ statut: 'publie', unite: 'usd', valeur: 1_234_500_000, devise_source: 'USD' });
    expect(de(obs, 'solvabilite_total')[0]).toMatchObject({ statut: 'publie', unite: 'pct', valeur: 13.2 });
  });

  it('une autre devise reste non exploitable (aucune conversion)', () => {
    const obs = normaliser(lecture([v({})], { devise: 'EUR' }), doc, id);
    expect(de(obs, 'pnb')[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'definition_incompatible', devise_source: 'EUR' });
  });

  it('texte illisible → « illisible » ; « environ » → approximation', () => {
    const obs = normaliser(lecture([v({ texte: 'n.d.' }), v({ indicateur: 'depots_clientele', texte: '3 000 000', approximation: true })]), doc, id);
    expect(de(obs, 'pnb')[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'illisible' });
    expect(de(obs, 'depots_clientele')[0]).toMatchObject({ statut: 'publie', motif: 'approximation' });
  });

  it('deux valeurs différentes pour la même case du même document : conflit déclaré', () => {
    const obs = normaliser(lecture([v({ texte: '152 345' }), v({ texte: '152 999' })]), doc, id);
    const pnb = de(obs, 'pnb');
    expect(pnb).toHaveLength(1);
    expect(pnb[0]).toMatchObject({ statut: 'publie_non_exploitable', motif: 'source_conflict' });
    expect(pnb[0]!.controle_motif).toContain('152 999');
  });

  it('une date d’arrêté lue différente de la période du libellé : tout est à relire', () => {
    const obs = normaliser(lecture([v({})], { date_arrete: '2026-03-31' }), doc, id);
    expect(de(obs, 'pnb')[0]).toMatchObject({ controle: 'a_relire' });
    expect(de(obs, 'pnb')[0]!.controle_motif).toMatch(/date d’arrêté/);
  });

  it('les observations sont identifiées par la fonction injectée', () => {
    const obs = normaliser(lecture([v({})]), doc, () => 'fixe');
    expect(obs.every((o) => o.id === 'fixe')).toBe(true);
  });
});
