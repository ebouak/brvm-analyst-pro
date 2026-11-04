import { describe, it, expect, vi } from 'vitest';
import { construireRequeteAiguillage, QUESTION_INTENTION, type SocieteIdentite } from './requete';
import { validerAiguillage, type AiguillageValide } from './valider';
import { decider } from './decider';
import { TEXTE_REFUS_CONSEIL, TEXTE_SALUTATION, texteClarification } from './textes';
import { aiguillerParJev, type DepsAiguillage } from './aiguiller';
import { LISTE_INTENTIONS, type Intention } from './intentions';

const societes: SocieteIdentite[] = [
  { code: 'SNTS', nom: 'Sonatel', secteur: 'Télécommunications', pays: 'SN' },
  { code: 'ORAC', nom: 'Orange Côte d’Ivoire', secteur: 'Télécommunications', pays: 'CI' },
];
const choix = (choice: Intention, p = 0.95) => ({
  type: 'choice',
  choice,
  confidence: p,
  probabilities: Object.fromEntries(LISTE_INTENTIONS.map((k) => [k, k === choice ? p : (1 - p) / (LISTE_INTENTIONS.length - 1)])),
});
const noul = (p: number) => ({ type: 'noul', noul: p });
const brut = (choice: Intention, snts: number, orac: number, p = 0.95) => ({ answers: { [QUESTION_INTENTION]: choix(choice, p), SNTS: noul(snts), ORAC: noul(orac) } });
const valide = (choice: Intention, snts: number, orac: number, p = 0.95) => validerAiguillage(brut(choice, snts, orac, p), ['SNTS', 'ORAC'])!;

describe('requête mixte', () => {
  it('une question d’intention et une question oui/non par société', () => {
    const r = construireRequeteAiguillage('cours de sonatel', societes);
    expect(Object.keys(r.questions).sort()).toEqual(['ORAC', 'SNTS', QUESTION_INTENTION].sort());
    expect(r.state.societes.SNTS).toBe('SNTS — Sonatel. Secteur : Télécommunications. Pays : SN.');
    expect((r.questions[QUESTION_INTENTION] as { criteria: Record<string, string> }).criteria).toHaveProperty('conseil');
  });
});

describe('validation', () => {
  it('accepte une réponse complète', () => {
    expect(valide('cours', 0.9, 0.1)).toMatchObject({ intention: 'cours', societes: { SNTS: 0.9, ORAC: 0.1 } });
  });
  it.each([
    ['intention inconnue', { answers: { ...brut('cours', 1, 0).answers, [QUESTION_INTENTION]: { ...choix('cours'), choice: 'acheter' } } }],
    ['probabilité hors [0,1]', { answers: { ...brut('cours', 1, 0).answers, SNTS: noul(3) } }],
    ['code inconnu', { answers: { ...brut('cours', 1, 0).answers, XXXX: noul(0.2) } }],
    ['code manquant', { answers: { [QUESTION_INTENTION]: choix('cours'), SNTS: noul(1) } }],
    ['intention absente', { answers: { SNTS: noul(1), ORAC: noul(0) } }],
    ['mauvais type', { answers: { ...brut('cours', 1, 0).answers, [QUESTION_INTENTION]: noul(0.9) } }],
    ['corps nul', null],
  ])('rejette : %s', (_n, b) => {
    expect(validerAiguillage(b, ['SNTS', 'ORAC'])).toBeNull();
  });
});

describe('décision', () => {
  it('une société sûre ⇒ commande exacte', () => {
    expect(decider(valide('cours', 0.92, 0.1))).toEqual({ type: 'commande', commande: { type: 'cours', valeur: 'SNTS' } });
    expect(decider(valide('dividendes', 0.05, 0.9))).toEqual({ type: 'commande', commande: { type: 'dividendes', valeur: 'ORAC' } });
  });
  it('deux sociétés plausibles ⇒ clarification, jamais une réponse sur un seul code', () => {
    expect(decider(valide('cours', 0.9, 0.85))).toEqual({ type: 'clarification', intention: 'cours', codes: ['SNTS', 'ORAC'] });
    expect(decider(valide('cours', 0.2, 0.3))).toEqual({ type: 'clarification', intention: 'cours', codes: [] });
  });
  it('intention incertaine ⇒ chemin actuel', () => {
    expect(decider(valide('cours', 1, 0, 0.6))).toEqual({ type: 'aiguillage_actuel' });
    const serre: AiguillageValide = { intention: 'cours', probabilites: { cours: 0.86, conseil: 0.5 }, societes: { SNTS: 1, ORAC: 0 } };
    expect(decider(serre)).toEqual({ type: 'aiguillage_actuel' });
  });
  it('conseil ⇒ refus, jamais une commande', () => {
    expect(decider(valide('conseil', 1, 0))).toEqual({ type: 'refus_conseil' });
  });
  it('autres intentions', () => {
    expect(decider(valide('palmares_baisses', 0, 0))).toEqual({ type: 'commande', commande: { type: 'palmares', critere: 'baisses' } });
    expect(decider(valide('aide', 0, 0))).toEqual({ type: 'commande', commande: { type: 'aide' } });
    expect(decider(valide('salutation', 0, 0))).toEqual({ type: 'salutation' });
    expect(decider(valide('analyse', 1, 0))).toEqual({ type: 'agent' });
    expect(decider(valide('humain', 0, 0))).toEqual({ type: 'console' });
    expect(decider(valide('autre', 0, 0))).toEqual({ type: 'aiguillage_actuel' });
  });
});

describe('textes fixes', () => {
  it('aucun chiffre dans les textes de service', () => {
    for (const t of [TEXTE_REFUS_CONSEIL, TEXTE_SALUTATION, texteClarification('cours', ['SNTS', 'ORAC']), texteClarification('dividendes', [])]) {
      expect(t).not.toMatch(/\d/);
    }
    expect(texteClarification('dividendes', ['ORAC'])).toContain('*DIV ORAC*');
  });
});

const TEXTE = 'quel est le cours de sonatel, message confidentiel';
function deps(o: Partial<DepsAiguillage> = {}): DepsAiguillage & { journaux: unknown[]; lignes: unknown[] } {
  const journaux: unknown[] = [];
  const lignes: unknown[] = [];
  return {
    journaux,
    lignes,
    actif: async () => true,
    societes: async () => societes,
    quota: async () => true,
    reserverBudget: async () => 'ok',
    jev: vi.fn(async () => brut('cours', 0.95, 0.02)),
    journaliser: async (e) => {
      lignes.push(e);
    },
    journal: (e) => journaux.push(e),
    delaiMs: 200,
    ...o,
  };
}

describe('flux d’aiguillage : invariants', () => {
  it('nominal : commande exacte, journal anonyme', async () => {
    const d = deps();
    expect(await aiguillerParJev(TEXTE, '225070000@c.us', d)).toEqual({ type: 'commande', commande: { type: 'cours', valeur: 'SNTS' } });
    expect(d.lignes).toEqual([{ intention: 'cours', decision: 'commande', probabilite: 0.95 }]);
  });
  it('drapeau coupé ⇒ aucun appel', async () => {
    const d = deps({ actif: async () => false });
    expect(await aiguillerParJev(TEXTE, 'x', d)).toEqual({ type: 'aiguillage_actuel' });
    expect(d.jev).not.toHaveBeenCalled();
  });
  it('e-mail ou numéro dans le message ⇒ jamais envoyé', async () => {
    const d = deps();
    expect(await aiguillerParJev('rappelez-moi au +225 07 08 09 10 11', 'x', d)).toEqual({ type: 'aiguillage_actuel' });
    expect(await aiguillerParJev('écrivez à a@b.ci pour le cours', 'x', d)).toEqual({ type: 'aiguillage_actuel' });
    expect(d.jev).not.toHaveBeenCalled();
  });
  it.each([
    ['quota atteint', { quota: async () => false }],
    ['plafond atteint', { reserverBudget: async () => 'refuse' as const }],
    ['compteur en erreur', { reserverBudget: async () => { throw new Error('rpc'); } }],
    ['Jev en erreur', { jev: async () => { throw new Error('http'); } }],
    ['réponse invalide', { jev: async () => ({ answers: {} }) }],
    ['sociétés indisponibles', { societes: async () => [] }],
  ])('%s ⇒ chemin actuel', async (_n, o) => {
    expect(await aiguillerParJev(TEXTE, 'x', deps(o as Partial<DepsAiguillage>))).toEqual({ type: 'aiguillage_actuel' });
  });
  it('délai dépassé ⇒ chemin actuel', async () => {
    const d = deps({ jev: (_c, signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('abort')))), delaiMs: 20 });
    expect(await aiguillerParJev(TEXTE, 'x', d)).toEqual({ type: 'aiguillage_actuel' });
  });
  it('aucun journal ne contient le texte ni le numéro', async () => {
    const d = deps({ jev: async () => { throw new Error(TEXTE); } });
    await aiguillerParJev(TEXTE, '225070000@c.us', d);
    const d2 = deps();
    await aiguillerParJev(TEXTE, '225070000@c.us', d2);
    const tout = JSON.stringify([d.journaux, d.lignes, d2.journaux, d2.lignes]);
    expect(tout).not.toContain('confidentiel');
    expect(tout).not.toContain('225070000');
  });
  it('un journal non écrit ne change pas la décision', async () => {
    const d = deps({ journaliser: async () => { throw new Error('db'); } });
    expect((await aiguillerParJev(TEXTE, 'x', d)).type).toBe('commande');
    expect(d.journaux).toContain('journal_non_ecrit');
  });
});
