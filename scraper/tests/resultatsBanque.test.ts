import { describe, expect, it } from 'vitest';
import { periodesDepuisLignes, lireBanque, type LigneComptesBancaire } from '../src/bank/pure/lecture.js';
import { assembler, rediger } from '../src/articles/redaction.js';
import { verifier } from '../src/articles/verrous.js';
import { assertNoForeignNumber } from '../src/hebdo/polish.js';
import { TYPES_AUTOMATIQUES, type Fait } from '../src/articles/types.js';

const src = { document_url: 'https://x/s1.pdf', document_libelle: 'Rapport d’activités S1 2026', page: 3, perimetre: 'individuel' as const };
const l = (periode: string, v: Record<string, number>, extra: Partial<LigneComptesBancaire> = {}, unite?: 'usd'): LigneComptesBancaire =>
  ({ periode, lignes_specifiques: v, sources_specifiques: Object.fromEntries(Object.keys(v).map((k) => [k, { ...src, ...(unite && k !== 'ratio_solvabilite' ? { unite } : {}) }])), ...extra });
const lecture = lireBanque(periodesDepuisLignes(
  [l('2026-S1', { pnb: 160e9, charges_exploitation: 72e9, cout_du_risque: 8e9 }, { resultat_net: 50e9 }), l('2025-S1', { pnb: 145e9, charges_exploitation: 70e9 }, { resultat_net: 45e9 })],
  [l('2026-S1', { credits_clientele: 3000e9, depots_clientele: 3800e9, ratio_solvabilite: 14.39 })],
), { annee: 2026, code: 'S1' })!;
const fait: Fait = { type: 'resultats', code: 'SGBC', cle: '2026-S1', dateFait: '2026-08-01', donnees: { lecture } };

describe('article de résultats bancaires', () => {
  const b = rediger(fait, { SGBC: 'SOCIETE GENERALE COTE D’IVOIRE' });
  const corps = assembler(b.sections, b.sources);

  it('chaque chiffre écrit est dans la liste blanche de Plume', () => {
    expect(assertNoForeignNumber(`${b.titre}\n${b.chapo}\n${corps}`, b.chiffres)).toBe(true);
  });
  it('vocabulaire bancaire, jamais « chiffre d’affaires »', () => {
    expect(`${b.titre} ${b.chapo} ${corps}`).not.toMatch(/chiffre d’affaires/i);
    expect(b.titre).toMatch(/PNB/);
  });
  it('les agrégats non publiés sont dits', () => {
    expect(corps).toMatch(/non publiés pour ce semestre/);
  });
  it('les sources sont les documents de la lecture', () => {
    expect(b.sources).toEqual([{ label: 'Rapport d’activités S1 2026', url: 'https://x/s1.pdf' }]);
    expect(b.slug).toBe('resultats-sgbc-2026-s1');
  });
  it('les verrous passent ; le type n’est pas automatique (a_valider, jamais publié seul)', () => {
    const v = verifier({ titre: b.titre, chapo: b.chapo, corps_md: corps, sources: b.sources, chiffres: b.chiffres }, fait, { aujourdhui: '2026-08-03', derniereSeance: '2026-08-03' });
    expect(v.ok).toBe(true);
    expect(TYPES_AUTOMATIQUES.has('resultats')).toBe(false);
  });
});

describe('article de résultats bancaires en USD (ETIT)', () => {
  const lUsd = lireBanque(periodesDepuisLignes(
    [l('2026-S1', { pnb: 1.2e9, charges_exploitation: 0.84e9 }, {}, 'usd'), l('2025-S1', { pnb: 1.1e9 }, {}, 'usd')],
    [l('2026-S1', { credits_clientele: 15e9 }, {}, 'usd')],
  ), { annee: 2026, code: 'S1' })!;
  const f: Fait = { type: 'resultats', code: 'ETIT', cle: '2026-S1', dateFait: '2026-08-01', donnees: { lecture: lUsd } };
  const b = rediger(f, { ETIT: 'ECOBANK TRANS. INCORP. TG' });
  const texte = `${b.titre}\n${b.chapo}\n${assembler(b.sections, b.sources)}\n${b.image.chiffre}`;

  it('les montants sont écrits en USD, jamais en FCFA', () => {
    expect(texte).toMatch(/1,20 milliard USD|1,20 milliards USD/);
    expect(texte).not.toMatch(/FCFA/);
    expect(assertNoForeignNumber(texte, b.chiffres)).toBe(true);
  });
});
