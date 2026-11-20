/**
 * Règle du « rendement au cours du jour » dans les textes publiés
 * (src/hebdo/pure/rendementDividende.ts, copie de frontend/lib/hebdo) et son
 * application aux articles (src/articles/redaction.ts, detecteurs.ts).
 *
 * Cas d'origine : article `seance-ftsc-2026-11-19`, « dividende de 1 726,56 F
 * au titre de l'exercice 2024, soit 108,59 % au cours du jour » — montant exact
 * (distribution exceptionnelle payée le 30/09/2025), rapport au cours trompeur.
 */
import { describe, expect, it } from 'vitest';
import { dividendeAncien, lireDividende } from '../src/hebdo/pure/rendementDividende.js';
import { ligneDividende, Plume, rediger } from '../src/articles/redaction.js';
import { detecter } from '../src/articles/detecteurs.js';
import { assertNoForeignNumber } from '../src/hebdo/polish.js';
import type { Contexte, CoursRow, Fait, Reperes } from '../src/articles/types.js';

const SEANCE_FTSC = '2026-11-19';
const FTSC_DIVS: Reperes['dividendes'] = [
  { exercice: 2024, montant: 1726.56, payment_date: '2025-09-30' },
  { exercice: 2023, montant: 79.2, payment_date: '2024-09-30' },
];

describe('règle : quand un dividende peut être rapporté au cours', () => {
  it('ancien : payé il y a plus de 12 mois → pas de rendement (FTSC)', () => {
    expect(lireDividende(FTSC_DIVS, 1590, SEANCE_FTSC)).toMatchObject({ mode: 'sans_rendement', motif: 'ancien', exercice: 2024, montant: 1726.56 });
  });

  it('ancien sans date de paiement : au-delà de la fin d’exercice + 18 mois', () => {
    expect(dividendeAncien({ exercice: 2024, montant: 50 }, '2026-06-30')).toBe(false);
    expect(dividendeAncien({ exercice: 2024, montant: 50 }, '2026-07-01')).toBe(true);
    expect(dividendeAncien({ exercice: 2025, montant: 50 }, '2026-11-19')).toBe(false);
  });

  it('un paiement à venir n’est jamais ancien', () => {
    expect(dividendeAncien({ exercice: 2025, montant: 50, payment_date: '2026-12-15' }, '2026-11-19')).toBe(false);
  });

  it('anormal : plus de 3 fois la médiane des exercices précédents', () => {
    const lignes = [
      { exercice: 2025, montant: 1000, payment_date: '2026-07-01' },
      { exercice: 2024, montant: 100 },
      { exercice: 2023, montant: 110 },
      { exercice: 2022, montant: 120 },
    ];
    expect(lireDividende(lignes, 20000, SEANCE_FTSC)).toMatchObject({ mode: 'sans_rendement', motif: 'anormal', exercice: 2025 });
    // 3 fois la médiane tout juste : pas anormal.
    expect(lireDividende([{ ...lignes[0]!, montant: 330 }, ...lignes.slice(1)], 20000, SEANCE_FTSC)).toMatchObject({ mode: 'rendement' });
  });

  it('anormal : rendement calculé au-delà de 25 %, même sans historique', () => {
    expect(lireDividende([{ exercice: 2025, montant: 500, payment_date: '2026-07-01' }], 1500, SEANCE_FTSC)).toMatchObject({
      mode: 'sans_rendement',
      motif: 'anormal',
    });
  });

  it('montant 0 ou nul : donnée absente, ignorée — on lit l’exercice précédent sans rien conclure', () => {
    const lignes = [
      { exercice: 2025, montant: 0 },
      { exercice: 2026, montant: null },
      { exercice: 2024, montant: 80, payment_date: '2025-06-30' },
    ];
    const recent = lireDividende(lignes, 2000, '2025-10-01');
    expect(recent).toMatchObject({ mode: 'rendement', exercice: 2024, montant: 80 });
    expect(lireDividende(lignes, 2000, SEANCE_FTSC)).toMatchObject({ mode: 'sans_rendement', motif: 'ancien', exercice: 2024 });
    expect(lireDividende([{ exercice: 2025, montant: 0 }], 2000, SEANCE_FTSC)).toBeNull();
  });

  it('cas normal récent : le rendement est gardé (SNTS 174 F, exercice 2025)', () => {
    const l = lireDividende([{ exercice: 2025, montant: 174, payment_date: '2026-05-26' }, { exercice: 2024, montant: 166 }], 4200, '2026-10-28');
    expect(l).toMatchObject({ mode: 'rendement', exercice: 2025 });
    expect(l?.mode === 'rendement' && Number(l.rendementPct.toFixed(2))).toBe(4.14);
  });
});

describe('articles : ligne « dividende » des repères', () => {
  it('FTSC : « Dernier dividende versé », exercice et date de paiement, sans rendement ni adjectif', () => {
    const p = new Plume();
    const l = ligneDividende(p, FTSC_DIVS, 1590, SEANCE_FTSC)!;
    expect(l).toBe('- **Dernier dividende versé** : 1 726,56 F (exercice 2024, payé le 30 septembre 2025).');
    expect(l).not.toMatch(/cours du jour|rendement|exceptionnel/i);
    expect(assertNoForeignNumber(l, p.liste)).toBe(true);
  });

  it('cas normal : rendement au cours du jour et évolution face à l’exercice précédent', () => {
    const p = new Plume();
    const l = ligneDividende(p, [{ exercice: 2025, montant: 174 }, { exercice: 2024, montant: 166 }], 4200, '2026-10-28')!;
    expect(l).toBe('- **Rendement** : dividende de 174 F au titre de l’exercice 2025, soit 4,14 % au cours du jour. Il était de 166 F au titre de l’exercice 2024, soit une hausse de 4,8 %.');
    expect(assertNoForeignNumber(l, p.liste)).toBe(true);
  });

  it('pas d’évolution face à un exercice précédent lui-même hors norme', () => {
    const l = ligneDividende(new Plume(), [{ exercice: 2025, montant: 80 }, ...FTSC_DIVS], 1590, '2026-07-15')!;
    expect(l).toMatch(/^- \*\*Rendement\*\* : dividende de 80 F/);
    expect(l).not.toContain('1 726,56');
  });

  it('pas d’évolution face à un exercice non consécutif', () => {
    const l = ligneDividende(new Plume(), [{ exercice: 2025, montant: 174 }, { exercice: 2022, montant: 150 }], 4200, '2026-10-28')!;
    expect(l).not.toContain('Il était');
  });
});

const SEANCE_FAIT: Fait = {
  type: 'seance_hors_norme', code: 'FTSC', cle: SEANCE_FTSC, dateFait: SEANCE_FTSC,
  donnees: {
    rang: 2, cours: 1590, cours_precedent: 1700, variation: -6.47, volume: 20000, valeur: 31_800_000, total: 1_500_000_000,
    part: 2.12, capitalisation_delta: null, record_valeur: false, record_prec: null, volume_moyen: 5000, ratio_volume: 4,
    seances_moyenne: 30, record: null, cours_haut_52s: 2200, cours_bas_52s: 1500, dividende_detache: null, date_detachement: null,
    operation: null, indices: {}, hausses: 10, baisses: 20, stables: 17, top_hausses: [], top_baisses: [],
  },
};

describe('articles : article de séance FTSC (avant / après)', () => {
  const REPERES_FTSC: Reperes = { bpa: 28.1, exercice_bpa: '2025', dividendes: FTSC_DIVS, liquidite_classe: null, liquidite_score: null, signal: null };
  const b = rediger(SEANCE_FAIT, { FTSC: 'FILTISAC CI' }, REPERES_FTSC);
  const reperes = b.sections.find((s) => s.titre === 'Repères pour l’investisseur')!.texte;

  it('n’écrit plus de rendement au cours du jour', () => {
    expect(reperes).not.toContain('au cours du jour');
    expect(reperes).toContain('**Dernier dividende versé** : 1 726,56 F (exercice 2024, payé le 30 septembre 2025).');
  });

  it('ne mêle jamais BPA et dividende d’exercices différents dans une même ligne', () => {
    for (const ligne of reperes.split('\n')) {
      expect(/bénéfice par action/.test(ligne) && /dividende/.test(ligne)).toBe(false);
    }
  });

  it('liste blanche cohérente : aucun chiffre écrit hors Plume', () => {
    const texte = [b.titre, b.chapo, ...b.sections.map((s) => `${s.titre}\n${s.texte}`)].join('\n');
    expect(assertNoForeignNumber(texte, b.chiffres)).toBe(true);
  });
});

describe('articles : dividende_annonce et détecteurs', () => {
  const cours: CoursRow = {
    code: 'FTSC', date_marche: SEANCE_FTSC, cours_jour: 1590, cours_precedent: 1700, variation_pct: -6.47,
    volume: 1, valeur_echangee: 1, cours_haut_52s: null, cours_bas_52s: null,
  };
  const ctx: Contexte = { aujourdhui: '2026-11-20', derniereSeance: SEANCE_FTSC, noms: { FTSC: 'FILTISAC CI' }, cours: { FTSC: cours }, historique: {} };

  it('un dividende ancien fraîchement INSCRIT (Bulletin officiel) n’est pas annoncé comme à venir', () => {
    const faits = detecter(ctx, [
      { code: 'FTSC', exercice: 2024, montant: 1726.56, ex_date: null, payment_date: '2025-09-30', source: 'brvm-boc', created_at: '2026-11-19T09:00:00Z' },
    ], []);
    expect(faits.filter((f) => f.type === 'dividende_annonce')).toEqual([]);
  });

  it('rendement du fait à null au-delà de 25 % ; l’article d’annonce ne l’écrit pas', () => {
    const [f] = detecter(ctx, [
      { code: 'FTSC', exercice: 2025, montant: 500, ex_date: null, payment_date: '2026-12-15', source: 'brvm-calendrier', created_at: '2026-11-19T09:00:00Z' },
    ], []).filter((x) => x.type === 'dividende_annonce');
    expect(f!.donnees.rendement).toBeNull();
    const b = rediger(f!, ctx.noms, null);
    expect([b.chapo, ...b.sections.map((s) => s.texte)].join(' ')).not.toMatch(/rendement de/);
  });

  it('un dividende annoncé hors historique (> 3 × la médiane) n’est pas rapporté au cours', () => {
    const f: Fait = {
      type: 'dividende_annonce', code: 'FTSC', cle: '2025', dateFait: '2026-11-19',
      donnees: { montant: 300, exercice: 2025, ex_date: null, payment_date: '2026-12-15', cours: 1590, date_cours: SEANCE_FTSC, rendement: 18.87, source: 'brvm-calendrier' },
    };
    const reperes: Reperes = { bpa: null, exercice_bpa: null, dividendes: [{ exercice: 2023, montant: 79.2 }, { exercice: 2022, montant: 70 }], liquidite_classe: null, liquidite_score: null, signal: null };
    const b = rediger(f, ctx.noms, reperes);
    expect([b.chapo, ...b.sections.map((s) => s.texte)].join(' ')).not.toMatch(/rendement de|au cours du jour/);
  });
});
