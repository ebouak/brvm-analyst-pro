import type { BacktestReport } from '@/types/backtest';

export const mockBacktestReportBICC: BacktestReport = {
  meta: {
    instrumentCode: 'BICC',
    instrumentName: 'BICICI',
    startDate: '2026-01-01',
    endDate: '2026-06-14',
    periodLabel: '3 mois',
    feesPct: 0.6,
    tradesCount: 6,
    isShortHistory: true,
  },
  performance: {
    totalReturnPct: 92.8,
    annualizedReturnPct: 343.7,
    buyAndHoldReturnPct: 47.6,
    marketReturnPct: 53.0,
    riskFreeReturnPct: 2.6,
  },
  risk: {
    maxDrawdownPct: -2.3,
    volatilityPct: 21.4,
    sharpe: 15.77,
    sortino: 97.26,
    calmar: 148.93,
    winRatePct: 40,
    riskLevel: 'low',
  },
  trades: [
    { id: 1, entryDate: '2026-02-09', exitDate: '2026-02-27', durationDays: 14, returnPct: 24.6, result: 'winner' },
    { id: 2, entryDate: '2026-03-12', exitDate: '2026-03-13', durationDays: 1, returnPct: -4.5, result: 'loser' },
    { id: 3, entryDate: '2026-03-25', exitDate: '2026-04-01', durationDays: 5, returnPct: -3.8, result: 'loser' },
    { id: 4, entryDate: '2026-04-14', exitDate: '2026-04-22', durationDays: 6, returnPct: 1.8, result: 'winner' },
    { id: 5, entryDate: '2026-04-27', exitDate: '2026-05-05', durationDays: 5, returnPct: -1.0, result: 'loser' },
    { id: 6, entryDate: '2026-05-06', exitDate: null, durationDays: 26, returnPct: 12.6, result: 'open' },
  ],
  strategyRule: {
    label: 'Signal momentum : variation du cours',
    buyCondition: 'variation > 2 % → ACHAT',
    sellCondition: 'variation < -2 % → VENTE',
    holdCondition: 'sinon → CONSERVER',
  },
  summary: {
    keyMessage:
      'Stratégie convaincante : elle bat le marché et le Buy & Hold avec un risque maîtrisé sur la période testée.',
    bullets: [
      'Sur la période, la stratégie affiche +92,8 % contre +47,6 % en Buy & Hold.',
      'Le risque observé reste limité avec une baisse maximale d’environ 2,3 %.',
      'Historique court (6 trades) : résultats encourageants mais à confirmer sur un échantillon plus large.',
    ],
    warning: 'Les performances passées ne garantissent pas les performances futures.',
  },
};
