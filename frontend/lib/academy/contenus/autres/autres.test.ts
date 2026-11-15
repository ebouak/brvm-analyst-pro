import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { courseContentSchema, type CourseContent } from '../../types';

/**
 * Cours hors des quatre niveaux (générés par IA en juin-juillet 2026, relus le
 * 2026-11-15). Les JSON de ce dossier sont la source de la migration 0241.
 * Chaque test « relecture » échouait sur l'ancien texte (sauvegardé dans
 * docs/academy/sauvegardes/2026-11-15-academy-cours-hors-niveaux-avant.json).
 */
const SLUGS = [
  'comprendre-le-per-et-la-valorisation-a-la-brvm',
  'etudes-de-cas-reels-brvm',
  'ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang',
  'suivi-dangote-brvm-ipo',
] as const;
type Slug = (typeof SLUGS)[number];

const brut = (slug: string): unknown => JSON.parse(readFileSync(join(__dirname, `${slug}.json`), 'utf8'));
const lire = (slug: Slug): CourseContent => courseContentSchema.parse(brut(slug));
const texte = (slug: Slug) => JSON.stringify(lire(slug));
const sauvegarde = JSON.parse(
  readFileSync(join(__dirname, '../../../../../docs/academy/sauvegardes/2026-11-15-academy-cours-hors-niveaux-avant.json'), 'utf8'),
) as { cours: Record<string, { titre: string; content: { lessons: unknown[] } }> };
const colonnes = JSON.parse(readFileSync(join(__dirname, 'colonnes.json'), 'utf8')) as Record<string, { resume: string }>;

describe('schéma servi en production', () => {
  for (const slug of SLUGS) {
    it(slug, () => {
      const r = courseContentSchema.safeParse(brut(slug));
      expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`)).toEqual([]);
    });
  }
});

describe('la progression reste valable (indexée par position de leçon)', () => {
  for (const slug of SLUGS) {
    it(`${slug} garde son nombre de leçons`, () => {
      expect(lire(slug).lessons.length).toBe(sauvegarde.cours[slug]!.content.lessons.length);
    });
  }
  it('chaque cours a un résumé de colonne court', () => {
    for (const slug of SLUGS) {
      expect(colonnes[slug]!.resume.length).toBeGreaterThan(40);
      expect(colonnes[slug]!.resume.length).toBeLessThanOrEqual(280);
    }
  });
});

describe('conformité', () => {
  it('chaque leçon porte un avertissement', () => {
    for (const slug of SLUGS) {
      for (const l of lire(slug).lessons) expect(l.avertissement, `${slug} · ${l.titre}`).toMatch(/pas un conseil en investissement/);
    }
  });
  it('« conseil » n’apparaît que dans l’avertissement', () => {
    for (const slug of SLUGS) {
      const sans = texte(slug).replace(/n’est pas un conseil en investissement/g, '');
      expect(sans, slug).not.toMatch(/conseil/i);
    }
  });
  it('aucun signal, aucune conviction, aucune incitation', () => {
    for (const slug of SLUGS) {
      const t = texte(slug);
      expect(t, slug).not.toMatch(/\bsignaux?\b/i);
      expect(t, slug).not.toMatch(/conviction|surveiller\b|achetez|vendez|recommand(?!ations\.)/i);
      expect(t, slug).not.toMatch(/[\u{1F300}-\u{1FAFF}①-⓿]/u);
    }
  });
  it('quiz : bonne réponse dans les options, longueur non révélatrice (< 40 %)', () => {
    let total = 0;
    let plusLongue = 0;
    for (const slug of SLUGS) {
      for (const l of lire(slug).lessons) {
        const q = l.qcm;
        if (!q) continue;
        expect(q.correct).toBeLessThan(q.options.length);
        total += 1;
        const autres = q.options.filter((_, i) => i !== q.correct).map((o) => o.length);
        if (q.options[q.correct]!.length > Math.max(...autres)) plusLongue += 1;
      }
    }
    expect(total).toBe(14);
    expect(plusLongue / total).toBeLessThan(0.4);
  });
});

describe('cohérence avec les niveaux 1 à 4', () => {
  it('régulateur et référentiel à jour : AMF-UMOA, SYSCOHADA révisé', () => {
    const t = texte('comprendre-le-per-et-la-valorisation-a-la-brvm');
    expect(t).not.toMatch(/encadrée par le CREPMF|SYSCOA[^H]/);
    expect(t).toMatch(/AMF-UMOA/);
    expect(t).toMatch(/SYSCOHADA révisé/);
  });
  it('repères de PER du niveau 2 (moins de 8, de 8 à 20, plus de 20)', () => {
    expect(texte('comprendre-le-per-et-la-valorisation-a-la-brvm')).toMatch(/moins de 8, de 8 à 20, plus de 20/);
    expect(texte('comprendre-le-per-et-la-valorisation-a-la-brvm')).not.toMatch(/10 à 15 est souvent considéré comme raisonnable/);
  });
});

describe('PER et valorisation : relecture', () => {
  const c = lire('comprendre-le-per-et-la-valorisation-a-la-brvm');
  it('le quiz du PEG donne la bonne réponse (18 ÷ 15 = 1,2)', () => {
    const q = c.lessons[2]!.qcm!;
    expect(q.options[q.correct]).toBe('1,2');
    expect(18 / 15).toBeCloseTo(1.2, 10);
    expect(q.explication).not.toMatch(/Je corrige|Erreur dans le QCM/);
  });
  it('aucun exemple fictif n’est présenté comme un « cas réel »', () => {
    for (const l of c.lessons) {
      for (const s of l.sections) {
        expect(s.titre).not.toMatch(/Cas réel/);
        expect(s.reel).toBe(false);
      }
      expect(l.chart?.reel ?? false).toBe(false);
    }
  });
  it('plus de portefeuille type ni d’achat suggéré', () => {
    const t = JSON.stringify(c);
    expect(t).not.toMatch(/portefeuille type|pourrait acheter|vendre celles/);
  });
  it('les PEG des exemples sont justes', () => {
    expect(15 / 20).toBe(0.75);
    expect(20 / 25).toBe(0.8);
    expect(10 / 5).toBe(2);
  });
});

describe('Études de cas : chiffres recalculés', () => {
  const c = lire('etudes-de-cas-reels-brvm');
  const taux = (a: number, b: number, ans: number) => (Math.pow(b / a, 1 / ans) - 1) * 100;
  it('Sonatel : +13,1 %/an (résultat), +9,6 %/an (chiffre d’affaires)', () => {
    const v = c.lessons[0]!.chart!.valeurs;
    expect(taux(v[0]!, v[4]!, 4)).toBeCloseTo(13.1, 0);
    expect(taux(1334.874, 1923.122, 4)).toBeCloseTo(9.6, 1);
    expect(JSON.stringify(c.lessons[0])).toMatch(/\+9,6 % par an/);
  });
  it('Sonatel : BPA et dividende après le fractionnement par 10 du 26/10/2026', () => {
    const t = JSON.stringify(c.lessons[0]);
    expect(t).toMatch(/252,5 puis 413,6 FCFA/);
    expect(t).toMatch(/140 FCFA/);
    expect(t).not.toMatch(/1 400 → 1 740|BPA : 2 524,59/);
  });
  it('Palmci : quatre baisses consécutives sur 2021-2025, environ −22 %/an, divisé par 2,7 depuis 2022', () => {
    const v = c.lessons[2]!.chart!.valeurs;
    expect(v).toHaveLength(5);
    for (let i = 1; i < v.length; i++) expect(v[i]!).toBeLessThan(v[i - 1]!);
    expect(taux(42.473, 15.509, 4)).toBeCloseTo(-22, 0);
    expect(41.693 / 15.509).toBeCloseTo(2.7, 1);
  });
  it('BOA Niger : −92 % en un an', () => {
    expect((0.409 / 5.002 - 1) * 100).toBeCloseTo(-92, 0);
  });
  it('aucun ratio de marché figé (PER, rendement du jour) ni taux faux', () => {
    const t = JSON.stringify(c);
    expect(t).not.toMatch(/7 à 8 fois|≈ 8,6|5,8 %|~274|dépasse 500|−49 %/);
    expect(t).not.toMatch(/décote réelle/i);
  });
  it('les exemples de calcul de PER sont justes', () => {
    expect(340 / 3.37).toBeGreaterThan(100);
    expect(1000 / 3.37).toBeCloseTo(297, 0);
    expect(2000 / 19.68).toBeGreaterThan(100);
  });
});

describe('Dangote : faits vérifiés au 15 novembre 2026', () => {
  const A = texte('ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang');
  const B = texte('suivi-dangote-brvm-ipo');
  it('l’offre publique est nigériane, pas une introduction à la BRVM', () => {
    for (const t of [A, B]) {
      expect(t).toMatch(/Nigerian Exchange/);
      expect(t).toMatch(/15 novembre 2026/);
      expect(t).not.toMatch(/Dangote à la BRVM \?/);
    }
  });
  it('le statut périmé de juin 2026 n’est plus présenté comme actuel', () => {
    for (const t of [A, B]) {
      expect(t).not.toMatch(/AUCUNE offre publique approuvée|Statut actuel : projet en préparation|Aucun titre investissable/);
    }
  });
  it('les chiffres non vérifiés ont disparu', () => {
    for (const t of [A, B]) {
      expect(t).not.toMatch(/198 FCFA|6,4 Md\$|Stanbic|dividendes en dollars|Premium Times|Dabafinance/);
    }
  });
  it('arithmétique de l’offre : 4,1 milliards × 525 nairas ≈ 2 150 milliards', () => {
    expect(4.1e9 * 525).toBe(2.1525e12);
    expect(3e9 * 0.35).toBeCloseTo(1.05e9, 0);
    expect(1e6 * 0.35).toBe(350_000);
  });
  it('les couvertures trompeuses sont retirées', () => {
    expect(lire('ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang').coverUrl ?? null).toBeNull();
    expect(lire('comprendre-le-per-et-la-valorisation-a-la-brvm').coverUrl ?? null).toBeNull();
  });
});

describe('migration 0241 synchronisée avec les JSON', () => {
  const sql = readFileSync(join(__dirname, '../../../../../supabase/migrations/0241_academy_cours_hors_niveaux_relus.sql'), 'utf8');
  for (const slug of SLUGS) {
    it(`${slug} : contenu identique et garde du nombre de leçons`, () => {
      // Les photos (clé `image`) sont remplacées ensuite par 0244 : elles sont
      // comparées hors de cette migration (photos.test.ts).
      const sansImages = (c: unknown) => {
        const copie = JSON.parse(JSON.stringify(c)) as { lessons: Record<string, unknown>[] };
        for (const l of copie.lessons) delete l.image;
        return copie;
      };
      const blocs = [...sql.matchAll(/\$wb\$(\{"titre".*?\})\$wb\$/g)]
        .map((m) => JSON.parse(m[1]!) as { titre: string; lessons: unknown[] })
        .filter((c) => c.titre === (brut(slug) as { titre: string }).titre);
      expect(blocs).toHaveLength(2);
      for (const b of blocs) expect(sansImages(b)).toEqual(sansImages(brut(slug)));
      const n = sauvegarde.cours[slug]!.content.lessons.length;
      expect(sql).toContain(`jsonb_array_length(content->'lessons') = ${n}`);
      expect(sql).toContain(colonnes[slug]!.resume);
    });
  }
  it('ne touche pas à la progression', () => {
    expect(sql).not.toMatch(/(update|from|into|truncate)\s+(public\.)?academy_progress/i);
  });
});
