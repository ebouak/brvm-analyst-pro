import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lessonSchema } from '../types';

/**
 * Chaque fichier de leçon doit passer le schéma servi en production : une seule
 * leçon qui échoue fait renvoyer une 404 au cours ENTIER (`loadCourseForLearning`),
 * et les tests de contenu existants ne vérifiaient que des règles éditoriales.
 */
const racine = join(__dirname);
const fichiers = [
  ...readdirSync(racine).filter((f) => f.endsWith('.json')).map((f) => join(racine, f)),
  ...['niveau2', 'niveau3', 'niveau4'].flatMap((d) =>
    readdirSync(join(racine, d)).filter((f) => f.endsWith('.json')).map((f) => join(racine, d, f)),
  ),
];

describe('contenus de leçon contre le schéma', () => {
  it('trouve des fichiers', () => expect(fichiers.length).toBeGreaterThan(30));
  for (const f of fichiers) {
    it(f.slice(racine.length + 1), () => {
      const r = lessonSchema.safeParse(JSON.parse(readFileSync(f, 'utf8')));
      expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`)).toEqual([]);
    });
  }
});
