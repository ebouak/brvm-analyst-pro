import { describe, expect, it } from 'vitest';
import { ajouterJoursOuvres, ecartJours, joursOuvresEntre } from '../src/articles/calendrier.js';
import { detecter } from '../src/articles/detecteurs.js';
import { assembler, rediger } from '../src/articles/redaction.js';
import { verifier } from '../src/articles/verrous.js';
import { legende, legendeGroupe, planDiffusion } from '../src/articles/diffusion.js';
import { assertNoForeignNumber } from '../src/hebdo/polish.js';
import type { Contexte, CoursRow, DividendeRow, Fait } from '../src/articles/types.js';

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

const ligne = (code: string, date: string, cours: number, variation: number, volume: number, haut = 0, bas = 0): CoursRow => ({
  code,
  date_marche: date,
  cours_jour: cours,
  variation_pct: variation,
  volume,
  cours_haut_52s: haut || null,
  cours_bas_52s: bas || null,
});
const historique = (code: string, volume: number) =>
  Array.from({ length: 30 }, (_, i) => ligne(code, `2026-09-${String(i + 1).padStart(2, '0')}`, 1000, 0, volume));

function contexte(cours: CoursRow[]): Contexte {
  return {
    aujourdhui: '2026-10-28',
    derniereSeance: '2026-10-27',
    noms: { SDSC: 'AFRICA GLOBAL LOGISTICS', SNTS: 'SONATEL', BOAM: 'BANK OF AFRICA MALI', CIEC: 'CIE CI' },
    cours: Object.fromEntries(cours.map((c) => [c.code, c])),
    historique: Object.fromEntries(cours.map((c) => [c.code, historique(c.code, 1000)])),
  };
}
const SDSC_2025: DividendeRow = {
  code: 'SDSC', exercice: 2025, montant: 92, ex_date: '2026-10-26', payment_date: '2026-10-27',
  source: 'brvm-calendrier', created_at: '2026-08-09T03:00:00Z',
};

describe('detecter', () => {
  it('annonce un dividende récemment inscrit, avec son rendement', () => {
    const ctx = contexte([ligne('SNTS', '2026-10-27', 4425, -5.85, 900)]);
    const faits = detecter(ctx, [
      { code: 'SNTS', exercice: 2025, montant: 174, ex_date: null, payment_date: null, source: 'brvm-calendrier', created_at: '2026-10-27T03:00:00Z' },
    ], []);
    const f = faits.find((x) => x.type === 'dividende_annonce');
    expect(f?.cle).toBe('2025');
    expect(f?.donnees.rendement).toBe(3.93);
  });

  it('ignore un dividende ancien ou de source non fiable', () => {
    expect(detecter(contexte([]), [
      { code: 'SNTS', exercice: 2025, montant: 174, ex_date: null, payment_date: null, source: 'brvm-calendrier', created_at: '2026-10-01T03:00:00Z' },
      { code: 'SNTS', exercice: 2024, montant: 166, ex_date: null, payment_date: null, source: 'sikafinance', created_at: '2026-10-27T03:00:00Z' },
    ], [])).toEqual([]);
  });

  it('rappelle un détachement à 1-3 séances, puis un paiement la veille', () => {
    const ctx = { ...contexte([]), aujourdhui: '2026-10-23' };
    expect(detecter(ctx, [SDSC_2025], []).map((f) => f.type)).toEqual(['detachement_rappel']);
    expect(detecter({ ...ctx, aujourdhui: '2026-10-26' }, [SDSC_2025], []).map((f) => f.type)).toEqual(['paiement_rappel']);
  });

  it('annonce une opération sur titres proche', () => {
    const faits = detecter(contexte([]), [], [{ code: 'SNTS', date_effet: '2026-10-26', type: 'fractionnement', ratio: 10 }]);
    expect(faits[0]).toMatchObject({ type: 'operation_titres', cle: '2026-10-26' });
  });

  it('retient au plus 2 séances hors norme, variation ET volume', () => {
    const ctx = contexte([
      ligne('CIEC', '2026-10-27', 5250, 7.47, 9000),
      ligne('BOAM', '2026-10-27', 5800, 5.45, 5000),
      ligne('SNTS', '2026-10-27', 4425, -5.85, 3000),
      ligne('SDSC', '2026-10-27', 2810, -6.33, 1500), // volume < 2× la moyenne : écarté
    ]);
    const s = detecter(ctx, [], []).filter((f) => f.type === 'seance_hors_norme');
    expect(s.map((f) => f.code)).toEqual(['CIEC', 'BOAM']);
    expect(s[0].donnees.ratio_volume).toBe(9);
  });

  it('retient un record 52 semaines sur fort volume même sous 5 %', () => {
    const ctx = contexte([ligne('BOAM', '2026-10-27', 5800, 2.1, 4000, 5800, 3000)]);
    const s = detecter(ctx, [], []).find((f) => f.type === 'seance_hors_norme');
    expect(s?.donnees.record).toBe('haut');
  });

  it('juxtapose un détachement récent à la séance hors norme', () => {
    const ctx = contexte([ligne('SDSC', '2026-10-27', 2810, -6.33, 5000)]);
    const s = detecter(ctx, [SDSC_2025], []).find((f) => f.type === 'seance_hors_norme');
    expect(s?.donnees.dividende_detache).toBe(92);
  });
});

const NOMS = { SNTS: 'SONATEL', SDSC: 'AFRICA GLOBAL LOGISTICS', CIEC: 'CIE CI' };
const FAITS: Fait[] = [
  { type: 'dividende_annonce', code: 'SNTS', cle: '2025', dateFait: '2026-10-27', donnees: { montant: 174, exercice: 2025, ex_date: '2026-11-03', payment_date: '2026-11-05', cours: 4425, date_cours: '2026-10-27', rendement: 3.93, source: 'brvm-calendrier' } },
  { type: 'detachement_rappel', code: 'SDSC', cle: '2026-10-26', dateFait: '2026-10-26', donnees: { montant: 92, exercice: 2025, ex_date: '2026-10-26', payment_date: '2026-10-27', cours: 2810, date_cours: '2026-10-23', rendement: 3.27, source: 'brvm-calendrier' } },
  { type: 'paiement_rappel', code: 'SDSC', cle: '2026-10-27', dateFait: '2026-10-27', donnees: { montant: 92, exercice: 2025, ex_date: '2026-10-26', payment_date: '2026-10-27', cours: 2810, date_cours: '2026-10-23', rendement: null, source: 'brvm-calendrier' } },
  { type: 'operation_titres', code: 'SNTS', cle: '2026-10-26', dateFait: '2026-10-26', donnees: { ratio: 10, operation: 'fractionnement', date_effet: '2026-10-26', cours: 4700 } },
  { type: 'seance_hors_norme', code: 'CIEC', cle: '2026-10-27', dateFait: '2026-10-27', donnees: { cours: 5250, variation: 7.47, volume: 9245, volume_moyen: 1030, ratio_volume: 9, seances_moyenne: 30, record: null, dividende_detache: null, date_detachement: null } },
];

describe('rediger', () => {
  for (const f of FAITS) {
    it(`${f.type} : aucun chiffre hors liste blanche`, () => {
      const b = rediger(f, NOMS);
      const texte = [b.titre, b.chapo, ...b.sections.map((s) => `${s.titre}\n${s.texte}`), b.image.chiffre, b.image.legende].join('\n');
      expect(assertNoForeignNumber(texte, b.chiffres)).toBe(true);
      expect(b.slug).toMatch(/^[a-z0-9-]+$/);
      expect(b.sources.length).toBeGreaterThan(0);
    });
  }

  it('annonce le montant, le rendement et les dates', () => {
    const b = rediger(FAITS[0], NOMS);
    expect(b.titre).toBe('SONATEL versera 174 F par action au titre de l’exercice 2025');
    expect(b.chapo).toContain('3,93 %');
    expect(b.chapo).toContain('3 novembre 2026');
    expect(b.slug).toBe('dividende-snts-2025');
  });

  it('juxtapose un détachement sans lien de cause', () => {
    const f: Fait = {
      ...FAITS[4],
      code: 'SDSC',
      donnees: { ...FAITS[4].donnees, variation: -6.33, dividende_detache: 92, date_detachement: '2026-10-26' },
    };
    const texte = rediger(f, NOMS).sections.map((s) => s.texte).join(' ');
    expect(texte).toContain('92 F');
    expect(texte).not.toMatch(/à cause|en raison|suite à/);
  });
});

describe('verifier', () => {
  const b = rediger(FAITS[4], NOMS);
  const article = { titre: b.titre, chapo: b.chapo, corps_md: assembler(b.sections, b.sources), sources: b.sources, chiffres: b.chiffres };
  const ctx = { aujourdhui: '2026-10-28', derniereSeance: '2026-10-27' };

  it('laisse passer un article conforme', () => {
    expect(verifier(article, FAITS[4], ctx)).toEqual({ ok: true, manquants: [] });
  });
  it('bloque une donnée périmée', () => {
    expect(verifier(article, FAITS[4], { ...ctx, derniereSeance: '2026-10-20' }).manquants).toContain('fraicheur');
  });
  it('bloque une variation impossible', () => {
    const f = { ...FAITS[4], donnees: { ...FAITS[4].donnees, variation: -89.28 } };
    expect(verifier(article, f, ctx).manquants).toContain('plausible');
  });
  it('bloque un chiffre inventé', () => {
    expect(verifier({ ...article, chapo: `${article.chapo} Objectif 9999 F.` }, FAITS[4], ctx).manquants).toContain('chiffres_verifies');
  });
  it('bloque sans source ni avertissement', () => {
    const m = verifier({ ...article, sources: [], corps_md: 'texte' }, FAITS[4], ctx).manquants;
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
