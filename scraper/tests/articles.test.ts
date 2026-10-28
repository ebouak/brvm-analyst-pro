import { describe, expect, it } from 'vitest';
import { ajouterJoursOuvres, ecartJours, joursOuvresEntre } from '../src/articles/calendrier.js';
import { detecter } from '../src/articles/detecteurs.js';
import { assembler, rediger } from '../src/articles/redaction.js';
import { verifier } from '../src/articles/verrous.js';
import { legende, legendeGroupe, planDiffusion } from '../src/articles/diffusion.js';
import { nomDit } from '../src/articles/noms.js';
import { assertNoForeignNumber } from '../src/hebdo/polish.js';
import { cleFait, type Contexte, type CoursRow, type DividendeRow, type Fait, type Reperes } from '../src/articles/types.js';

describe('calendrier', () => {
  it('compte les séances ouvrées entre deux dates', () => {
    expect(joursOuvresEntre('2026-10-23', '2026-10-26')).toBe(1); // vendredi → lundi
    expect(joursOuvresEntre('2026-10-26', '2026-10-29')).toBe(3);
    expect(joursOuvresEntre('2026-10-29', '2026-10-26')).toBe(0);
  });
  it('ajoute des jours ouvrés', () => {
    expect(ajouterJoursOuvres('2026-10-23', 1)).toBe('2026-10-26');
  });
  it('mesure un écart calendaire', () => {
    expect(ecartJours('2026-10-26', '2026-10-28')).toBe(2);
  });
});

describe('nomDit', () => {
  it('écrit les noms comme dans la presse', () => {
    expect(nomDit('SONATEL')).toBe('Sonatel');
    expect(nomDit('NESTLE CI')).toBe('Nestlé CI');
    expect(nomDit("NSIA BANQUE COTE D'IVOIRE")).toBe('NSIA Banque');
    expect(nomDit('BANK OF AFRICA SENEGAL', ['BANK OF AFRICA SENEGAL', 'BANK OF AFRICA NIGER'])).toBe('Bank of Africa Sénégal');
  });
});

const SEANCE = '2026-10-28';
const ligne = (code: string, cours: number, variation: number, volume: number, valeur: number, haut = 0, bas = 0): CoursRow => ({
  code,
  date_marche: SEANCE,
  cours_jour: cours,
  cours_precedent: Number((cours / (1 + variation / 100)).toFixed(0)),
  variation_pct: variation,
  volume,
  valeur_echangee: valeur,
  cours_haut_52s: haut || null,
  cours_bas_52s: bas || null,
});
const historique = (code: string, volume: number): CoursRow[] =>
  Array.from({ length: 30 }, (_, i) => ({
    ...ligne(code, 1000, 0, volume, 0),
    date_marche: `2026-09-${String(i + 1).padStart(2, '0')}`,
  }));
/** 20 valeurs calmes : une séance n'est commentée qu'au-delà de ce seuil. */
const calmes = Array.from({ length: 20 }, (_, i) => ligne(`C${String(i).padStart(3, '0')}`, 1000, i % 3 === 0 ? 0 : i % 2 ? 1 : -1, 1000, 10_000_000));

function contexte(cours: CoursRow[], extra: Partial<Contexte> = {}): Contexte {
  const toutes = [...cours, ...calmes];
  return {
    aujourdhui: '2026-10-29',
    derniereSeance: SEANCE,
    noms: { SDSC: 'AFRICA GLOBAL LOGISTICS CI', SNTS: 'SONATEL', BOAM: 'BANK OF AFRICA MALI', CIEC: 'CIE CI' },
    cours: Object.fromEntries(toutes.map((c) => [c.code, c])),
    historique: Object.fromEntries(toutes.map((c) => [c.code, historique(c.code, 1000)])),
    indices: [
      { code: 'BRVMC', valeur: 528.34, variation_pct: -0.7 },
      { code: 'BRVM30', valeur: 256.25, variation_pct: -0.75 },
      { code: 'BRVMPRES', valeur: 196.62, variation_pct: -1.13 },
    ],
    actions: { SNTS: 1_000_000_000 },
    ...extra,
  };
}
const SDSC_2025: DividendeRow = {
  code: 'SDSC', exercice: 2025, montant: 92, ex_date: '2026-10-26', payment_date: '2026-10-27',
  source: 'brvm-calendrier', created_at: '2026-08-09T03:00:00Z',
};
const seanceDe = (faits: Fait[]) => faits.find((f) => f.type === 'seance_hors_norme');

describe('detecter — dividendes et opérations', () => {
  it('annonce un dividende récemment inscrit, avec son rendement', () => {
    const ctx = contexte([ligne('SNTS', 4425, -5.85, 900, 1e9)]);
    const f = detecter(ctx, [
      { code: 'SNTS', exercice: 2025, montant: 174, ex_date: null, payment_date: null, source: 'brvm-calendrier', created_at: '2026-10-28T03:00:00Z' },
    ], []).find((x) => x.type === 'dividende_annonce');
    expect(f?.cle).toBe('2025');
    expect(f?.donnees.rendement).toBe(3.93);
  });

  it('ignore un dividende ancien ou de source non fiable', () => {
    const faits = detecter(contexte([]), [
      { code: 'SNTS', exercice: 2025, montant: 174, ex_date: null, payment_date: null, source: 'brvm-calendrier', created_at: '2026-10-01T03:00:00Z' },
      { code: 'SNTS', exercice: 2024, montant: 166, ex_date: null, payment_date: null, source: 'sikafinance', created_at: '2026-10-28T03:00:00Z' },
    ], []);
    expect(faits.filter((f) => f.type !== 'seance_hors_norme')).toEqual([]);
  });

  it('rappelle un détachement à 1-3 séances, puis un paiement la veille', () => {
    const types = (aujourdhui: string) =>
      detecter({ ...contexte([]), aujourdhui }, [SDSC_2025], []).filter((f) => f.type !== 'seance_hors_norme').map((f) => f.type);
    expect(types('2026-10-23')).toEqual(['detachement_rappel']);
    expect(types('2026-10-26')).toEqual(['paiement_rappel']);
  });

  it('annonce une opération sur titres proche', () => {
    const f = detecter(contexte([]), [], [{ code: 'SNTS', date_effet: '2026-10-26', type: 'fractionnement', ratio: 10 }]);
    expect(f.find((x) => x.type === 'operation_titres')).toMatchObject({ cle: '2026-10-26' });
  });
});

describe('detecter — compte rendu de séance', () => {
  it('ne commente pas une séance de moins de 20 valeurs', () => {
    const ctx = contexte([]);
    ctx.cours = Object.fromEntries(calmes.slice(0, 10).map((c) => [c.code, c]));
    expect(seanceDe(detecter(ctx, [], []))).toBeUndefined();
  });

  it('met en avant un record de capitaux, avec la part et la capitalisation', () => {
    const ctx = contexte([ligne('SNTS', 4200, -5.08, 3_123_435, 12_851_939_000), ligne('CIEC', 5250, 7.47, 9000, 50_000_000)], {
      recordsValeur: { SNTS: { valeur: 4_293_531_525, date: '2026-10-20', depuis: '2007-01-02' } },
    });
    const s = seanceDe(detecter(ctx, [], []))!;
    expect(s.code).toBe('SNTS');
    expect(s.donnees.rang).toBe(4);
    expect(s.donnees.record_valeur).toBe(true);
    expect(s.donnees.capitalisation_delta).toBe(-225_000_000_000);
    expect(cleFait(s)).toBe('seance_hors_norme|2026-10-28');
  });

  it('à défaut de record, retient une valeur qui pèse au moins 40 % des échanges', () => {
    const s = seanceDe(detecter(contexte([ligne('SNTS', 4200, -1, 2000, 500_000_000), ligne('CIEC', 5250, 7.47, 9000, 50_000_000)]), [], []))!;
    expect(s.code).toBe('SNTS');
    expect(s.donnees.rang).toBe(3);
  });

  it('sinon une séance hors norme, sinon la plus forte variation', () => {
    expect(seanceDe(detecter(contexte([ligne('CIEC', 5250, 7.47, 9000, 50_000_000), ligne('BOAM', 5800, 5.45, 5000, 40_000_000)]), [], []))!.code).toBe('CIEC');
    const s = seanceDe(detecter(contexte([ligne('BOAM', 5800, 4.5, 900, 9_000_000)]), [], []))!;
    expect(s.code).toBe('BOAM');
    expect(s.donnees.rang).toBe(1);
  });

  it('juxtapose un détachement et rappelle une opération sur titres récente', () => {
    const ctx = contexte([ligne('SDSC', 2810, -6.33, 5000, 300_000_000)]);
    ctx.historique.SDSC = [...historique('SDSC', 1000), { ...ligne('SDSC', 3000, 0, 1000, 0), date_marche: '2026-10-27' }];
    const s = seanceDe(detecter(ctx, [{ ...SDSC_2025, ex_date: '2026-10-28' }], [{ code: 'SDSC', date_effet: '2026-10-26', type: 'fractionnement', ratio: 10 }]))!;
    expect(s.donnees.dividende_detache).toBe(92);
    expect(s.donnees.operation).toMatchObject({ ratio: 10 });
  });
});

const NOMS = { SNTS: 'SONATEL', SDSC: 'AFRICA GLOBAL LOGISTICS CI', CIEC: 'CIE CI', BOAM: 'BANK OF AFRICA MALI', BOAN: 'BANK OF AFRICA NIGER', NTLC: 'NESTLE CI' };
const REPERES: Reperes = {
  bpa: 413.6,
  exercice_bpa: '2025',
  dividendes: [{ exercice: 2025, montant: 174 }, { exercice: 2024, montant: 166 }],
  liquidite_classe: 'A',
  liquidite_score: 100,
  signal: 'HOLD',
};
const SEANCE_SNTS: Fait = {
  type: 'seance_hors_norme', code: 'SNTS', cle: SEANCE, dateFait: SEANCE,
  donnees: {
    rang: 4, cours: 4200, cours_precedent: 4425, variation: -5.08, volume: 3123435, valeur: 12851939000, total: 14145000000,
    part: 90.86, capitalisation_delta: -225e9, record_valeur: true,
    record_prec: { valeur: 4293531525, date: '2026-10-20', depuis: '2007-01-02' },
    volume_moyen: 318000, ratio_volume: 9.8, seances_moyenne: 30, record: null, cours_haut_52s: 4700, cours_bas_52s: 2440,
    dividende_detache: null, date_detachement: null, operation: { type: 'fractionnement', ratio: 10, date_effet: '2026-10-26' },
    indices: { BRVMC: { valeur: 528.34, variation: -0.7 }, BRVM30: { valeur: 256.25, variation: -0.75 }, BRVMPRES: { valeur: 196.62, variation: -1.13 } },
    hausses: 13, baisses: 21, stables: 14,
    top_hausses: [{ code: 'BOAM', cours: 5800, variation: 5.45 }],
    top_baisses: [{ code: 'NTLC', cours: 13205, variation: -3.58 }],
  },
};
const FAITS: Fait[] = [
  { type: 'dividende_annonce', code: 'SNTS', cle: '2025', dateFait: '2026-10-27', donnees: { montant: 174, exercice: 2025, ex_date: '2026-11-03', payment_date: '2026-11-05', cours: 4425, date_cours: '2026-10-27', rendement: 3.93, source: 'brvm-calendrier' } },
  { type: 'detachement_rappel', code: 'SDSC', cle: '2026-10-26', dateFait: '2026-10-26', donnees: { montant: 92, exercice: 2025, ex_date: '2026-10-26', payment_date: '2026-10-27', cours: 2810, date_cours: '2026-10-23', rendement: 3.27, source: 'brvm-calendrier' } },
  { type: 'paiement_rappel', code: 'SDSC', cle: '2026-10-27', dateFait: '2026-10-27', donnees: { montant: 92, exercice: 2025, ex_date: '2026-10-26', payment_date: '2026-10-27', cours: 2810, date_cours: '2026-10-23', rendement: null, source: 'brvm-calendrier' } },
  { type: 'operation_titres', code: 'SNTS', cle: '2026-10-26', dateFait: '2026-10-26', donnees: { ratio: 10, operation: 'fractionnement', date_effet: '2026-10-26', cours: 4700 } },
  SEANCE_SNTS,
];

describe('rediger', () => {
  for (const f of FAITS) {
    it(`${f.type} : aucun chiffre hors liste blanche`, () => {
      const b = rediger(f, NOMS, REPERES);
      const texte = [b.titre, b.chapo, ...b.sections.map((s) => `${s.titre}\n${s.texte}`), b.image.chiffre, b.image.legende].join('\n');
      expect(assertNoForeignNumber(texte, b.chiffres)).toBe(true);
      expect(b.slug).toMatch(/^[a-z0-9-]+$/);
      expect(b.sources.length).toBeGreaterThan(0);
    });
  }

  it('annonce le montant, le rendement, les dates et l’évolution du dividende', () => {
    const b = rediger(FAITS[0]!, NOMS, REPERES);
    expect(b.titre).toBe('Sonatel versera 174 F par action au titre de l’exercice 2025');
    expect(b.chapo).toContain('3,93 %');
    expect(b.chapo).toContain('3 novembre 2026');
    expect(b.sections.map((s) => s.texte).join(' ')).toContain('hausse de 4,8 %');
    expect(b.slug).toBe('dividende-snts-2025');
  });

  it('écrit la séance comme un compte rendu : marché, valeur, autres mouvements, repères', () => {
    const b = rediger(SEANCE_SNTS, NOMS, REPERES);
    expect(b.titre).toBe('BRVM : Sonatel signe un record de 12,85 milliards FCFA échangés');
    expect(b.sections.map((s) => s.titre)).toEqual(['Le marché', 'Sonatel', 'Les autres mouvements', 'Repères pour l’investisseur']);
    const texte = b.sections.map((s) => s.texte).join(' ');
    for (const attendu of ['le BRVM Composite perd 0,70 % à 528,34 points, le BRVM 30 perd 0,75 % à 256,25 points et le BRVM Prestige', '90,86 %', 'recule de 225 milliards FCFA', 'le 2 janvier 2007', 'Bank of Africa Mali (+5,45 % à 5 800 F)', '10,2 fois le bénéfice', 'fractionnement']) {
      expect(texte).toContain(attendu);
    }
    expect(b.image.chiffre).toBe('12,85 Md');
  });

  it('juxtapose un détachement sans lien de cause', () => {
    const f: Fait = { ...SEANCE_SNTS, code: 'SDSC', donnees: { ...SEANCE_SNTS.donnees, rang: 2, dividende_detache: 92, date_detachement: '2026-10-26' } };
    const texte = rediger(f, NOMS).sections.map((s) => s.texte).join(' ');
    expect(texte).toContain('92 F');
    expect(texte).not.toMatch(/à cause|en raison|suite à/);
  });
});

describe('verifier', () => {
  const b = rediger(SEANCE_SNTS, NOMS, REPERES);
  const article = { titre: b.titre, chapo: b.chapo, corps_md: assembler(b.sections, b.sources), sources: b.sources, chiffres: b.chiffres };
  const ctx = { aujourdhui: '2026-10-29', derniereSeance: SEANCE };

  it('laisse passer un article conforme', () => {
    expect(verifier(article, SEANCE_SNTS, ctx)).toEqual({ ok: true, manquants: [] });
  });
  it('bloque une donnée périmée', () => {
    expect(verifier(article, SEANCE_SNTS, { ...ctx, derniereSeance: '2026-10-20' }).manquants).toContain('fraicheur');
  });
  it('bloque une variation impossible', () => {
    const f = { ...SEANCE_SNTS, donnees: { ...SEANCE_SNTS.donnees, variation: -89.28 } };
    expect(verifier(article, f, ctx).manquants).toContain('plausible');
  });
  it('bloque un chiffre inventé', () => {
    expect(verifier({ ...article, chapo: `${article.chapo} Objectif 9999 F.` }, SEANCE_SNTS, ctx).manquants).toContain('chiffres_verifies');
  });
  it('bloque sans source ni avertissement', () => {
    const m = verifier({ ...article, sources: [], corps_md: 'texte' }, SEANCE_SNTS, ctx).manquants;
    expect(m).toEqual(expect.arrayContaining(['source_citee', 'avertissement']));
  });
});

const art = (slug: string) => ({ slug, titre: `Titre ${slug}`, chapo: 'Chapô.' });
describe('planDiffusion', () => {
  it('diffuse chaque article tant que le plafond le permet', () => {
    expect(planDiffusion([art('a'), art('b')], 0)).toEqual({ individuels: [art('a'), art('b')], groupe: [], ignores: [] });
  });
  it('regroupe au-delà du plafond de 3 posts', () => {
    const p = planDiffusion([art('a'), art('b'), art('c'), art('d')], 0);
    expect(p.individuels.map((x) => x.slug)).toEqual(['a', 'b']);
    expect(p.groupe.map((x) => x.slug)).toEqual(['c', 'd']);
  });
  it('ne diffuse plus rien une fois le plafond atteint', () => {
    expect(planDiffusion([art('a')], 3)).toEqual({ individuels: [], groupe: [], ignores: [art('a')] });
  });
  it('compose des légendes avec le lien', () => {
    expect(legende(art('a'), 'https://w.com')).toContain('https://w.com/actualites/a');
    expect(legendeGroupe([art('a'), art('b')], 'https://w.com')).toContain('Les faits du jour');
  });
});
