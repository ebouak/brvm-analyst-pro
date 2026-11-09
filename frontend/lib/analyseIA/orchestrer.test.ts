import { describe, it, expect, vi } from 'vitest';
import { repondreAnalyse, texteSansChiffreFiche, type DepsAnalyse, type ResultatLlmAnalyse } from './orchestrer';
import { promptSysteme } from './prompt';
import type { EvenementFlux } from './types';

const valeur = { code: 'STAC', nom: 'SETAO CI', exerciceComptes: 2025 };

function deps(over: Partial<DepsAnalyse> = {}) {
  const evenements: EvenementFlux[] = [];
  const journal: string[] = [];
  const d: DepsAnalyse = {
    classer: async () => ({ voie: 'ia' }),
    repondreJev: async () => null,
    llm: async () => ({ texte: null, retours: [], sources: [] }),
    emettre: (e) => evenements.push(e),
    journal: (e) => journal.push(e),
    aujourdhui: '8 novembre 2026',
    ...over,
  };
  const texte = () => evenements.filter((e) => e.type === 'texte').map((e) => (e as { texte: string }).texte).join('');
  const meta = () => (evenements.find((e) => e.type === 'meta') as Extract<EvenementFlux, { type: 'meta' }> | undefined)?.meta;
  return { d, evenements, journal, texte, meta };
}

const llmFixe = (...reponses: ResultatLlmAnalyse[]) => {
  const f = vi.fn();
  for (const r of reponses) f.mockResolvedValueOnce(r);
  return f;
};

describe('orchestration', () => {
  it('Jev sûr ⇒ gabarit, provenance jev, aucun appel au LLM', async () => {
    const llm = vi.fn();
    const t = deps({
      classer: async () => ({ voie: 'jev', intention: 'dividendes' }),
      repondreJev: async () => ({ texte: 'Dividendes de SETAO CI…', sources: [{ libelle: 'Dividendes', date: '2026-08-04' }] }),
      llm,
    });
    expect(await repondreAnalyse({ question: 'Comment ont évolué les dividendes ?', historique: [], valeur }, t.d)).toBe('jev');
    expect(llm).not.toHaveBeenCalled();
    expect(t.texte()).toBe('Dividendes de SETAO CI…');
    expect(t.meta()).toMatchObject({ provenance: 'jev', sources: [{ libelle: 'Dividendes', date: '2026-08-04' }] });
    expect(t.meta()!.relances).toHaveLength(3);
    expect(t.meta()!.relances).not.toContain('Comment ont évolué les dividendes ?');
    expect(t.evenements[0]).toEqual({ type: 'etape', libelle: 'Recherche des données…' });
  });

  it('Jev en panne ⇒ IA', async () => {
    const t = deps({
      classer: async () => {
        throw new Error('jev_http_500');
      },
      llm: llmFixe({ texte: 'Le cours a clôturé à 1 250 FCFA.', retours: ['{"cours":1250}'], sources: [{ libelle: 'Cotations', date: '2026-11-06' }] }),
    });
    expect(await repondreAnalyse({ question: 'Pourquoi ?', historique: [], valeur }, t.d)).toBe('ia');
    expect(t.meta()!.provenance).toBe('ia');
  });

  it('gabarit sans réponse ⇒ IA', async () => {
    const t = deps({
      classer: async () => ({ voie: 'jev', intention: 'comptes' }),
      llm: llmFixe({ texte: 'Les comptes ne sont pas disponibles.', retours: [], sources: [] }),
    });
    expect(await repondreAnalyse({ question: 'Résume les comptes', historique: [], valeur }, t.d)).toBe('ia');
    expect(t.journal).toContain('jev_sans_reponse');
  });

  it('chiffre étranger ⇒ une réécriture acceptée', async () => {
    const llm = llmFixe(
      { texte: 'Le cours vaut 3 456 FCFA.', retours: ['{"cours":1250}'], sources: [{ libelle: 'Cotations', date: '2026-11-06' }] },
      { texte: 'Le cours vaut 1 250 FCFA.', retours: [], sources: [] },
    );
    const t = deps({ llm });
    await repondreAnalyse({ question: 'Le cours ?', historique: [], valeur }, t.d);
    expect(llm).toHaveBeenCalledTimes(2);
    expect(t.texte()).toBe('Le cours vaut 1 250 FCFA.');
    expect(t.journal).toContain('chiffre_etranger');
  });

  it('chiffre étranger deux fois ⇒ réponse sans chiffre', async () => {
    const t = deps({
      llm: llmFixe(
        { texte: 'Le cours vaut 3 456 FCFA.', retours: ['{"cours":1250}'], sources: [] },
        { texte: 'Le cours vaut 4 567 FCFA.', retours: [], sources: [] },
      ),
    });
    await repondreAnalyse({ question: 'Le cours ?', historique: [], valeur }, t.d);
    expect(t.texte()).toBe(texteSansChiffreFiche('STAC'));
    expect(t.meta()!.provenance).toBe('ia');
  });

  it('nombres de la conversation admis', async () => {
    const t = deps({ llm: llmFixe({ texte: 'Sur 90 jours, rien de plus.', retours: [], sources: [] }) });
    await repondreAnalyse({ question: 'Et sur 90 jours ?', historique: [], valeur }, t.d);
    expect(t.texte()).toBe('Sur 90 jours, rien de plus.');
  });

  it('LLM muet ⇒ erreur, aucun texte, aucun meta', async () => {
    const t = deps();
    expect(await repondreAnalyse({ question: 'Pourquoi ?', historique: [], valeur }, t.d)).toBe('echec');
    expect(t.texte()).toBe('');
    expect(t.meta()).toBeUndefined();
    expect(t.evenements.some((e) => e.type === 'erreur')).toBe(true);
  });

  it('données personnelles masquées avant le classement et le LLM', async () => {
    const classer = vi.fn(async (_q: string) => ({ voie: 'ia' }) as const);
    const llm = vi.fn(async () => ({ texte: 'ok', retours: [], sources: [] }));
    const t = deps({ classer, llm });
    await repondreAnalyse({ question: 'écrivez à moi@exemple.com', historique: [], valeur }, t.d);
    expect(classer.mock.calls[0]![0]).not.toContain('@exemple.com');
    expect(JSON.stringify(llm.mock.calls[0])).not.toContain('@exemple.com');
  });

  it('sources fusionnées', async () => {
    const t = deps({
      llm: llmFixe({
        texte: 'ok',
        retours: [],
        sources: [
          { libelle: 'Cotations', date: '2026-11-01' },
          { libelle: 'Cotations', date: '2026-11-06' },
        ],
      }),
    });
    await repondreAnalyse({ question: 'q', historique: [], valeur }, t.d);
    expect(t.meta()!.sources).toEqual([{ libelle: 'Cotations', date: '2026-11-06' }]);
  });
});

describe('consignes', () => {
  it('rappellent pas de conseil, chiffres des outils, non disponible, date', () => {
    const p = promptSysteme({ code: 'STAC', nom: 'SETAO CI' }, '8 novembre 2026');
    expect(p).toMatch(/Aucun conseil/);
    expect(p).toMatch(/retour d’outil/);
    expect(p).toMatch(/pas disponible/);
    expect(p).toMatch(/date des données/);
    expect(p).toContain('STAC (SETAO CI)');
  });
});
