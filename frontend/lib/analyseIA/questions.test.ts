import { describe, it, expect } from 'vitest';
import { questionsProposees, relancesSuivantes, normaliserQuestion } from './questions';

const v = { code: 'STAC', nom: 'SETAO CI', exerciceComptes: 2025 };

describe('questions proposées', () => {
  it('construites avec le code et le nom, constats seulement', () => {
    const q = questionsProposees(v);
    expect(q.length).toBeGreaterThanOrEqual(6);
    expect(q.some((x) => x.includes('STAC'))).toBe(true);
    expect(q.some((x) => x.includes('SETAO CI'))).toBe(true);
    expect(q).toContain('Résume les comptes 2025 de SETAO CI');
    for (const x of q) expect(x).not.toMatch(/faut-il|acheter|vendre|conserver/i);
  });
  it('sans exercice connu, la question des comptes ne cite pas d’année', () => {
    const q = questionsProposees({ code: 'STAC', nom: 'SETAO CI', exerciceComptes: null });
    expect(q).toContain('Résume les derniers comptes de SETAO CI');
  });
  it('sans nom, le code le remplace', () => {
    expect(questionsProposees({ code: 'STAC', nom: null, exerciceComptes: null }).join(' ')).not.toMatch(/null|undefined/);
  });
});

describe('relances', () => {
  it('trois questions, jamais une déjà posée', () => {
    const toutes = questionsProposees(v);
    const r = relancesSuivantes(v, [toutes[0]!, toutes[1]!]);
    expect(r).toHaveLength(3);
    expect(r).not.toContain(toutes[0]);
    expect(r).not.toContain(toutes[1]);
  });
  it('ignore casse, accents et ponctuation pour reconnaître une question posée', () => {
    const toutes = questionsProposees(v);
    const r = relancesSuivantes(v, [toutes[2]!.toUpperCase().replace(/ \?$/, '')]);
    expect(r).not.toContain(toutes[2]);
  });
  it('déterministe', () => {
    expect(relancesSuivantes(v, ['x'])).toEqual(relancesSuivantes(v, ['x']));
  });
  it('commence après la dernière question proposée posée', () => {
    const toutes = questionsProposees(v);
    expect(relancesSuivantes(v, [toutes[3]!])[0]).toBe(toutes[4]);
  });
  it('moins de trois disponibles : rend ce qui reste', () => {
    const toutes = questionsProposees(v);
    expect(relancesSuivantes(v, toutes.slice(0, toutes.length - 2))).toHaveLength(2);
  });
  it('normaliser', () => {
    expect(normaliserQuestion('  Qu’est-ce QUI a affecté ?')).toBe(normaliserQuestion("qu'est-ce qui a affecte"));
  });
});
