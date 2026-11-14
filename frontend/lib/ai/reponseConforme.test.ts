import { describe, expect, it } from 'vitest';
import { REPONSE_PRUDENTE } from './filtreRecommandation';
import { repondreSansRecommandation, type MessageConversation } from './reponseConforme';

const base: MessageConversation[] = [
  { role: 'system', content: 'consignes' },
  { role: 'user', content: 'Que penser de SNTS ?' },
];

function fauxGenerateur(sorties: Array<string | null>) {
  const appels: MessageConversation[][] = [];
  return {
    appels,
    generer: async (m: MessageConversation[]) => {
      appels.push(m);
      return sorties.shift() ?? null;
    },
  };
}

describe('repondreSansRecommandation', () => {
  it('laisse passer une réponse conforme sans second appel', async () => {
    const g = fauxGenerateur(['Le PER de SNTS est de 12,3x.']);
    const r = await repondreSansRecommandation(base, g.generer);
    expect(r).toEqual({ texte: 'Le PER de SNTS est de 12,3x.', issue: 'conforme', motifs: [] });
    expect(g.appels).toHaveLength(1);
  });

  it('réécrit une fois une réponse qui recommande', async () => {
    const g = fauxGenerateur(['Achetez SNTS, objectif de cours 30 000 FCFA.', 'Le PER de SNTS est de 12,3x.']);
    const r = await repondreSansRecommandation(base, g.generer);
    expect(r?.issue).toBe('reecrite');
    expect(r?.texte).toBe('Le PER de SNTS est de 12,3x.');
    expect(g.appels).toHaveLength(2);
    const second = g.appels[1];
    expect(second[second.length - 2]).toEqual({ role: 'assistant', content: 'Achetez SNTS, objectif de cours 30 000 FCFA.' });
    expect(second[second.length - 1].role).toBe('user');
  });

  it('retombe sur la réponse prudente si la réécriture recommande encore', async () => {
    const g = fauxGenerateur(['Achetez SNTS.', 'Je vous recommande de renforcer.']);
    const r = await repondreSansRecommandation(base, g.generer);
    expect(r?.issue).toBe('repli');
    expect(r?.texte).toBe(REPONSE_PRUDENTE);
  });

  it('retombe sur la réponse prudente si la réécriture échoue', async () => {
    const g = fauxGenerateur(['Stop-loss à 14 000 FCFA.', null]);
    const r = await repondreSansRecommandation(base, g.generer);
    expect(r?.issue).toBe('repli');
  });

  it('signale une panne (null) quand la première rédaction échoue', async () => {
    const g = fauxGenerateur([null]);
    expect(await repondreSansRecommandation(base, g.generer)).toBeNull();
  });
});
