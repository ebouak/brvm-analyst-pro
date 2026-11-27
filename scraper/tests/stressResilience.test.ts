import { describe, expect, it } from 'vitest';
import {
  agregerSecteursStress,
  calculerResilienceUnivers,
  type ResilienceInputAction,
} from '../src/stress/pure/resilience.js';
import type { CoursAjusteAction } from '../src/stress/pure/adjustments.js';
import type { PointIndice } from '../src/stress/pure/types.js';

function mkDates(count: number): string[] {
  const out: string[] = [];
  let t = Date.UTC(2025, 10, 1);
  while (out.length < count) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    t += 86_400_000;
  }
  return out;
}

function mkCours(dates: readonly string[], fn: (i: number) => number): CoursAjusteAction[] {
  return dates.map((d, i) => {
    const c = Math.round(fn(i));
    const prev = i > 0 ? Math.round(fn(i - 1)) : c;
    return {
      date_marche: d,
      cours_brut: c,
      cours_ajuste: c,
      variation_pct: i > 0 && prev > 0 ? ((c / prev) - 1) * 100 : 0,
      volume_brut: 1000,
      volume_ajuste: 1000,
      valeur_echangee: c * 1000,
    };
  });
}

describe('Stock Resilience Scanner — moteur pur', () => {
  const dates = mkDates(270);
  const indice: PointIndice[] = dates.map((d, i) => ({
    date_marche: d,
    valeur: i < 190 ? 400 + i * 0.5 : 495 - (i - 190) * 0.7, // baisse récente ~ -10 %
  }));

  it('distingue performance en cours vs totale, filtre les illiquides du classement A et plafonne sans comptes récents', () => {
    const inputs: ResilienceInputAction[] = [
      // Valeur solide & liquide qui résiste et verse un dividende
      {
        instrument: { code: 'SOLI', designation: 'Solide SA', secteur: 'Télécommunications', pays: 'SN', famille_comptable: 'general', actif: true, shares: 1_000_000, isin: null, date_introduction: null },
        cours: mkCours(dates, (i) => (i < 190 ? 1000 + i : 1190 - (i - 190) * 0.2)),
        ajustements: [],
        anomaliesCours: [],
        income: [{ code: 'SOLI', periode: '2025', revenu_total: 5e9, resultat_exploitation: 1.5e9, resultat_net: 1.2e9, charges_financieres_nettes: 0.1e9 }],
        balance: [{ code: 'SOLI', periode: '2025', total_actifs: 10e9, tresorerie_equivalents: 1e9, dette_court_terme: 0.5e9, dette_long_terme: 1e9, total_capitaux_propres: 5e9 }],
        cashFlow: [{ code: 'SOLI', periode: '2025', flux_tresorerie_disponible: 1e9 }],
        indicateursBancaires: [],
        dividendes: [{ code: 'SOLI', exercice: 2025, ex_date: dates[210]!, montant: 100, montant_brut: null, base_fiscale: 'net' }],
        liquidite: { code: 'SOLI', date_marche: dates.at(-1)!, score: 85, classe: 'A', presence_pct: 98, valeur_moyenne_30j: 50e6, amihud: 0.02, spread_pct: 0.2, flux_net_pct: 3 },
        events: [],
      },
      // Valeur illiquide qui ne baisse pas uniquement faute de transactions
      {
        instrument: { code: 'ILLQ', designation: 'Illiquide SA', secteur: 'Industriels', pays: 'CI', famille_comptable: 'general', actif: true, shares: 100_000, isin: null, date_introduction: null },
        cours: mkCours(dates.filter((_, i) => i % 10 === 0), () => 5000),
        ajustements: [],
        anomaliesCours: [],
        income: [], // aucun état financier récent
        balance: [],
        cashFlow: [],
        indicateursBancaires: [],
        dividendes: [],
        liquidite: { code: 'ILLQ', date_marche: dates.at(-1)!, score: 10, classe: 'D', presence_pct: 12, valeur_moyenne_30j: 50_000, amihud: 4.5, spread_pct: 8, flux_net_pct: 0 },
        events: [],
      },
      // Banque en décrochage anormal avec baisse des résultats
      {
        instrument: { code: 'BANK', designation: 'Banque Test', secteur: 'Services financiers', pays: 'CI', famille_comptable: 'banque', actif: true, shares: 2_000_000, isin: null, date_introduction: null },
        cours: mkCours(dates, (i) => (i < 190 ? 5000 : 5000 - (i - 190) * 28)),
        ajustements: [],
        anomaliesCours: [],
        income: [
          { code: 'BANK', periode: '2025', revenu_total: 20e9, resultat_exploitation: null, resultat_net: 2e9, lignes_specifiques: { pnb: 20e9, coefficient_exploitation: 55 } },
          { code: 'BANK', periode: '2024', revenu_total: 22e9, resultat_exploitation: null, resultat_net: 3e9 },
        ],
        balance: [{ code: 'BANK', periode: '2025', total_actifs: 200e9, tresorerie_equivalents: null, dette_court_terme: null, dette_long_terme: null, total_capitaux_propres: 25e9, lignes_specifiques: { ratio_solvabilite: 13.5, taux_creances_souffrance: 7 } }],
        cashFlow: [],
        indicateursBancaires: [],
        dividendes: [{ code: 'BANK', exercice: 2025, ex_date: null, montant: 200, montant_brut: null, base_fiscale: 'net' }],
        liquidite: { code: 'BANK', date_marche: dates.at(-1)!, score: 75, classe: 'B', presence_pct: 95, valeur_moyenne_30j: 30e6, amihud: 0.1, spread_pct: 0.5, flux_net_pct: -12 },
        events: [],
      },
    ];

    const res = calculerResilienceUnivers(inputs, indice);
    const soli = res.find((r) => r.code === 'SOLI')!;
    const illq = res.find((r) => r.code === 'ILLQ')!;
    const bank = res.find((r) => r.code === 'BANK')!;

    // Perf totale > perf prix grâce au dividende
    expect(soli.perf_totale_1a_pct!).toBeGreaterThan(soli.perf_1a_pct!);
    // Illiquide exclu du classement A et score plafonné à <= 59
    expect(illq.illiquide_flag).toBe(true);
    expect(illq.classement_a_rang).toBeNull();
    expect(soli.classement_a_rang).toBe(1);
    expect(illq.sous_scores.plafonne_par_confiance).toBe(true);
    if (illq.score_opportunite != null) expect(illq.score_opportunite).toBeLessThanOrEqual(59);
    expect(illq.categorie).not.toBe('qualite_elevee');

    // Banque : pas de gearing industriel ni P/S, indicateurs bancaires renseignés, décrochage anormal expliqué
    expect(bank.fondamentaux.gearing_pct).toBeNull();
    expect(bank.fondamentaux.price_to_sales).toBeNull();
    expect(bank.fondamentaux.pnb).toBe(20e9);
    expect(bank.fondamentaux.ratio_solvabilite_pct).toBe(13.5);
    expect(bank.decrochage_anormal).toBe(true);
    expect(bank.explication_decrochage.facteurs_observes.some((f) => f.type === 'baisse_resultats')).toBe(true);

    // Agrégation sectorielle : contribution != performance brute
    const secs = agregerSecteursStress(res);
    const secBank = secs.find((s) => s.secteur === 'Services financiers')!;
    expect(secBank.contribution_1m_pts).not.toBeNull();
    expect(Math.abs(secBank.contribution_1m_pts!)).toBeLessThan(Math.abs(secBank.perf_1m_pct!));
  });
});
