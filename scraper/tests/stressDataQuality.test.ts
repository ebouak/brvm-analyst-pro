import { describe, expect, it } from 'vitest';
import { calculerRapportCouverture, validerSerieIndice } from '../src/stress/pure/dataQuality.js';
import { parseIndexCsv } from '../src/stress/import/csvImporter.js';
import { BCEAO_GUICHET_MARGINAL, BCEAO_TAUX_MINIMUM_SOUMISSION } from '../src/stress/import/macroUemoa.js';

describe('Historical Crisis Engine — qualité et import des séries', () => {
  it('rejette les dates antérieures à la création officielle de l’indice et les doublons/valeurs nulles', () => {
    const { seriePropre, anomalies } = validerSerieIndice('BRVM30', [
      { date_marche: '2022-12-30', valeur: 99 }, // pré-création (BRVM30 = 2023-01-01)
      { date_marche: '2023-01-02', valeur: 100 },
      { date_marche: '2023-01-02', valeur: 101 }, // doublon
      { date_marche: '2023-01-03', valeur: 0 }, // valeur invalide
      { date_marche: '2023-01-20', valeur: 125 }, // trou > 5j + variation > 12 %
    ]);

    expect(seriePropre.map((p) => p.date_marche)).toEqual(['2023-01-02', '2023-01-20']);
    expect(seriePropre[0]!.valeur).toBe(101);
    const types = anomalies.map((a) => a.type);
    expect(types).toContain('date_pre_creation');
    expect(types).toContain('doublon_date');
    expect(types).toContain('valeur_invalide');
    expect(types).toContain('variation_excessive');
    expect(types).toContain('trou_cotation');
  });

  it('calcule correctement le rapport de couverture annuel et les trous majeurs', () => {
    const cov = calculerRapportCouverture('BRVMC', [
      { date_marche: '2026-01-02', valeur: 300 },
      { date_marche: '2026-01-05', valeur: 301 },
      { date_marche: '2026-01-20', valeur: 305 },
    ]);
    expect(cov.debut_date).toBe('2026-01-02');
    expect(cov.fin_date).toBe('2026-01-20');
    expect(cov.nb_seances_disponibles).toBe(3);
    expect(cov.trous_majeurs).toHaveLength(1);
    expect(cov.trous_majeurs[0]!.jours_ouvres_manquants).toBe(10);
  });

  it('parse des CSV au format français (point-virgule, DD/MM/YYYY, virgule décimale) et US', () => {
    const csvFr = [
      'Date;Clôture;Volume',
      '02/01/2024;214,50;12000',
      '03/01/2024;216,65;15000',
    ].join('\n');
    const rFr = parseIndexCsv(csvFr, 'BRVMC', 'test-fr');
    expect(rFr.seriePropre).toHaveLength(2);
    expect(rFr.seriePropre[0]!.date_marche).toBe('2024-01-02');
    expect(rFr.seriePropre[0]!.valeur).toBe(214.5);
    expect(rFr.seriePropre[1]!.variation_pct).toBeCloseTo(1, 1);

    const csvUs = [
      'Date,Close,Volume',
      '2024-01-02,"1,214.50",12000',
      '2024-01-03,"1,200.00",10000',
    ].join('\n');
    const rUs = parseIndexCsv(csvUs, 'BRVMC', 'test-us');
    expect(rUs.seriePropre).toHaveLength(2);
    expect(rUs.seriePropre[0]!.valeur).toBe(1214.5);
  });

  it('sépare strictement le taux minimum de soumission et le guichet marginal BCEAO (corridor +100 pb puis +200 pb dès déc. 2016)', () => {
    // Aucune décision fictive en décembre 2016 sur le taux minimum de soumission
    expect(BCEAO_TAUX_MINIMUM_SOUMISSION.some((r) => r.date_valeur.startsWith('2016-12'))).toBe(false);
    const sept2013 = BCEAO_TAUX_MINIMUM_SOUMISSION.find((r) => r.date_valeur === '2013-09-16');
    const juin2020 = BCEAO_TAUX_MINIMUM_SOUMISSION.find((r) => r.date_valeur === '2020-06-24');
    expect(sept2013?.valeur).toBe(2.5);
    expect(juin2020?.valeur).toBe(2.0);

    // Vérifier le corridor exact : +1,00 pt avant 2016-12-16, +2,00 pts à partir de 2016-12-16
    for (const minRow of BCEAO_TAUX_MINIMUM_SOUMISSION) {
      const margRow = BCEAO_GUICHET_MARGINAL.find((m) => m.date_valeur === minRow.date_valeur);
      expect(margRow, `date ${minRow.date_valeur}`).toBeDefined();
      const ecart = Math.round((margRow!.valeur - minRow.valeur) * 100) / 100;
      expect(ecart).toBe(minRow.date_valeur < '2016-12-16' ? 1 : 2);
    }
  });
});
