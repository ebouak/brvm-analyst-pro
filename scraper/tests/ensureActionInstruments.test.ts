import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Test UNITAIRE : getSupabase est mocké, rien ne part vers la vraie base.
 *
 * Ce que cette fonction doit garantir, et que le 24/09/2026 a rendu concret :
 * une valeur nouvellement cotée ne doit plus faire tomber la séance entière,
 * SANS pour autant ouvrir la porte à des codes fantômes dans le référentiel.
 */
let codesEnBase: string[] = [];
let upserts: Array<{ table: string; rows: Array<Record<string, unknown>>; options: unknown }> = [];

vi.mock('../src/persistence/supabase.js', () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select: () => ({
        in: (_colonne: string, codes: string[]) =>
          Promise.resolve({
            data: codes.filter((c) => codesEnBase.includes(c)).map((code) => ({ code })),
            error: null,
          }),
      }),
      upsert: (rows: Array<Record<string, unknown>>, options: unknown) => {
        upserts.push({ table, rows, options });
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

const { ensureActionInstruments } = await import('../src/persistence/repository.js');

/** Les 47 valeurs cotées avant l'admission de BBGC (extrait suffisant). */
const DEJA_COTEES = ['SNTS', 'SGBC', 'BOAC', 'PALC', 'NTLC'];

function action(code: string, designation = `Société ${code}`) {
  return { code, designation };
}

describe('ensureActionInstruments', () => {
  beforeEach(() => {
    codesEnBase = [...DEJA_COTEES];
    upserts = [];
  });

  it('n’écrit rien sur un lot vide', async () => {
    expect(await ensureActionInstruments([])).toEqual([]);
    expect(upserts).toHaveLength(0);
  });

  it('n’écrit rien quand le référentiel est à jour', async () => {
    expect(await ensureActionInstruments(DEJA_COTEES.map((c) => action(c)))).toEqual([]);
    expect(upserts).toHaveLength(0);
  });

  it('crée la valeur nouvellement admise, et elle seule', async () => {
    const lot = [...DEJA_COTEES.map((c) => action(c)), action('BBGC', "Bridge Bank Group Côte d'Ivoire")];

    expect(await ensureActionInstruments(lot)).toEqual(['BBGC']);

    expect(upserts).toHaveLength(1);
    expect(upserts[0].table).toBe('brvm_instruments');
    expect(upserts[0].rows).toEqual([
      { code: 'BBGC', designation: "Bridge Bank Group Côte d'Ivoire", type: 'action', actif: true },
    ]);
  });

  it('ne devine JAMAIS le secteur ni le pays — ils sont curés', async () => {
    await ensureActionInstruments([action('BBGC', "Bridge Bank Group Côte d'Ivoire")]);
    const ligne = upserts[0].rows[0];
    expect(ligne).not.toHaveProperty('secteur');
    expect(ligne).not.toHaveProperty('pays');
  });

  it('ne réécrit jamais une ligne existante (ignoreDuplicates)', async () => {
    await ensureActionInstruments([action('BBGC')]);
    expect(upserts[0].options).toEqual({ onConflict: 'code', ignoreDuplicates: true });
  });

  it('dédoublonne un code présent deux fois dans le lot', async () => {
    expect(await ensureActionInstruments([action('BBGC'), action('BBGC')])).toEqual(['BBGC']);
    expect(upserts[0].rows).toHaveLength(1);
  });

  it.each([
    ['minuscules', 'bbgc'],
    ['trop court', 'BB'],
    ['trop long', 'BBGCXX'],
    ['chiffres', 'BB1C'],
    ['cellule parasite', 'Total'],
  ])('refuse un code implausible (%s) sans rien écrire', async (_cas, code) => {
    await expect(ensureActionInstruments([action(code)])).rejects.toThrow(/inexploitable/);
    expect(upserts).toHaveLength(0);
  });

  it('refuse une désignation vide sans rien écrire', async () => {
    await expect(ensureActionInstruments([action('BBGC', '   ')])).rejects.toThrow(/inexploitable/);
    expect(upserts).toHaveLength(0);
  });

  it('refuse une rafale de codes inconnus — parsing suspect, pas dix admissions', async () => {
    const rafale = ['AAAA', 'BBBB', 'CCCC', 'DDDD'].map((c) => action(c));
    await expect(ensureActionInstruments(rafale)).rejects.toThrow(/parsing suspect/);
    expect(upserts).toHaveLength(0);
  });

  it('accepte le maximum toléré (3) mais pas au-delà', async () => {
    const trois = ['AAAA', 'BBBB', 'CCCC'].map((c) => action(c));
    expect(await ensureActionInstruments(trois)).toEqual(['AAAA', 'BBBB', 'CCCC']);
    expect(upserts).toHaveLength(1);
  });
});
