import { describe, expect, it } from 'vitest';
import { planifierEcritures, periodeDeLigne, type ObsLue, type LigneComptes } from '../src/agregats/ecritures.js';

let n = 0;
const o = (p: Partial<ObsLue>): ObsLue => ({
  id: `o${++n}`, code: 'SGBC', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', perimetre: 'individuel',
  statut: 'publie', valeur: 150e9, comparateur: '=', texte_original: '150 000', motif: null, document_url: 'https://x/s1.pdf',
  document_libelle: 'Rapport S1 2026', page: 3, nature_source: 'emetteur', provisoire: false, controle: 'ok', unite: 'fcfa', unite_source: 'millions', decimales: 0, ...p,
});
const ligne = (p: Partial<LigneComptes>): LigneComptes => ({
  table: 'income_statements', code: 'SGBC', periode: '2026-S1', type_periode: 'semestriel', lignes_specifiques: null, sources_specifiques: null, ...p,
});
const SOURCE = { document_url: 'https://x/s1.pdf', document_libelle: 'Rapport S1 2026', page: 3, perimetre: 'individuel' as const, unite: 'fcfa' as const };

describe('periodeDeLigne', () => {
  it('lit les formats de période en base', () => {
    expect(periodeDeLigne('2026-S1')).toEqual({ code: 'S1', dateArrete: '2026-06-30' });
    expect(periodeDeLigne('2025')).toEqual({ code: 'exercice', dateArrete: '2025-12-31' });
    expect(periodeDeLigne('2025-12-31')).toEqual({ code: 'exercice', dateArrete: '2025-12-31' });
    expect(periodeDeLigne('2026-S2')).toBeNull();
  });
});

describe('planifierEcritures', () => {
  it('écrit la valeur retenue dans lignes_specifiques et sa source (avec l’unité) dans sources_specifiques', () => {
    const p = planifierEcritures([o({})], [ligne({ lignes_specifiques: { pnb: 140e9, autre: 1 } })]);
    expect(p.misesAJour).toHaveLength(1);
    const m = p.misesAJour[0]!;
    expect(m.lignes_specifiques).toEqual({ pnb: 150e9, autre: 1 });
    expect(m.sources_specifiques).toEqual({ pnb: { ...SOURCE, observation: expect.any(String) } });
    expect(m.traces[0]).toMatchObject({ champ: 'lignes_specifiques.pnb', avant: 140e9, apres: 150e9 });
  });

  it('un montant en USD (ETIT) est écrit tel quel, unité « usd » dans la source', () => {
    const p = planifierEcritures([o({ code: 'ETIT', valeur: 1.2e9, unite: 'usd' })], [ligne({ code: 'ETIT' })]);
    expect(p.misesAJour[0]!.lignes_specifiques).toEqual({ pnb: 1.2e9 });
    expect(p.misesAJour[0]!.sources_specifiques.pnb).toMatchObject({ unite: 'usd' });
  });

  it('un ratio porte l’unité « pct »', () => {
    const p = planifierEcritures([o({ indicateur: 'solvabilite_total', valeur: 14.39, texte_original: '14,39', unite: 'pct', unite_source: 'pct', decimales: 2 })], [ligne({ table: 'balance_sheets' })]);
    expect(p.misesAJour[0]!.sources_specifiques.ratio_solvabilite).toMatchObject({ unite: 'pct' });
  });

  it('aucun changement → aucune mise à jour', () => {
    const p = planifierEcritures([o({})], [ligne({ lignes_specifiques: { pnb: 150e9 }, sources_specifiques: { pnb: { ...SOURCE, observation: 'x' } } })]);
    expect(p.misesAJour).toHaveLength(0);
  });

  it('contradiction : valeur retirée et élément de relecture ouvert', () => {
    const a = o({ document_url: 'd1', valeur: 150e9 });
    const b = o({ document_url: 'd2', valeur: 170e9 });
    const p = planifierEcritures([a, b], [ligne({ lignes_specifiques: { pnb: 150e9 } })]);
    expect(p.misesAJour[0]!.lignes_specifiques).toEqual({ pnb: null });
    expect(p.relectures).toEqual([expect.objectContaining({ code: 'SGBC', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', perimetre: 'individuel', raison: 'contradiction', observations: [a.id, b.id] })]);
  });

  it('après relecture (une valide, l’autre rejetée) : valeur retenue, aucune relecture rouverte', () => {
    const a = o({ document_url: 'd1', valeur: 150e9, controle: 'rejete' });
    const b = o({ document_url: 'd2', valeur: 170e9, controle: 'valide' });
    const p = planifierEcritures([a, b], [ligne({ lignes_specifiques: { pnb: null } })]);
    expect(p.relectures).toEqual([]);
    expect(p.misesAJour[0]!.lignes_specifiques).toEqual({ pnb: 170e9 });
    expect(p.misesAJour[0]!.sources_specifiques.pnb).toMatchObject({ document_url: 'd2', observation: b.id });
  });

  it('à relire : valeur en base intacte, élément de relecture avec le motif', () => {
    const a = o({ controle: 'a_relire', controle_motif: 'variation extrême : 113 %' });
    const p = planifierEcritures([a], [ligne({ lignes_specifiques: { pnb: 140e9 } })]);
    expect(p.misesAJour).toHaveLength(0);
    expect(p.relectures[0]).toMatchObject({ raison: 'controle', detail: expect.stringContaining('variation extrême') });
  });

  it('le résultat net n’est jamais écrit (recoupement seul) ; un encours va au bilan', () => {
    const p = planifierEcritures(
      [o({ indicateur: 'resultat_net', valeur: 40e9 }), o({ indicateur: 'credits_clientele', valeur: 2_000e9 })],
      [ligne({}), ligne({ table: 'balance_sheets' })],
    );
    expect(p.misesAJour.map((m) => m.table)).toEqual(['balance_sheets']);
    expect(p.misesAJour[0]!.lignes_specifiques).toEqual({ credits_clientele: 2_000e9 });
  });

  it('observations d’une période sans ligne de comptes : signalées, jamais créées', () => {
    const p = planifierEcritures([o({ date_arrete: '2026-03-31', periode: 'T1' })], [ligne({})]);
    expect(p.misesAJour).toHaveLength(0);
    expect(p.orphelins).toEqual(['SGBC|income_statements|T1|2026-03-31']);
  });
});
