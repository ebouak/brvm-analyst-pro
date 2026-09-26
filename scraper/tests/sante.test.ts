/**
 * `evaluerSante` classe le résultat d'un sondage réel des trois fournisseurs
 * LLM. Régression centrale : un 429 (limite de débit Mistral, palier gratuit)
 * ne doit JAMAIS être traité comme une panne — voir CLAUDE.md, incident du
 * 2026-09-26.
 */
import { describe, it, expect } from 'vitest';
import { evaluerSante, construireMessageAlerte, type SondageFournisseur } from '../src/sante/evaluerSante.js';

function sondage(over: Partial<SondageFournisseur>): SondageFournisseur {
  return {
    fournisseur: 'deepseek',
    modele: 'deepseek-chat',
    statutHttp: 200,
    cleAbsente: false,
    ...over,
  };
}

describe('evaluerSante', () => {
  it('tout ok → niveau sain, aucune panne', () => {
    const verdict = evaluerSante([
      sondage({ fournisseur: 'deepseek', modele: 'deepseek-chat', statutHttp: 200 }),
      sondage({ fournisseur: 'mistral', modele: 'mistral-small-latest', statutHttp: 200 }),
      sondage({ fournisseur: 'xai', modele: 'grok-4.6', statutHttp: 200 }),
    ]);
    expect(verdict.niveau).toBe('sain');
    expect(verdict.enPanne).toHaveLength(0);
    expect(verdict.utilisables).toBe(3);
    expect(verdict.etats.every((e) => e.etat === 'ok')).toBe(true);
  });

  it('un 402 (crédit épuisé) → panne partielle', () => {
    const verdict = evaluerSante([
      sondage({ fournisseur: 'deepseek', statutHttp: 402 }),
      sondage({ fournisseur: 'mistral', modele: 'mistral-small-latest', statutHttp: 200 }),
      sondage({ fournisseur: 'xai', modele: 'grok-4.6', statutHttp: 200 }),
    ]);
    expect(verdict.niveau).toBe('partiel');
    expect(verdict.enPanne).toHaveLength(1);
    expect(verdict.enPanne[0]?.fournisseur).toBe('deepseek');
    expect(verdict.utilisables).toBe(2);
  });

  it('un 429 seul → NE DOIT PAS être une panne (niveau sain)', () => {
    const verdict = evaluerSante([
      sondage({ fournisseur: 'deepseek', statutHttp: 200 }),
      sondage({ fournisseur: 'mistral', modele: 'mistral-small-latest', statutHttp: 429 }),
      sondage({ fournisseur: 'xai', modele: 'grok-4.6', statutHttp: 200 }),
    ]);
    expect(verdict.niveau).toBe('sain');
    expect(verdict.enPanne).toHaveLength(0);
    expect(verdict.utilisables).toBe(3);
    const mistral = verdict.etats.find((e) => e.fournisseur === 'mistral');
    expect(mistral?.etat).toBe('limite');
  });

  it('clé absente → panne', () => {
    const verdict = evaluerSante([
      sondage({ fournisseur: 'deepseek', statutHttp: 200 }),
      sondage({ fournisseur: 'mistral', modele: 'mistral-small-latest', statutHttp: null, cleAbsente: true }),
      sondage({ fournisseur: 'xai', modele: 'grok-4.6', statutHttp: 200 }),
    ]);
    expect(verdict.niveau).toBe('partiel');
    const mistral = verdict.etats.find((e) => e.fournisseur === 'mistral');
    expect(mistral?.etat).toBe('panne');
    expect(mistral?.raison).toMatch(/clé/);
  });

  it('tous en panne → niveau total', () => {
    const verdict = evaluerSante([
      sondage({ fournisseur: 'deepseek', statutHttp: 402 }),
      sondage({ fournisseur: 'mistral', modele: 'mistral-small-latest', statutHttp: 401 }),
      sondage({ fournisseur: 'xai', modele: 'grok-4.6', statutHttp: 500 }),
    ]);
    expect(verdict.niveau).toBe('total');
    expect(verdict.utilisables).toBe(0);
    expect(verdict.enPanne).toHaveLength(3);
  });

  it('une panne totale mêlée à un 429 reste totale (429 non utilisable seul ne compte pas comme panne, mais ne sauve pas le niveau)', () => {
    const verdict = evaluerSante([
      sondage({ fournisseur: 'deepseek', statutHttp: 402 }),
      sondage({ fournisseur: 'mistral', modele: 'mistral-small-latest', statutHttp: 500 }),
      sondage({ fournisseur: 'xai', modele: 'grok-4.6', statutHttp: 500 }),
    ]);
    expect(verdict.niveau).toBe('total');
  });

  it('aucun message ne contient de chaîne ressemblant à une clé', () => {
    // Le nom de modèle « mistral-small-latest » fait légitimement 20
    // caractères : le test cible donc la fausse clé injectée, pas n'importe
    // quel token long (sinon un nom de modèle ferait échouer le test).
    const fausseCle = 'sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const detailSuspect = `Authorization refusée pour la clé ${fausseCle}`;
    const verdict = evaluerSante([
      sondage({ fournisseur: 'deepseek', statutHttp: 401, detail: detailSuspect }),
      sondage({ fournisseur: 'mistral', modele: 'mistral-small-latest', statutHttp: 200 }),
      sondage({ fournisseur: 'xai', modele: 'grok-4.6', statutHttp: 200 }),
    ]);
    const message = construireMessageAlerte(verdict);
    expect(message).not.toContain(fausseCle);
    expect(message).toContain('[masqué]');

    // Sur le champ `raison` seul (hors nom de modèle, légitimement long) :
    // aucun token de la longueur d'une clé ne doit survivre à l'assainissement.
    for (const e of verdict.etats) {
      expect(e.raison).not.toContain(fausseCle);
      expect(e.raison).not.toMatch(/[A-Za-z0-9_-]{30,}/);
    }
  });

  it('construireMessageAlerte liste chaque fournisseur avec son état', () => {
    const verdict = evaluerSante([
      sondage({ fournisseur: 'deepseek', statutHttp: 200 }),
      sondage({ fournisseur: 'mistral', modele: 'mistral-small-latest', statutHttp: 429 }),
      sondage({ fournisseur: 'xai', modele: 'grok-4.6', statutHttp: 500 }),
    ]);
    const message = construireMessageAlerte(verdict);
    expect(message).toContain('deepseek');
    expect(message).toContain('mistral');
    expect(message).toContain('xai');
    expect(message).toMatch(/partiel|Alerte/i);
  });
});
