import type { Metadata } from 'next';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { EmptyStatePremium, MetricCard } from '@/components/ui/premium';
import { StressSubNav } from '@/components/stress/StressSubNav';
import { ComparateurStrategies } from '@/components/stress/ComparateurStrategies';
import { chargerBacktestStress } from '@/lib/stress/lectureBacktest';
import { fmtNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Scénarios et stratégies · BRVM Market Stress Monitor',
  description:
    'Backtesting comparatif de stratégies disciplinées en phase de stress BRVM avec frais de transaction, validation walk-forward et zéro anticipation.',
};

export default async function StressStrategiesPage() {
  const access = await canAccess('stress_backtest');
  if (!access.allowed) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <EnTeteCote
          titre="Scénarios & stratégies historiques"
          description="Simulations comparées en phase de correction : seuil unique, paliers, confirmation et portefeuille résilient."
          source="WESTBOURSE"
        />
        <StressSubNav actif="strategies" />
        <AccessGate
          required={access.required === 'disabled' ? 'disabled' : access.required === 'pro' ? 'pro' : 'premium'}
          feature="Simulations de stratégies historiques BRVM"
          hint="Comparez 4 règles disciplinées contre le Buy & Hold avec frais de courtage explicites, validation Out-of-Sample et zéro anticipation."
          from="/stress-monitor/strategies"
        />
      </div>
    );
  }

  const data = await chargerBacktestStress({ indiceCode: 'BRVMC' });
  const nbDispos = data.strategies.filter((s) => s.disponible).length;
  const bh = data.strategies.find((s) => s.id === 'buy_and_hold')?.globale ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <EnTeteCote
        titre="Scénarios & stratégies historiques"
        description="Évaluation descriptive de règles d'entrée pendant les corrections BRVM (net de frais, walk-forward In/Out-of-Sample)."
        seance={data.fin_serie}
        compte={nbDispos > 0 ? { n: nbDispos, libelle: 'simulations actives' } : null}
        source={
          data.source_mode === 'table_precalculee'
            ? 'Snapshot Backtesting BRVM & WESTBOURSE'
            : 'Calcul direct BRVM & WESTBOURSE'
        }
      />

      <StressSubNav actif="strategies" />

      {data.nb_seances === 0 ? (
        <div className="mt-8">
          <EmptyStatePremium
            title="Aucune série historique disponible"
            hint="Exécutez `stress:import-indices` puis `stress:backtest` pour générer les courbes comparatives."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Stratégies évaluées"
              value={fmtNumber(nbDispos, 0)}
              unit={`sur ${data.strategies.length}`}
              accent="gold"
            />
            <MetricCard
              label="Frais modélisés"
              value={`${fmtNumber(data.frais_aller_retour_pct, 1)} %`}
              delta="Aller-retour standard BRVM"
              deltaDir="flat"
            />
            <MetricCard
              label="Découpage Walk-Forward"
              value="2018+"
              delta="In-Sample < 2018 · OOS ≥ 2018"
              deltaDir="flat"
            />
            <MetricCard
              label="Drawdown max Buy & Hold"
              value={bh ? `${fmtNumber(bh.drawdown_max_pct, 1)} %` : '—'}
              delta={bh?.cagr_pct != null ? `CAGR ${fmtNumber(bh.cagr_pct, 2)} %` : undefined}
              deltaDir="down"
            />
          </div>

          <ComparateurStrategies initialData={data} />

          <p className="rounded-card border border-border bg-surface p-4 text-xs leading-relaxed text-muted">
            Avertissement : ces simulations rétrospectives sont fournies à des fins strictement analytiques et
            pédagogiques. Elles ne constituent ni une promesse de rendement futur, ni une recommandation
            d&apos;investissement ou de market timing.
          </p>
        </div>
      )}
    </div>
  );
}
