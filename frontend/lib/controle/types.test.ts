import { describe, expect, it } from 'vitest';
import { niveauGlobal, signalInconnu, trierSignaux, type Signal } from './types';

const s = (niveau: Signal['niveau'], titre = 't'): Signal => ({ id: titre, domaine: 'envois', titre, niveau, detail: '' });

describe('contrat de la Tour de contrôle', () => {
  it('trie le plus grave d’abord : alerte, inconnu, attention, ok', () => {
    expect(trierSignaux([s('ok', 'a'), s('attention', 'b'), s('alerte', 'c'), s('inconnu', 'd')]).map((x) => x.niveau)).toEqual([
      'alerte', 'inconnu', 'attention', 'ok',
    ]);
  });

  it('jamais « ok » s’il reste une source illisible', () => {
    expect(niveauGlobal([s('ok'), s('inconnu'), s('ok')])).toBe('inconnu');
    expect(niveauGlobal([s('ok'), s('inconnu'), s('alerte')])).toBe('alerte');
  });

  it('aucun signal : inconnu, pas ok', () => {
    expect(niveauGlobal([])).toBe('inconnu');
  });

  it('tout sain : ok', () => {
    expect(niveauGlobal([s('ok'), s('ok')])).toBe('ok');
  });

  it('le signal inconnu dit qu’on ne peut rien conclure', () => {
    expect(signalInconnu('taches', 'x', 'Tâches', 'GitHub')).toMatchObject({ niveau: 'inconnu', detail: expect.stringMatching(/rien ne peut être conclu/) });
  });
});
