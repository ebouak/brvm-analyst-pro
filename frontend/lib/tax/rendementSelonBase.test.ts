import { describe, it, expect } from 'vitest';
import { rendementNetSelonBase } from './compute';
import { BAREME, type TauxFiscal } from './rates';

const T = (taux: number | null): TauxFiscal => ({ taux, source: 'test', sourceUrl: null, verifieLe: '2026-10-20' });
const FIXTURE = { CI: { dividende_cote: T(0.12) }, SN: { dividende_cote: T(null) } };

describe('rendement net selon la base du montant', () => {
  it('montant déjà net : jamais retaxé (double IRVM corrigée le 2026-10-20)', () => {
    expect(rendementNetSelonBase(5, 'net', 'CI', FIXTURE)).toEqual({ valeur: 5, deja_net: true });
  });
  it('montant brut : retenue du barème', () => {
    const r = rendementNetSelonBase(5, 'brut', 'CI', FIXTURE);
    expect(r.indisponible).toBeUndefined();
    if (!r.indisponible) expect(r.valeur).toBeCloseTo(4.4, 10);
  });
  it('base inconnue, ou taux non confirmé : indisponible, jamais supposé', () => {
    expect(rendementNetSelonBase(5, 'inconnu', 'CI', FIXTURE)).toEqual({ indisponible: true });
    expect(rendementNetSelonBase(5, null, 'CI', FIXTURE)).toEqual({ indisponible: true });
    expect(rendementNetSelonBase(5, 'brut', 'SN', FIXTURE)).toEqual({ indisponible: true });
  });
  it('barème réel : CI 12 % personnes physiques, 10 % personnes morales (LF 2025)', () => {
    expect(BAREME.CI.dividende_cote.taux).toBe(0.12);
    expect(BAREME.CI.dividende_cote.tauxPersonneMorale).toBe(0.1);
  });
});
