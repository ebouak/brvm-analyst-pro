import { describe, it, expect } from 'vitest';
import { construireFiche, type DonneesSociete } from './instantane';
import { rechercheMotsCles, termes } from './motsCles';
import { resultatsJev, statutParNombre } from './decision';

const d = (o: Partial<DonneesSociete> & { code: string; nom: string }): DonneesSociete => ({
  secteur: null, activite: null, pays: null, rendement: null, liquidite: null, perf12m: null, ...o,
});
const fiches = [
  d({ code: 'SGBC', nom: 'Société Générale CI', secteur: 'Services financiers', activite: 'banque', pays: 'CI', rendement: { valeur: 8, base: 'net' }, liquidite: 'B' }),
  d({ code: 'BOAS', nom: 'Bank of Africa Sénégal', secteur: 'Services financiers', activite: 'banque', pays: 'SN', liquidite: 'C' }),
  d({ code: 'SNTS', nom: 'Sonatel', secteur: 'Télécommunications', pays: 'SN', rendement: { valeur: 6, base: 'non_precisee' }, liquidite: 'A' }),
  d({ code: 'SAFC', nom: 'Saham Assurance CI', secteur: 'Services financiers', activite: 'assurance', pays: 'CI' }),
  d({ code: 'TTLC', nom: 'TotalEnergies CI', secteur: 'Énergie', pays: 'CI', rendement: { valeur: 5, base: 'net' } }),
].map(construireFiche);

describe('repli par mots-clés', () => {
  it('rapproche les synonymes métier', () => {
    expect(rechercheMotsCles('établissement bancaire', fiches).resultats.map((r) => r.code)).toEqual(['BOAS', 'SGBC']);
    expect(rechercheMotsCles('opérateur téléphonique', fiches).resultats.map((r) => r.code)).toEqual(['SNTS']);
    expect(rechercheMotsCles('un assureur', fiches).resultats.map((r) => r.code)).toEqual(['SAFC']);
  });

  it('cumule les contraintes et classe par score puis par code', () => {
    expect(rechercheMotsCles('banque ivoirienne qui verse un dividende', fiches).resultats[0]!.code).toBe('SGBC');
  });

  it('une négation exclut au lieu de favoriser', () => {
    const r = rechercheMotsCles('société ivoirienne hors banques', fiches).resultats.map((x) => x.code);
    expect(r).not.toContain('SGBC');
    expect(r).toContain('TTLC');
    expect(rechercheMotsCles('pas de banque', fiches).resultats).toEqual([]);
  });

  it('le code et le nom pèsent plus que les autres faits', () => {
    expect(rechercheMotsCles('sonatel', fiches).resultats[0]!.code).toBe('SNTS');
    expect(rechercheMotsCles('SNTS', fiches).resultats[0]!.score).toBe(1);
  });

  it('aucun résultat de score nul ; requête sans écho ⇒ statut aucune', () => {
    const r = rechercheMotsCles('cryptomonnaie lunaire', fiches);
    expect(r.resultats).toEqual([]);
    expect(r.statut).toBe('aucune');
  });

  it('isole les termes et repère la négation', () => {
    expect(termes('banque hors du Sénégal')).toEqual([
      { mot: 'banque', nie: false },
      { mot: 'senegal', nie: true },
    ]);
  });
});

describe('statut', () => {
  it('par nombre de résultats', () => {
    expect([0, 1, 2, 3].map(statutParNombre)).toEqual(['aucune', 'partielle', 'partielle', 'correspondance']);
  });

  it('Jev : pertinence globale basse ⇒ aucune société imposée', () => {
    expect(resultatsJev({ scores: { SNTS: 0.9 }, pertinenceGlobale: 0.3, modele: 'm' }, fiches)).toEqual({ statut: 'aucune', resultats: [] });
  });

  it('Jev : scores ≥ 0,5, triés, égalités par code', () => {
    const r = resultatsJev({ scores: { SNTS: 0.8, BOAS: 0.8, SGBC: 0.95, TTLC: 0.2, SAFC: 0.5 }, pertinenceGlobale: 0.9, modele: 'm' }, fiches);
    expect(r.resultats.map((x) => x.code)).toEqual(['SGBC', 'BOAS', 'SNTS', 'SAFC']);
    expect(r.statut).toBe('correspondance');
  });
});
