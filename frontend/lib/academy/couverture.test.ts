import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { courseContentSchema, coverUrlSchema } from './types';

/**
 * Régression du 2026-11-25 : les couvertures SVG des Niveaux 2 à 4 (#403) sont des
 * chemins internes ; `z.string().url()` les rejetait, `loadCourseForLearning`
 * renvoyait null et ces trois niveaux répondaient 404 à tous leurs acheteurs.
 */
const COUVERTURES_NIVEAUX = [
  '/academy/cover-niveau-2-fondamental.svg',
  '/academy/cover-niveau-3-technique.svg',
  '/academy/cover-niveau-4-expert.svg',
];

describe('coverUrlSchema', () => {
  it('accepte un chemin interne et une URL https', () => {
    for (const v of [...COUVERTURES_NIVEAUX, 'https://cdn.exemple.org/couverture.png']) {
      expect(coverUrlSchema.safeParse(v).success, v).toBe(true);
    }
  });

  it('refuse une adresse externe déguisée, un autre schéma ou un texte libre', () => {
    for (const v of ['//evil.example/x.svg', '/\\evil.example', 'http://exemple.org/a.png', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'couverture.svg', '/academy/a b.svg', '']) {
      expect(coverUrlSchema.safeParse(v).success, v).toBe(false);
    }
  });
});

describe('contenu de cours avec couverture interne', () => {
  // Un vrai contenu publié (cours hors niveaux), muni de la couverture d'un niveau.
  const contenu = JSON.parse(
    readFileSync(join(__dirname, 'contenus/autres/comprendre-le-per-et-la-valorisation-a-la-brvm.json'), 'utf8'),
  ) as Record<string, unknown>;

  it.each(COUVERTURES_NIVEAUX)('passe le schéma complet avec %s', (cover) => {
    const r = courseContentSchema.safeParse({ ...contenu, coverUrl: cover });
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
  });

  it.each(COUVERTURES_NIVEAUX)('le fichier %s existe dans public/', (cover) => {
    expect(existsSync(join(__dirname, '../../public', cover))).toBe(true);
  });
});
