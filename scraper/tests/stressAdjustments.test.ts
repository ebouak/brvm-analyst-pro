import { describe, expect, it } from 'vitest';
import { ajusterSerieActions, parserPariteFractionnement } from '../src/stress/pure/adjustments.js';

describe('Stock Resilience Scanner — ajustement des fractionnements', () => {
  it('parse correctement les libellés de parité de fractionnement', () => {
    expect(parserPariteFractionnement('10 actions nouvelles pour 1 action ancienne')).toBe(10);
    expect(parserPariteFractionnement('2 actions nouvelles pour 1 action ancienne')).toBe(2);
    expect(parserPariteFractionnement('20/1')).toBe(20);
    expect(parserPariteFractionnement('')).toBeNull();
  });

  it('ajuste rétroactivement un split non ajusté (ex: ONTBF 1:2) et multiplie le volume', () => {
    const res = ajusterSerieActions(
      'ONTBF',
      [
        { date_marche: '2018-02-01', cours_jour: 8000, volume: 100 },
        { date_marche: '2018-02-02', cours_jour: 8100, volume: 150 },
        { date_marche: '2018-02-05', cours_jour: 4050, volume: 300 },
        { date_marche: '2018-02-06', cours_jour: 4052.5, volume: 220 },
      ],
      [{ date_effet: '2018-02-05', ratio: 2 }],
    );

    expect(res.ajustementsAppliques[0]!.applique).toBe(true);
    expect(res.serieAjustee[0]!.cours_ajuste).toBeCloseTo(4000, 2);
    expect(res.serieAjustee[0]!.volume_ajuste).toBe(200);
    expect(res.serieAjustee[1]!.cours_ajuste).toBeCloseTo(4050, 2);
    expect(res.serieAjustee[2]!.variation_pct).toBeCloseTo(0, 2);
    expect(res.anomalies).toHaveLength(0);
  });

  it('ne double-ajuste PAS un split déjà ajusté dans la série (ex: SNTS 2026)', () => {
    const res = ajusterSerieActions(
      'SNTS',
      [
        { date_marche: '2026-10-22', cours_jour: 4200, volume: 1000 },
        { date_marche: '2026-10-23', cours_jour: 4385, volume: 1200 },
        { date_marche: '2026-10-26', cours_jour: 4700, volume: 1500 },
      ],
      [{ date_effet: '2026-10-26', ratio: 10 }],
    );

    expect(res.ajustementsAppliques[0]!.applique).toBe(false);
    expect(res.serieAjustee[0]!.cours_ajuste).toBe(4200);
    expect(res.serieAjustee[1]!.cours_ajuste).toBe(4385);
  });

  it('signale les discontinuités majeures non expliquées par un split connu', () => {
    const res = ajusterSerieActions(
      'FTSC',
      [
        { date_marche: '2025-09-25', cours_jour: 3760, volume: 500 },
        { date_marche: '2025-09-26', cours_jour: 2185, volume: 900 },
      ],
      [],
    );

    expect(res.anomalies.length).toBeGreaterThanOrEqual(1);
    expect(res.anomalies[0]).toContain('FTSC');
  });
});
