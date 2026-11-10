import { describe, expect, it } from 'vitest';
import { lignesDivergentes, TOLERANCE_SCORE } from '../src/conseiller/runSignal.js';

type L = { code: string; etat: 'a_eviter' | 'favorable' | 'neutre' | 'pas_de_signal'; score: number | null; eligible: boolean };
const l = (code: string, etat: L['etat'], score: number | null, eligible = true): L => ({ code, etat, score, eligible });

describe('lignesDivergentes (relecture du registre d’époque)', () => {
  it('ignore l’arrondi d’un double relu par PostgREST (cas réel du 2026-11-10, BOAN)', () => {
    expect(lignesDivergentes([l('BOAN', 'favorable', 0.5454545454545454)], [l('BOAN', 'favorable', 0.545454545454545)])).toEqual([]);
  });

  it('signale un score réellement différent', () => {
    expect(lignesDivergentes([l('SNTS', 'favorable', 0.5)], [l('SNTS', 'favorable', 0.5 + 10 * TOLERANCE_SCORE)])).toEqual(['SNTS']);
  });

  it('signale un état ou une éligibilité différents, même à score égal', () => {
    expect(lignesDivergentes([l('PALC', 'a_eviter', -0.4)], [l('PALC', 'neutre', -0.4)])).toEqual(['PALC']);
    expect(lignesDivergentes([l('SGBC', 'neutre', 0.1, true)], [l('SGBC', 'neutre', 0.1, false)])).toEqual(['SGBC']);
  });

  it('traite les scores absents : nul des deux côtés égal, nul d’un seul côté différent', () => {
    expect(lignesDivergentes([l('BBGC', 'pas_de_signal', null, false)], [l('BBGC', 'pas_de_signal', null, false)])).toEqual([]);
    expect(lignesDivergentes([l('SEMC', 'neutre', 0)], [l('SEMC', 'neutre', null)])).toEqual(['SEMC']);
  });

  it('signale une ligne relue sans calcul correspondant', () => {
    expect(lignesDivergentes([], [l('XXXX', 'neutre', 0)])).toEqual(['XXXX']);
  });
});
