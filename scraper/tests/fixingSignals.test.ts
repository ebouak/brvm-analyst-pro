import { describe, it, expect } from 'vitest';
import {
  detectPriceMove,
  detectVolumeSpike,
  detectIntradayMomentum,
  detectFixingSignals,
  sessionVolumeFromCumulative,
  sessionActivity,
  type IntradaySample,
} from '../src/intraday/indicators/fixingSignals.js';

/**
 * ATTENTION : le champ `volume` des snapshots BRVM est le volume CUMULÉ de la
 * séance (vérifié sur données réelles), pas un volume par intervalle.
 * Les fixtures respectent donc une progression croissante.
 */

/** Séance figée : prix inchangé, volume cumulé final = 90. */
const FIGE: IntradaySample[] = [
  { close: 10_000, volume: 30 },
  { close: 10_000, volume: 60 },
  { close: 10_000, volume: 90 },
];

/** Séance avec un vrai mouvement de prix ; volume cumulé final = 600. */
const MOUVEMENT: IntradaySample[] = [
  { close: 10_000, volume: 100 },
  { close: 10_150, volume: 400 },
  { close: 10_400, volume: 600 },
];

describe('detectPriceMove — un prix qui bouge est RARE, donc significatif', () => {
  it('titre figé : aucun signal', () => {
    const r = detectPriceMove(FIGE, 0.5);
    expect(r.triggered).toBe(false);
    expect(r.value).toBe(0);
  });

  it('mouvement de +3 % : signal déclenché, valeur = amplitude signée', () => {
    const r = detectPriceMove(MOUVEMENT, 0.5);
    expect(r.triggered).toBe(true);
    expect(r.value).toBeCloseTo(4.0, 1); // 10 000 → 10 400
    expect(r.distinctPrices).toBe(3);
  });

  it('mouvement sous le seuil : non déclenché', () => {
    const petit: IntradaySample[] = [
      { close: 10_000, volume: 10 },
      { close: 10_020, volume: 10 },
    ];
    expect(detectPriceMove(petit, 0.5).triggered).toBe(false); // 0,2 % < 0,5 %
  });

  it('série vide ou à un seul point : jamais de signal (pas d’invention)', () => {
    expect(detectPriceMove([], 0.5).triggered).toBe(false);
    expect(detectPriceMove([{ close: 10_000, volume: 5 }], 0.5).triggered).toBe(false);
  });
});

describe('sessionVolumeFromCumulative — le volume est CUMULÉ, pas incrémental', () => {
  it('ne somme PAS les snapshots (sinon le volume est multiplié par leur nombre)', () => {
    // Somme = 180 ; le vrai volume de la séance est le cumul final = 90.
    expect(sessionVolumeFromCumulative(FIGE)).toBe(90);
  });

  it('ignore le volume de la VEILLE porté par la capture d’avant-ouverture', () => {
    // Cas réel SNTS : 14 206 (veille) → reset à 0 → 566 → 739 (vrai volume du jour).
    const reel: IntradaySample[] = [
      { close: 31_000, volume: 14_206 }, // capture 09:01, volume de la veille
      { close: 31_000, volume: 0 }, // reset d'ouverture
      { close: 31_000, volume: 566 },
      { close: 30_900, volume: 739 },
    ];
    expect(sessionVolumeFromCumulative(reel)).toBe(739); // et surtout PAS 14 206
  });

  it('série vide → 0', () => {
    expect(sessionVolumeFromCumulative([])).toBe(0);
  });
});

describe('detectVolumeSpike — volume du jour vs moyenne 20 séances', () => {
  it('volume 3x la moyenne : signal déclenché', () => {
    const r = detectVolumeSpike(FIGE, 30, 2.0); // 90 échangés vs 30 de moyenne
    expect(r.triggered).toBe(true);
    expect(r.value).toBeCloseTo(3.0, 1);
  });

  it('volume normal : non déclenché', () => {
    expect(detectVolumeSpike(FIGE, 500, 2.0).triggered).toBe(false); // 90 / 500 < 2
  });

  it('moyenne inconnue ou nulle : aucun signal (jamais de division fantaisiste)', () => {
    expect(detectVolumeSpike(FIGE, null, 2.0).triggered).toBe(false);
    expect(detectVolumeSpike(FIGE, 0, 2.0).triggered).toBe(false);
  });
});

describe('detectIntradayMomentum — direction depuis l’ouverture', () => {
  it('hausse continue : momentum positif déclenché', () => {
    const r = detectIntradayMomentum(MOUVEMENT, 1.5);
    expect(r.triggered).toBe(true);
    expect(r.value).toBeGreaterThan(0);
  });

  it('baisse : momentum négatif déclenché (le signal est signé)', () => {
    const baisse: IntradaySample[] = [
      { close: 10_000, volume: 50 },
      { close: 9_700, volume: 80 },
    ];
    const r = detectIntradayMomentum(baisse, 1.5);
    expect(r.triggered).toBe(true);
    expect(r.value).toBeLessThan(0);
  });

  it('titre figé : aucun momentum', () => {
    expect(detectIntradayMomentum(FIGE, 1.5).triggered).toBe(false);
  });
});

describe('detectFixingSignals — orchestration (2 signaux, pas 3)', () => {
  it('titre figé : aucun signal du tout', () => {
    expect(detectFixingSignals(FIGE, { avgVolume20d: 500 })).toHaveLength(0);
  });

  it('CONFLUENCE : bouger AVEC un volume anormal déclenche les deux signaux', () => {
    const out = detectFixingSignals(MOUVEMENT, { avgVolume20d: 200 }); // cumul 600 vs 200
    const types = out.map((s) => s.type).sort();
    expect(types).toEqual(['intraday_momentum', 'volume_spike']);
    // Chaque signal porte sa valeur et son seuil (explicabilité).
    for (const s of out) {
      expect(s.threshold).toBeGreaterThan(0);
      expect(typeof s.value).toBe('number');
    }
  });

  it('bouger SANS volume : simple illiquidité, un seul signal', () => {
    const out = detectFixingSignals(MOUVEMENT, { avgVolume20d: 100_000 });
    expect(out.map((s) => s.type)).toEqual(['intraday_momentum']);
  });

  it("aucun signal d'amplitude séparé : il ferait double emploi avec le momentum", () => {
    const out = detectFixingSignals(MOUVEMENT, { avgVolume20d: 200 });
    expect(out.map((s) => s.type)).not.toContain('price_move');
  });
});

describe('sessionActivity — contexte, pas un signal', () => {
  it('expose le nombre de prix distincts et le volume réel de la séance', () => {
    const a = sessionActivity(MOUVEMENT);
    expect(a.distinctPrices).toBe(3);
    expect(a.sessionVolume).toBe(600); // cumul final, pas la somme (1100)
  });
});
