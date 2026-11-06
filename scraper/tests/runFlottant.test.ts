import { describe, it, expect } from 'vitest';
import { flottantEnTitres, lireFicheSika } from '../src/refdata/runFlottant.js';

// Balisage réduit de la fiche SONATEL relevée le 2026-11-06 (espaces insécables inclus).
const SNTS = `<html><body><div>Adjointe : A. N.</div>
  <div>Nombre de titres : 1&#xA0;000&#xA0;000&#xA0;000</div>
  <div>Flottant : 22,47%</div>
  <div>Valorisation de la société : 4&#xA0;000&#xA0;000 MFCFA</div></body></html>`;

describe('lireFicheSika', () => {
  it('lit le nombre de titres et le pourcentage de flottant', () => {
    expect(lireFicheSika(SNTS)).toEqual({ titres: 1_000_000_000, flottantPct: 22.47 });
  });

  it('rend null, sans rien deviner, sur une fiche sans ces lignes', () => {
    expect(lireFicheSika('<html><body>Page indisponible</body></html>')).toEqual({ titres: null, flottantPct: null });
  });
});

describe('flottantEnTitres', () => {
  it('convertit le pourcentage en titres sur notre base (SNTS : 224,7 millions)', () => {
    expect(flottantEnTitres({ titres: 1_000_000_000, flottantPct: 22.47 }, 1_000_000_000)).toEqual({ etat: 'ok', flottant: 224_700_000 });
  });

  it('tolère un écart de titres minime (BICB : 57 793 459 contre 57 759 800)', () => {
    expect(flottantEnTitres({ titres: 57_793_459, flottantPct: 20 }, 57_759_800).etat).toBe('ok');
  });

  it("n'écrit rien si les titres divergent : un fractionnement non reporté passerait sinon inaperçu", () => {
    expect(flottantEnTitres({ titres: 1_000_000_000, flottantPct: 22.47 }, 100_000_000)).toEqual({
      etat: 'titres_discordants',
      nous: 100_000_000,
      sika: 1_000_000_000,
    });
  });

  it('écarte une donnée absente ou impossible', () => {
    expect(flottantEnTitres({ titres: null, flottantPct: 20 }, 1000).etat).toBe('absent');
    expect(flottantEnTitres({ titres: 1000, flottantPct: null }, 1000).etat).toBe('absent');
    expect(flottantEnTitres({ titres: 1000, flottantPct: 20 }, null).etat).toBe('absent');
    expect(flottantEnTitres({ titres: 1000, flottantPct: 0 }, 1000).etat).toBe('absent');
    expect(flottantEnTitres({ titres: 1000, flottantPct: 140 }, 1000).etat).toBe('absent');
  });
});
