import { describe, it, expect } from 'vitest';
import { rediger, avecFormatFr, CONSIGNE_FORMAT_FR } from '../src/llm/redacteur.js';

type Appel = { url: string; corps: Record<string, unknown> };

function faux(reponses: Record<string, { status: number; texte?: string; fin?: string }>) {
  const appels: Appel[] = [];
  const fetchFn = (async (url: string, init: { body: string }) => {
    appels.push({ url, corps: JSON.parse(init.body) });
    const cle = Object.keys(reponses).find((k) => url.includes(k))!;
    const r = reponses[cle]!;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => ({ choices: [{ message: { content: r.texte ?? '' }, finish_reason: r.fin ?? 'stop' }] }),
    };
  }) as unknown as typeof fetch;
  return { appels, fetchFn };
}

const toutesCles = async (f: string) => `cle-${f}`;

describe('rediger (scraper)', () => {
  it('DeepSeek répond : un seul appel', async () => {
    const { appels, fetchFn } = faux({ deepseek: { status: 200, texte: 'Bonjour' } });
    const r = await rediger([{ role: 'user', content: 'Q' }], toutesCles, {}, fetchFn);
    expect(r).toEqual({ texte: 'Bonjour', fournisseur: 'deepseek', modele: 'deepseek-chat' });
    expect(appels).toHaveLength(1);
  });

  it('DeepSeek à court de crédit (402) : Gemini prend le relais, réflexion bridée', async () => {
    const { appels, fetchFn } = faux({
      deepseek: { status: 402 },
      generativelanguage: { status: 200, texte: 'Relais' },
    });
    const r = await rediger([{ role: 'user', content: 'Q' }], toutesCles, {}, fetchFn);
    expect(r?.fournisseur).toBe('gemini');
    expect(appels[1]!.corps.reasoning_effort).toBe('low');
    expect(appels[0]!.corps.reasoning_effort).toBeUndefined();
  });

  it('une sortie refusée par le garde-fou passe au fournisseur suivant', async () => {
    const { fetchFn } = faux({
      deepseek: { status: 200, texte: 'Contient 999' },
      generativelanguage: { status: 200, texte: 'Propre' },
    });
    const refus: string[] = [];
    const r = await rediger([{ role: 'user', content: 'Q' }], toutesCles, {
      accepter: (t) => !t.includes('999'),
      journal: (e) => refus.push(`${e.fournisseur}:${e.raison}`),
    }, fetchFn);
    expect(r?.texte).toBe('Propre');
    expect(refus).toEqual(['deepseek:refusée par le garde-fou']);
  });

  it('une réponse tronquée (finish_reason length) n’est pas un texte', async () => {
    const { fetchFn } = faux({
      deepseek: { status: 200, texte: 'Phrase coupée au mil', fin: 'length' },
      generativelanguage: { status: 200, texte: 'Complète.' },
    });
    expect((await rediger([{ role: 'user', content: 'Q' }], toutesCles, {}, fetchFn))?.texte).toBe('Complète.');
  });

  it('fournisseur sans clé sauté ; aucun → null', async () => {
    const { appels, fetchFn } = faux({ x: { status: 200, texte: 'jamais' } });
    expect(await rediger([{ role: 'user', content: 'Q' }], async () => null, {}, fetchFn)).toBeNull();
    expect(appels).toHaveLength(0);
  });

  it('restreint la cascade aux fournisseurs demandés', async () => {
    const { appels, fetchFn } = faux({ deepseek: { status: 500 }, 'x.ai': { status: 200, texte: 'grok' } });
    const r = await rediger([{ role: 'user', content: 'Q' }], toutesCles, { fournisseurs: ['deepseek'] }, fetchFn);
    expect(r).toBeNull();
    expect(appels).toHaveLength(1);
  });

  it('consigne de format français ajoutée au message système', () => {
    expect(avecFormatFr([{ role: 'system', content: 'S' }])[0]!.content).toBe(`S\n\n${CONSIGNE_FORMAT_FR}`);
  });
});
