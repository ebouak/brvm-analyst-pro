import { describe, it, expect } from 'vitest';
import { generateBrief, type BriefInput } from './brief';
import { fmtNumber, fmtFcfa } from './format';
import type { ActionDaily, IndiceDaily } from './types';

const actions = [
  { code: 'A', variation_pct: 1, valeur_echangee: null },
  { code: 'B', variation_pct: -1, valeur_echangee: null },
  { code: 'C', variation_pct: -2, valeur_echangee: null },
] as unknown as ActionDaily[];
const brvm30 = (v: number, valeur = 263.47) => ({ code: 'BRVM30', valeur, variation_pct: v }) as unknown as IndiceDaily;

function entree(p: Partial<BriefInput>): BriefInput {
  return {
    date: '2026-10-12',
    indices: { brvm30: brvm30(-0.26), brvmc: null },
    actions,
    signals: [],
    valeurTransactions: 2_919_495_128,
    valeurTransactionsPrev: 2_956_520_400,
    topSectorPerfs: [],
    ...p,
  };
}

describe('generateBrief — variations', () => {
  it('« recule de 0,26 % » : le verbe porte le sens, la valeur est en absolu et au format français', () => {
    const s = generateBrief(entree({})).summary;
    expect(s).toContain(`recule de ${fmtNumber(0.26, 2)} %`);
    expect(s).not.toMatch(/-0\.26|−0,26/);
  });

  it('variation faible : « est stable (+0,15 %) », jamais « stagne à +0.15% à »', () => {
    const s = generateBrief(entree({ indices: { brvm30: brvm30(0.15), brvmc: null } })).summary;
    expect(s).toContain(`est stable (+${fmtNumber(0.15, 2)} %)`);
  });

  it('secteur en recul : « recule de 0,85 % », sans signe moins', () => {
    const r = generateBrief(entree({ topSectorPerfs: [{ secteur: 'Services publics', varPct: -0.85, count: 3 }] }));
    expect(r.sectors).toContain(`recule de ${fmtNumber(0.85, 2)} %`);
    expect(r.sectors).not.toContain('-0.85');
  });
});

describe('generateBrief — valeur échangée', () => {
  it('lit la valeur des transactions de la séance, avec l écart à la veille', () => {
    const s = generateBrief(entree({})).summary;
    const delta = (2_919_495_128 / 2_956_520_400 - 1) * 100;
    expect(s).toContain(`${fmtFcfa(2_919_495_128)} FCFA`);
    expect(s).toContain(`−${fmtNumber(Math.abs(delta), 1)} % sur la séance précédente`);
  });

  it('sans résumé de séance (séance en cours) : aucun « 0 FCFA », aucun « -100% »', () => {
    const s = generateBrief(entree({ valeurTransactions: null, valeurTransactionsPrev: null })).summary;
    expect(s).not.toContain('FCFA');
    expect(s).not.toContain('100');
  });

  it('sans valeur de la veille : la valeur du jour sans comparaison', () => {
    const s = generateBrief(entree({ valeurTransactionsPrev: null })).summary;
    expect(s).toContain(`${fmtFcfa(2_919_495_128)} FCFA`);
    expect(s).not.toContain('séance précédente');
  });
});
