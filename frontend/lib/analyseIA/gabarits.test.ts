import { describe, it, expect } from 'vitest';
import {
  dateLongue,
  montant,
  gabaritActualites,
  gabaritComptes,
  gabaritConseil,
  gabaritCoursJour,
  gabaritDividendes,
  gabaritHistorique,
  gabaritLiquidite,
  gabaritTechnique,
} from './gabarits';
import { resumerHistorique } from './historique';

const v = { code: 'STAC', nom: 'SETAO CI' };
const espaces = (s: string) => s.replace(/[  ]/g, ' ');

describe('formats', () => {
  it('dates et montants', () => {
    expect(dateLongue('2026-11-01')).toBe('1er novembre 2026');
    expect(dateLongue('2026-11-06')).toBe('6 novembre 2026');
    expect(espaces(montant(2_550_000_000))).toBe('2,55 Md FCFA');
    expect(espaces(montant(12_340_000))).toBe('12,3 M FCFA');
    expect(espaces(montant(1234))).toBe('1 234 FCFA');
  });
});

describe('gabarits Jev', () => {
  it('cours du jour : chiffres lus, sens dit en mots', () => {
    const t = espaces(
      gabaritCoursJour(v, { code: 'STAC', societe: 'SETAO CI', seance: '2026-11-06', cours: 1250, variation_pct: 1.21, cours_precedent: 1235, volume: 300, valeur_echangee: 375000 }),
    );
    expect(t).toContain('6 novembre 2026');
    expect(t).toContain('1 250 FCFA');
    expect(t).toContain('en hausse de 1,21 %');
    expect(t).toContain('1 235 FCFA');
    expect(t).toContain('300 titres ont été échangés');
  });
  it('cours absent ⇒ le dire', () => {
    expect(gabaritCoursJour(v, null)).toMatch(/Aucune cotation/);
  });
  it('historique', () => {
    const r = resumerHistorique(
      [
        { date: '2025-11-07', cours: 1000, volume: 10, variation_pct: null },
        { date: '2026-03-02', cours: 1400, volume: 10, variation_pct: 5 },
        { date: '2026-11-06', cours: 1250, volume: 10, variation_pct: -1 },
      ],
      null,
    );
    const t = espaces(gabaritHistorique(v, r, null));
    expect(t).toContain('toute la période');
    expect(t).toContain('+25,00 %');
    expect(t).toContain('Plus haut : 1 400 FCFA le 2 mars 2026');
    expect(t).toContain('Par année civile');
    expect(gabaritHistorique(v, null, 365)).toMatch(/pas assez de séances/);
  });
  it('actualités et publications', () => {
    const t = gabaritActualites(v, [{ titre: 'AG ordinaire', date: '2026-10-02', source: 'BRVM' }], [{ libelle: 'États financiers 2025', date: '2026-04-30', type: null }]);
    expect(t).toContain('2 octobre 2026 : AG ordinaire (BRVM)');
    expect(t).toContain('États financiers 2025');
    expect(gabaritActualites(v, [], [])).toMatch(/Aucune actualité ni publication/);
  });
  it('dividendes : évolution et rendement seulement sur données comparables', () => {
    const lignes = [
      { exercice: 2024, montant: 110, devise: 'FCFA', ex_date: '2025-07-01', payment_date: null, base_fiscale: 'net' },
      { exercice: 2025, montant: 121, devise: 'FCFA', ex_date: null, payment_date: '2026-08-04', base_fiscale: 'net' },
    ];
    const t = espaces(gabaritDividendes(v, lignes, 1210));
    expect(t.indexOf('2025')).toBeLessThan(t.indexOf('2024'));
    expect(t).toContain('en hausse de 10,00 %');
    expect(t).toContain('représente 10,00 %');
    expect(t).toContain('payé le 4 août 2026');
    const melange = gabaritDividendes(v, [lignes[0]!, { ...lignes[1]!, base_fiscale: 'brut' }], null);
    expect(melange).not.toMatch(/en hausse/);
    expect(gabaritDividendes(v, [], 1000)).toMatch(/Aucun dividende/);
  });
  it('comptes : exercice demandé absent ⇒ dit, puis dernier exercice', () => {
    const ex = (exercice: number, rn: number) => ({
      exercice,
      revenu_total: 10_000_000_000,
      resultat_exploitation: null,
      resultat_net: rn,
      total_actifs: null,
      capitaux_propres: 4_000_000_000,
      dette_financiere: null,
      tresorerie: null,
    });
    const t = espaces(gabaritComptes(v, [ex(2023, -100_000_000), ex(2024, 500_000_000)], 2025));
    expect(t).toContain('Les comptes 2025 de SETAO CI ne sont pas disponibles');
    expect(t).toContain('Comptes annuels 2024');
    expect(t).toContain('500,0 M FCFA (bénéfice)');
    expect(t).toContain('d’une perte à un bénéfice');
    const pertes = espaces(gabaritComptes(v, [ex(2024, -400_000_000), ex(2025, -100_000_000)], null));
    expect(pertes).toContain('résultat net : perte réduite de 75,00 %');
    expect(espaces(gabaritDividendes(v, [{ exercice: 2021, montant: 66.15, devise: 'XOF', ex_date: null, payment_date: null, base_fiscale: 'net' }], null))).toContain('66,15 FCFA');
    expect(t).not.toContain('Résultat d’exploitation');
    expect(gabaritComptes(v, [], null)).toMatch(/Aucun compte/);
  });
  it('technique : constats, avertissement', () => {
    const t = gabaritTechnique(v, {
      seance: '2026-11-06',
      seances_utilisees: 200,
      cours: 1250,
      rsi14: 72.3,
      zone_rsi: 'haute',
      macd: 4.1,
      signal_macd: 3.2,
      position_macd: 'au-dessus',
      mm20: 1200,
      mm50: 1300,
    });
    expect(t).toContain('zone haute');
    expect(t).toContain('au-dessus de sa ligne de signal');
    expect(t).toContain('en dessous de sa moyenne mobile 50');
    expect(t).toMatch(/ne prévoient pas/);
    expect(gabaritTechnique(v, null)).toMatch(/trop court/);
  });
  it('liquidité et carnet', () => {
    const t = espaces(
      gabaritLiquidite(
        v,
        { date: '2026-11-06', score: 64, classe: 'B', presence_pct: 78, valeur_moyenne_30j: 12_300_000, spread_pct: 1.2, spread_source: 'carnet' },
        { date: '2026-11-06', achat: { au_marche: false, cours: 1240, quantite: 500 }, vente: null },
      ),
    );
    expect(t).toContain('classe B, score 64 sur 100');
    expect(t).toContain('mesuré sur le carnet');
    expect(t).toContain('meilleure demande 1 240 FCFA pour 500 titres ; meilleure offre aucune');
  });
  it('conseil : refus sans chiffre', () => {
    const t = gabaritConseil(v);
    expect(t).toMatch(/ne donne pas de recommandation/);
    expect(t).not.toMatch(/\d/);
  });
});
