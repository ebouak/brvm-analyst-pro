import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { courseContentSchema, type CourseContent } from '../../types';

/**
 * Cours « Les introductions en bourse (IPO) à la BRVM » (2026-11-26), qui
 * remplace le cours Dangote (dépublié par la migration 0275).
 * Règle éditoriale : aucun site tiers cité ; faits de la BRVM, de la BVMAC, du
 * gouvernement du Bénin et des documents d'offre, le reste en calcul annoncé.
 */
const SLUG = 'introduction-en-bourse-ipo-brvm';
const brut = JSON.parse(readFileSync(join(__dirname, `${SLUG}.json`), 'utf8')) as unknown;
const cours: CourseContent = courseContentSchema.parse(brut);
const texte = JSON.stringify(cours);
const colonnes = JSON.parse(readFileSync(join(__dirname, 'colonnes.json'), 'utf8')) as Record<string, { resume: string }>;
const migration = readFileSync(
  join(__dirname, '../../../../../supabase/migrations/0275_academy_cours_ipo_brvm.sql'),
  'utf8',
);

describe('schéma et structure', () => {
  it('le contenu passe le schéma servi en production', () => {
    const r = courseContentSchema.safeParse(brut);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`)).toEqual([]);
  });
  it('sept leçons, chacune avec un quiz', () => {
    expect(cours.lessons).toHaveLength(7);
    for (const l of cours.lessons) expect(l.quiz?.length ?? 0, l.titre).toBeGreaterThanOrEqual(3);
  });
  it('résumé de carte court', () => {
    const r = colonnes[SLUG]!.resume;
    expect(r.length).toBeGreaterThan(40);
    expect(r.length).toBeLessThanOrEqual(280);
  });
  it('les liens « À lire aussi » visent des cours existants dans le dépôt', () => {
    for (const l of cours.relatedLinks) expect(() => readFileSync(join(__dirname, `${l.slug}.json`))).not.toThrow();
  });
});

describe('conformité', () => {
  it('chaque leçon porte un avertissement', () => {
    for (const l of cours.lessons) expect(l.avertissement, l.titre).toMatch(/pas un conseil en investissement/);
  });
  it('« conseil » n’apparaît que dans l’avertissement', () => {
    expect(texte.replace(/n’est pas un conseil en investissement/g, '')).not.toMatch(/conseil/i);
  });
  it('aucun signal, aucune conviction, aucune incitation, aucun emoji', () => {
    expect(texte).not.toMatch(/\bsignaux?\b/i);
    expect(texte).not.toMatch(/conviction|surveiller\b|achetez|vendez|recommand/i);
    expect(texte).not.toMatch(/[\u{1F300}-\u{1FAFF}①-⓿]/u);
  });
  it('aucun site tiers cité (choix éditorial de l’exploitant)', () => {
    expect(texte).not.toMatch(
      /sika|richbourse|daba|african markets|financial afrik|allafrica|reuters|ecofin|forbes|jeune afrique|abidjan\.net|stockanalysis|notreafrik|africtelegraph|gabon media/i,
    );
  });
  it('pas de partie d’actualité périssable (OPV Coris)', () => {
    expect(texte).not.toMatch(/coris/i);
  });
  it('quiz : bonne réponse dans les options, longueur non révélatrice (< 40 %)', () => {
    let total = 0;
    let plusLongue = 0;
    for (const l of cours.lessons) {
      for (const q of l.quiz ?? []) {
        expect(q.correct).toBeLessThan(q.options.length);
        total += 1;
        const autres = q.options.filter((_, i) => i !== q.correct).map((o) => o.length);
        if (q.options[q.correct]!.length > Math.max(...autres)) plusLongue += 1;
      }
    }
    expect(total).toBe(27);
    expect(plusLongue / total).toBeLessThan(0.4);
  });
});

describe('faits et calculs', () => {
  it('Bridge Bank : 352,13 − 140,98 − 100,45 − 43,2 = 67,5 Md FCFA, soit 10 millions d’actions à 6 750', () => {
    const bridge = 352.13 - 140.982 - 100.45 - 43.2;
    expect(bridge).toBeCloseTo(67.5, 1);
    expect((67.5e9 / 6750)).toBe(10_000_000);
    expect(texte).toMatch(/67,5 Md FCFA \(calcul\)/);
  });
  it('Orange CI : 9 500 → 10 210 FCFA = +7,47 %, sous la limite de 7,5 %', () => {
    expect((10210 / 9500 - 1) * 100).toBeCloseTo(7.47, 2);
    expect(9500 * 1.075).toBeGreaterThan(10210);
  });
  it('BGFI : 125,88 Md ÷ 80 000 = 1 573 536 actions offertes ; 566 561 créées = 36 %', () => {
    expect(125_882_880_000 / 80_000).toBe(1_573_536);
    expect((566_561 / 1_573_536) * 100).toBeCloseTo(36, 0);
    expect((566_561 * 80_000) / 1e9).toBeCloseTo(45.32, 2);
    expect((566_561 / 14_728_385) * 100).toBeCloseTo(3.85, 2);
    expect((82_000 / 80_000 - 1) * 100).toBeCloseTo(2.5, 5);
  });
  it('Banque Alpha (fictive) : valorisation, PER, P/B, dividende', () => {
    expect(8000 * 40e6).toBe(320e9);
    expect(320 / 25).toBeCloseTo(12.8, 10);
    expect(25e9 / 40e6).toBe(625);
    expect(320 / 125).toBeCloseTo(12.8 * 0.2, 10);
    expect(12.5e9 / 40e6).toBe(312.5);
    expect(312.5 * 0.88).toBe(275);
    expect((312.5 / 8000) * 100).toBeCloseTo(3.9, 1);
    expect((275 / 8000) * 100).toBeCloseTo(3.4, 1);
    expect(8000 * 0.8).toBe(6400);
  });
  it('exercices du quiz : PER 20 contre 10, P/B 1,8, 50 actions servies sur 100', () => {
    expect(5000 / 250).toBe(20);
    expect(40000 / 4000).toBe(10);
    expect(12 * 0.15).toBeCloseTo(1.8, 10);
    expect(100 / 2).toBe(50);
    expect(800_000 / 2).toBe(400_000);
  });
  it('les quatre prix d’offre figurent dans la leçon 6, avec les cours réels lus en base', () => {
    const l6 = JSON.stringify(cours.lessons[5]);
    for (const p of ['9 500 FCFA', '4 800 FCFA', '5 250 FCFA', '6 750 FCFA']) expect(l6).toContain(p);
    const s = cours.lessons[5]!.sections.find((x) => x.donnees_reelles);
    expect(s?.donnees_reelles).toEqual({ vue: 'cours', codes: ['ORAC', 'LNBB', 'BICB', 'BBGC'] });
  });
});

describe('migration 0275', () => {
  it('insère exactement le contenu du fichier source', () => {
    const m = migration.match(/\$wb\$(\{"titre".*?)\$wb\$::jsonb/s);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1]!)).toEqual(brut);
  });
  it('publie le nouveau cours et dépublie le cours Dangote sans le supprimer', () => {
    expect(migration).toMatch(/on conflict \(slug\) do nothing/);
    expect(migration).toMatch(/set published = false[\s\S]*ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang/);
    expect(migration).not.toMatch(/delete from/i);
  });
});
