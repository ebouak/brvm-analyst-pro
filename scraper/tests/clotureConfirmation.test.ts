import { describe, expect, it } from 'vitest';
import { evaluerCloture, lireConfirmation, type RunDaily } from '../src/cloture/confirmation.js';
import { decisionDispatch } from '../src/cloture/dispatch.js';

const S = '2026-11-19';
const run = (o: Partial<RunDaily> = {}, meta: Record<string, unknown> = {}): RunDaily => ({
  id: 'r1',
  status: 'success',
  finished_at: `${S}T22:10:00Z`,
  ...o,
  metadata: { date_marche: S, nb_actions: 46, ...meta },
});

describe('evaluerCloture', () => {
  it('run réussi de la séance, après 15:00 UTC, ≥ 20 actions → confirmée', () => {
    const c = evaluerCloture(S, [run()]);
    expect(c.confirmee).toBe(true);
    expect(c.runId).toBe('r1');
  });
  it('run réussi terminé avant 15:00 → faux', () => {
    const c = evaluerCloture(S, [run({ finished_at: `${S}T14:30:00Z` })]);
    expect(c.confirmee).toBe(false);
    expect(c.raison).toMatch(/avant 15:00/);
  });
  it('moins de 20 actions → faux', () => {
    expect(evaluerCloture(S, [run({}, { nb_actions: 12 })]).confirmee).toBe(false);
  });
  it('autre date de séance → faux', () => {
    const c = evaluerCloture(S, [run({}, { date_marche: '2026-11-18' })]);
    expect(c.confirmee).toBe(false);
    expect(c.raison).toMatch(/2026-11-18/);
  });
  it('statuts autres que success ignorés', () => {
    expect(evaluerCloture(S, [run({ status: 'partial' }), run({ status: 'failed' })]).confirmee).toBe(false);
  });
  it('nb_actions sous forme de texte accepté (jsonb relu)', () => {
    expect(evaluerCloture(S, [run({}, { nb_actions: '46' })]).confirmee).toBe(true);
  });
  it('liste vide / séance invalide → faux', () => {
    expect(evaluerCloture(S, []).confirmee).toBe(false);
    expect(evaluerCloture('19/11/2026', [run()]).confirmee).toBe(false);
  });
});

/** Client Supabase factice : juste ce que lireConfirmation enchaîne. */
function sbFactice(source: { data: unknown; error: unknown }, runs: { data: unknown; error: unknown }) {
  const chaine = (resultat: { data: unknown; error: unknown }) => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte', 'order']) c[m] = () => c;
    c.maybeSingle = async () => resultat;
    c.limit = async () => resultat;
    return c;
  };
  return { from: (t: string) => chaine(t === 'scraper_sources' ? source : runs) } as never;
}

describe('lireConfirmation', () => {
  it('lit les runs de la source daily', async () => {
    const c = await lireConfirmation(sbFactice({ data: { id: 's' }, error: null }, { data: [run()], error: null }), S);
    expect(c.confirmee).toBe(true);
  });
  it('source absente → refus explicite', async () => {
    const c = await lireConfirmation(sbFactice({ data: null, error: null }, { data: [], error: null }), S);
    expect(c.confirmee).toBe(false);
    expect(c.raison).toMatch(/absente/);
  });
  it('base en erreur → LÈVE (jamais un refus muet)', async () => {
    await expect(
      lireConfirmation(sbFactice({ data: { id: 's' }, error: null }, { data: null, error: { message: 'boom' } }), S),
    ).rejects.toThrow(/scraper_runs illisible/);
  });
});

describe('decisionDispatch (référence de la fonction SQL 0251)', () => {
  const base = { isodow: 4, jourFerme: false, confirmee: false, runEnCours: false, jetonPresent: true };
  it('jour ouvré, non confirmée → dispatch', () => {
    expect(decisionDispatch(base)).toEqual({ dispatcher: true, raison: 'dispatch' });
  });
  it('déjà confirmée → on s’arrête', () => {
    expect(decisionDispatch({ ...base, confirmee: true }).dispatcher).toBe(false);
  });
  it('week-end et jour fermé au calendrier → rien', () => {
    expect(decisionDispatch({ ...base, isodow: 6 }).raison).toBe('week-end');
    expect(decisionDispatch({ ...base, jourFerme: true }).raison).toBe('jour-ferme');
  });
  it('run en cours → pas de second dispatch', () => {
    expect(decisionDispatch({ ...base, runEnCours: true }).raison).toBe('run-en-cours');
  });
  it('jeton absent → rien envoyé', () => {
    expect(decisionDispatch({ ...base, jetonPresent: false }).raison).toBe('jeton-absent');
  });
});
