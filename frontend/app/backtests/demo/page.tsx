import { BacktestInfographic } from '@/components/backtest/backtest-infographic';
import { mockBacktestReportBICC } from '@/data/mock-backtest-report';
import { AnimatedValue } from '@/components/AnimatedValue';

export const metadata = { title: 'Infographie de backtest — démo' };

/**
 * Page de démonstration du système d'infographie de backtest.
 * Affiche la variante « full » (rapport) puis la variante « compact » (dashboard).
 * Thème clair, indépendant du thème sombre du reste de l'application.
 */
export default function BacktestDemoPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-10">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Infographie de backtest</h1>
          <p className="mt-1 text-sm text-gray-500">Système de composants clairs et pédagogiques — deux variantes.</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Chiffres animés (comptage flou)</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="animated-kpis">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Valorisation</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
                <AnimatedValue value={34250000} format={{ maximumFractionDigits: 0 }} suffix=" FCFA" />
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">P&L latent</p>
              <p className="mt-1 text-2xl font-semibold text-green-700 tabular-nums">
                <AnimatedValue value={1650000} format={{ maximumFractionDigits: 0 }} suffix=" FCFA" signed />
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Rendement</p>
              <p className="mt-1 text-2xl font-semibold text-green-700 tabular-nums">
                <AnimatedValue value={92.8} format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} suffix="%" signed />
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Variante « full » (rapport)</h2>
          <BacktestInfographic report={mockBacktestReportBICC} variant="full" />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Variante « compact » (dashboard)</h2>
          <BacktestInfographic report={mockBacktestReportBICC} variant="compact" />
        </section>
      </div>
    </main>
  );
}
