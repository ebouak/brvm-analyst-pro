import { BacktestInfographic } from '@/components/backtest/backtest-infographic';
import { mockBacktestReportBICC } from '@/data/mock-backtest-report';

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
