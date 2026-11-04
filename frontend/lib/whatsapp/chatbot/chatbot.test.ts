import { describe, it, expect, vi } from 'vitest';
import { repondreChatbot, type DepsChatbot, type Identite, type MessageLlm } from './repondre';
import { codeCite, estDemandeEffacer, PIED_PREMIER, texteQuota, TEXTE_PLAFOND_INCONNU, versWhatsapp } from './textes';

const INCONNU: Identite = { palier: 'inconnu', userId: null, perso: false };
const SOURCE = JSON.stringify({ code: 'SNTS', cours: 39200, variation_pct: -1.53 });

function deps(o: Partial<DepsChatbot> = {}): DepsChatbot & { envois: string[]; lignes: MessageLlm[][]; evenements: string[] } {
  const envois: string[] = [];
  const lignes: MessageLlm[][] = [];
  const evenements: string[] = [];
  return {
    envois,
    lignes,
    evenements,
    identifier: async () => INCONNU,
    quota: async () => true,
    budget: async () => 'ok',
    historique: async () => [],
    systeme: async () => 'SYSTEME',
    llm: async () => ({ texte: 'Sonatel cote 39 200 FCFA.', sources: [SOURCE] }),
    enregistrer: async (_id, l) => {
      lignes.push(l);
    },
    envoyer: async (t) => {
      envois.push(t);
      return true;
    },
    journal: (e) => evenements.push(e),
    ...o,
  };
}

describe('textes', () => {
  it('EFFACER et variantes', () => {
    for (const t of ['EFFACER', 'efface', 'Oublie', '/supprimer', 'effacer mes messages', 'Effacer l’historique.']) expect(estDemandeEffacer(t)).toBe(true);
    for (const t of ['effacer SNTS de ma liste', 'cours SNTS', 'oublie pas le dividende']) expect(estDemandeEffacer(t)).toBe(false);
  });
  it('quotas : aucun chiffre de quota, lien selon le palier', () => {
    for (const p of ['inconnu', 'lie', 'premium'] as const) expect(texteQuota(p).replace(/https?:\/\/\S+/g, '')).not.toMatch(/\d/);
    expect(texteQuota('inconnu')).toContain('/signup?next=');
    expect(texteQuota('lie')).toContain('/pricing');
  });
  it('mise en forme WhatsApp et code cité', () => {
    expect(versWhatsapp('**gras** et ## titre')).toBe('*gras* et ## titre');
    expect(codeCite(['{"x":1}', SOURCE])).toBe('SNTS');
    expect(codeCite([])).toBeNull();
  });
});

describe('repondreChatbot', () => {
  it('réponse vérifiée : envoyée avec le pied au premier échange, mémorisée', async () => {
    const d = deps();
    expect(await repondreChatbot('cours de sonatel ?', d)).toBe('repondu');
    expect(d.envois).toEqual([`Sonatel cote 39 200 FCFA.${PIED_PREMIER}`]);
    expect(d.lignes[0]).toEqual([
      { role: 'user', content: 'cours de sonatel ?' },
      { role: 'assistant', content: 'Sonatel cote 39 200 FCFA.' },
    ]);
  });
  it('pas de pied quand la conversation a déjà un historique', async () => {
    const d = deps({ historique: async () => [{ role: 'user', content: 'bonjour' }] });
    await repondreChatbot('et le cours ?', d);
    expect(d.envois[0]).toBe('Sonatel cote 39 200 FCFA.');
  });
  it('quota atteint : texte fixe, aucun appel IA', async () => {
    const llm = vi.fn();
    const d = deps({ quota: async () => false, llm });
    expect(await repondreChatbot('question', d)).toBe('limite');
    expect(d.envois).toEqual([texteQuota('inconnu')]);
    expect(llm).not.toHaveBeenCalled();
  });
  it('note vocale : quota déjà pris, pas redemandé', async () => {
    const quota = vi.fn(async () => false);
    const d = deps({ quota });
    expect(await repondreChatbot('question', d, { quotaDejaPris: true })).toBe('repondu');
    expect(quota).not.toHaveBeenCalled();
  });
  it('sous-plafond des inconnus : texte fixe ; plafond global ou erreur : console', async () => {
    const a = deps({ budget: async () => 'plafond_inconnu' });
    expect(await repondreChatbot('q', a)).toBe('limite');
    expect(a.envois).toEqual([TEXTE_PLAFOND_INCONNU]);
    expect(await repondreChatbot('q', deps({ budget: async () => 'refuse' }))).toBe('console');
    expect(
      await repondreChatbot(
        'q',
        deps({
          budget: async () => {
            throw new Error('x');
          },
        }),
      ),
    ).toBe('console');
  });
  it('échec de tous les fournisseurs : console, rien envoyé', async () => {
    const d = deps({ llm: async () => ({ texte: null, sources: [] }) });
    expect(await repondreChatbot('q', d)).toBe('console');
    expect(d.envois).toEqual([]);
  });
  it('chiffre étranger : une réécriture, acceptée si propre', async () => {
    const llm = vi
      .fn()
      .mockResolvedValueOnce({ texte: 'Le PER vaut 9,5 et le cours 39 200 FCFA.', sources: [SOURCE] })
      .mockResolvedValueOnce({ texte: 'Le cours est de 39 200 FCFA.', sources: [] });
    const d = deps({ llm, historique: async () => [{ role: 'assistant', content: 'x' }] });
    expect(await repondreChatbot('q', d)).toBe('repondu');
    expect(d.envois).toEqual(['Le cours est de 39 200 FCFA.']);
    expect(d.evenements).toContain('chiffre_etranger');
    expect(llm.mock.calls[1]![0].at(-1).content).toContain('9,5');
  });
  it('chiffre étranger deux fois : réponse sans chiffre avec lien vers la valeur', async () => {
    const llm = vi.fn().mockResolvedValue({ texte: 'Le PER vaut 9,5.', sources: [SOURCE] });
    const d = deps({ llm, historique: async () => [{ role: 'assistant', content: 'x' }] });
    await repondreChatbot('q', d);
    expect(d.envois[0]).toContain('/societes/SNTS');
    expect(d.envois[0]).not.toMatch(/9,5/);
    expect(d.evenements).toContain('chiffre_etranger_repli');
  });
  it('données personnelles masquées avant l’IA et en mémoire', async () => {
    const llm = vi.fn(async () => ({ texte: 'Bien noté.', sources: [] }));
    const d = deps({ llm });
    await repondreChatbot('mon mail a.b@c.com, rappelez le 0102030405', d);
    const envoye = JSON.stringify(llm.mock.calls[0]);
    expect(envoye).not.toContain('a.b@c.com');
    expect(envoye).not.toContain('0102030405');
    expect(JSON.stringify(d.lignes)).not.toContain('a.b@c.com');
  });
  it('envoi impossible : console', async () => {
    expect(await repondreChatbot('q', deps({ envoyer: async () => false }))).toBe('console');
  });
});
