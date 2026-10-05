import { describe, expect, it } from 'vitest';
import { periodeDuLibelle, lireCodePeriode, typePeriode } from '../src/interim/periode.js';
import { verifierExtraction, bornesCumul, schemaExtraction } from '../src/interim/extraction.js';
import { choisirPublications, lignesInterim } from '../src/interim/selection.js';

describe('periodeDuLibelle — libellés réels de la base', () => {
  it.each([
    ["Rapport d'activités - 1er semestre 2026 - SOCIETE GENERALE CI", '2026-S1'],
    ["Rapport d'activités - 1er trimestre 2026 - SONATEL SN", '2026-T1'],
    ["Rapport d'activités - 2eme trimestre 2026 - SAFCA CI", '2026-S1'],
    ["Rapport d'activités et Etats financiers IFRS - 1er semestre 2026 - BIIC BN", '2026-S1'],
    ['Etats financiers - 1er semestre 2026 - BOA BF', '2026-S1'],
    ["Rapport d'activités - 3ème trimestre 2025 - SONATEL SN", '2025-T3'],
    ["Rapport d'examen limité sur les informations financières intermediaires - 1er semestre 2026 - ETI TG", '2026-S1'],
  ])('%s → %s', (libelle, attendu) => {
    const p = periodeDuLibelle(libelle);
    expect(p ? `${p.annee}-${p.code}` : null).toBe(attendu);
  });

  it.each([
    'Bilan semestriel du contrat de liquidité -1er semestre 2026 - BOA SN',
    'Attestation des Commissaires Aux Comptes  - 1er semestre 2026 - SIB CI',
    'Rapport des Commissaires Aux Comptes - 1er semestre 2026 - BRIDGE BANK GROUP CI',
    "Rapport d'activité - 4ème trimestre 2025 et du 1er trimestre 2026 - VIVO ENERGY CI",
    'Etats financiers IFRS - Exercice 2025 - SERVAIR ABIDJAN  CI',
    "Rapport d'activités - 2eme semestre 2025 - X",
  ])('écarte « %s »', (libelle) => {
    expect(periodeDuLibelle(libelle)).toBeNull();
  });
});

describe('codes de période', () => {
  it('lit et type les codes', () => {
    expect(lireCodePeriode('2026-S1')).toEqual({ annee: 2026, code: 'S1' });
    expect(lireCodePeriode('2025')).toBeNull();
    expect(typePeriode('S1')).toBe('semestriel');
    expect(typePeriode('T1')).toBe('trimestre');
  });
});

describe('verifierExtraction', () => {
  const ex = (periodes: object[], extra: object = {}) =>
    schemaExtraction.parse({ devise_source: 'fcfa', cumul_depuis_debut_exercice: true, periodes, ...extra });
  const sgbc = ex([
    { annee: 2026, revenu_total: 134_059e6, pnb: 134_059e6, resultat_net: 53_350e6 },
    { annee: 2025, revenu_total: 132_011e6, pnb: 132_011e6, resultat_net: 53_077e6 },
  ]);
  const cible = { annee: 2026, code: 'S1' as const };

  it('accepte un semestre cohérent avec l’annuel précédent', () => {
    expect(verifierExtraction(sgbc, cible, { revenu_total: 270_000e6, resultat_net: 110_000e6 }).ok).toBe(true);
  });

  it('REJETTE une erreur d’unité (montants restés en millions)', () => {
    const faux = ex([{ annee: 2026, revenu_total: 134_059, resultat_net: 53_350 }]);
    const v = verifierExtraction(faux, cible, { revenu_total: 270_000e6, resultat_net: 110_000e6 });
    expect(v.ok).toBe(false);
    expect(v.motifs.join()).toMatch(/annuel précédent/);
  });

  it('REJETTE un trimestre isolé présenté comme semestre', () => {
    expect(verifierExtraction(ex(sgbc.periodes, { cumul_depuis_debut_exercice: false }), cible, null).ok).toBe(false);
  });

  it('REJETTE une devise étrangère', () => {
    expect(verifierExtraction(ex(sgbc.periodes, { devise_source: 'usd' }), cible, null).ok).toBe(false);
  });

  it('REJETTE l’absence de la colonne de l’année courante', () => {
    expect(verifierExtraction(ex([sgbc.periodes[1]]), cible, null).ok).toBe(false);
  });

  it('REJETTE un résultat net absurde face au chiffre d’affaires', () => {
    const v = verifierExtraction(ex([{ annee: 2026, revenu_total: 10e9, resultat_net: 90e9 }]), cible, null);
    expect(v.ok).toBe(false);
  });

  it('REJETTE une extraction vide', () => {
    expect(verifierExtraction(ex([{ annee: 2026 }]), cible, null).ok).toBe(false);
  });

  it('bornes larges : un T1 saisonnier à 40 % de l’annuel passe', () => {
    const [bas, haut] = bornesCumul('T1');
    expect(bas).toBeLessThan(0.1);
    expect(haut).toBeGreaterThan(0.4);
  });
});

describe('choisirPublications', () => {
  const pub = (id: string, code: string, libelle: string, date: string) => ({
    id, code, libelle, date_publication: date, source_url: `https://x/${id}.pdf`,
  });

  it('une publication par société et période, le rapport d’activités d’abord, les plus anciennes en tête', () => {
    const r = choisirPublications(
      [
        pub('a', 'ETIT', "Rapport d'examen limité sur les informations financières intermediaires - 1er semestre 2026 - ETI", '2026-07-30'),
        pub('b', 'ETIT', "Rapport d'activités - 1er semestre 2026 - ETI TG", '2026-07-29'),
        pub('c', 'SNTS', "Rapport d'activités - 1er trimestre 2026 - SONATEL SN", '2026-04-30'),
        pub('d', 'SNTS', "Rapport d'activités - 1er trimestre 2024 - SONATEL SN", '2024-04-30'),
        pub('e', 'BOAS', 'Bilan semestriel du contrat de liquidité -1er semestre 2026 - BOA SN', '2026-07-15'),
      ],
      2025,
    );
    expect(r.map((p) => p.id)).toEqual(['b', 'c']);
  });
});

describe('lignesInterim', () => {
  it('range PNB et encours dans lignes_specifiques, arrondit, ne touche jamais l’annuel', () => {
    const { income, balance } = lignesInterim('SGBC', { annee: 2026, code: 'S1' }, {
      annee: 2026, revenu_total: null, pnb: 134_059_000_000.4, resultat_exploitation: null, resultat_avant_impots: null,
      resultat_net: 53_350e6, total_actifs: null, total_capitaux_propres: null,
      depots_clientele: 3_066_575e6, credits_clientele: 2_581_361e6,
    });
    expect(income).toMatchObject({
      periode: '2026-S1', type_periode: 'semestriel', revenu_total: 134_059_000_000, lignes_specifiques: { pnb: 134_059_000_000 },
    });
    expect(balance).toMatchObject({ type_periode: 'semestriel', lignes_specifiques: { depots_clientele: 3_066_575e6 } });
  });

  it('aucune ligne de bilan sans donnée de bilan', () => {
    const { balance } = lignesInterim('SNTS', { annee: 2026, code: 'T1' }, {
      annee: 2026, revenu_total: 500e9, pnb: null, resultat_exploitation: null, resultat_avant_impots: null,
      resultat_net: 100e9, total_actifs: null, total_capitaux_propres: null, depots_clientele: null, credits_clientele: null,
    });
    expect(balance).toBeNull();
  });
});

describe('Gemini — choix du modèle et format', async () => {
  const { choisirModeleFlash, corpsRequete, texteReponse } = await import('../src/interim/gemini.js');
  const gen = ['generateContent'];

  it('retient le flash stable le plus récent, écarte lite/preview/image/tts', () => {
    const m = choisirModeleFlash([
      { name: 'models/gemini-3.1-pro', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.6-flash', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.7-flash', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.8-flash-preview-09', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.7-flash-lite', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.7-flash-image', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.9-flash', supportedGenerationMethods: ['embedContent'] },
    ]);
    expect(m).toBe('gemini-3.7-flash');
  });

  it('aucun candidat → null (le scraper retombe sur la chaîne texte)', () => {
    expect(choisirModeleFlash([{ name: 'models/gemini-3.1-pro', supportedGenerationMethods: gen }])).toBeNull();
  });

  it('envoie le PDF en inlineData et demande du JSON', () => {
    const c = corpsRequete('SYS', 'CONSIGNE', 'QkFTRTY0');
    expect(c.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'application/pdf', data: 'QkFTRTY0' } });
    expect(c.generationConfig.responseMimeType).toBe('application/json');
    expect(c.systemInstruction.parts[0].text).toBe('SYS');
  });

  it('lit le texte de la réponse, hors parties « pensée », et null si vide', () => {
    expect(texteReponse({ candidates: [{ content: { parts: [{ text: 'brouillon', thought: true }, { text: '{"a":1}' }] } }] })).toBe('{"a":1}');
    expect(texteReponse({ candidates: [] })).toBeNull();
    expect(texteReponse({ promptFeedback: { blockReason: 'SAFETY' } })).toBeNull();
  });
});
