import { describe, it, expect } from 'vitest';
import { WORKFLOWS_AUTORISES, resoudreWorkflow } from './githubDispatch';

describe('githubDispatch whitelist', () => {
  it('contient des workflows uniques sans doublon d’alias ni de fichier', () => {
    const aliases = WORKFLOWS_AUTORISES.map((w) => w.alias);
    const fichiers = WORKFLOWS_AUTORISES.map((w) => w.fichier);
    expect(new Set(aliases).size).toBe(aliases.length);
    expect(new Set(fichiers).size).toBe(fichiers.length);
  });

  it('résout par alias ou nom de fichier et rejette les workflows inconnus', () => {
    expect(resoudreWorkflow('daily-brvm')?.fichier).toBe('daily-brvm.yml');
    expect(resoudreWorkflow('SCORE.YML')?.alias).toBe('score');
    expect(resoudreWorkflow('ops-controle')?.fichier).toBe('ops-controle.yml');
    expect(resoudreWorkflow('deploy-frontend.yml')).toBeNull();
    expect(resoudreWorkflow('../secret')).toBeNull();
  });
});
