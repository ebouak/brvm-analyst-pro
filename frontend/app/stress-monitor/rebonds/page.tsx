import type { Metadata } from 'next';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { EmptyStatePremium, MetricCard } from '@/components/ui/premium';
import { StressSubNav } from '@/components/stress/StressSubNav';
import { MatriceRebonds } from '@/components/stress/MatriceRebonds';
import { chargerBacktestStress } from '@/lib/stress/lectureBacktest';
import { fmtDateCourte, fmtNumber, fmtPctSigne } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Statistiques de rebond · BRVM Market Stress Monitor',
  description:
    'Performances historiques à 1, 3, 6, 12 et 24 mois après chaque palier de correction de la BRVM, avec dé-chevauchement statistique et intervalles bootstrap 95 %.',
};

export default async function StressRebondsPage() {
  const access = await canAccess('stress_backtest');
  if (!access.allowed) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <EnTeteCote
          titre="Statistiques historiques de rebond"
          description="Performances observées à 1, 3, 6, 12 et 24 mois après chaque seuil de drawdown BRVM."
          source="WESTBOURSE"
        />
        <StressSubNav actif="rebonds" />
        <AccessGate
          required={access.required === 'disabled' ? 'disabled' : access.required === 'pro' ? 'pro' : 'premium'}
          feature="Backtesting historique des rebonds BRVM"
          hint="Accédez aux distributions à 1/3/6/12/24 mois, intervalles bootstrap 95 %, délais de récupération et observations indépendantes depuis 2007."
          from="/stress-monitor/rebonds"
        />
      </div>
    );
  }

  const data = await chargerBacktestStress({ indiceCode: 'BRVMC' });
  const ddActuel = data.drawdown_actuel_pct ?? -10;
  const palierProche =
    data.stats_seuils.filter((s) => ddActuel <= s.seuil_pct).at(-1) ??
    data.stats_seuils.find((s) => s.seuil_pct === -15) ??
    null;
  const h12 = palierProche?.horizons.find((h) => h.horizon_mois === 12)?.independant ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <EnTeteCote
        titre="Statistiques historiques de rebond"
        description="Distribution des performances post-correction à 1, 3, 6, 12 et 24 mois, sans chevauchement de fenêtres."
        seance={data.fin_serie}
        compte={data.nb_seances > 0 ? { n: data.nb_seances, libelle: 'séances analysées' } : null}
        source={
          data.source_mode === 'table_precalculee'
            ? 'Snapshot Backtesting BRVM & WESTBOURSE'
            : 'Calcul direct BRVM & WESTBOURSE'
        }
      />

      <StressSubNav actif="rebonds" />

      {data.nb_seances === 0 ? (
        <div className="mt-8">
          <EmptyStatePremium
            title="Aucune série historique disponible"
            hint="Importez d'abord les indices historiques (`stress:import-indices`) puis exécutez `stress:backtest`."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Historique couvert"
              value={data.debut_serie ? `${data.debut_serie.slice(0, 4)}–${data.fin_serie?.slice(0, 4)}` : '—'}
              delta={
                data.debut_serie && data.fin_serie
                  ? `${fmtDateCourte(data.debut_serie)} → ${fmtDateCourte(data.fin_serie)}`
                  : undefined
              }
              deltaDir="flat"
              accent="gold"
            />
            <MetricCard
              label="Drawdown actuel BRVMC"
              value={data.drawdown_actuel_pct != null ? fmtPctSigne(data.drawdown_actuel_pct, 2) : '—'}
              delta={palierProche ? `Palier comparable : ${palierProche.seuil_pct} %` : undefined}
              deltaDir={(data.drawdown_actuel_pct ?? 0) < 0 ? 'down' : 'flat'}
            />
            <MetricCard
              label="Médiane historique +12M"
              value={h12?.mediane_pct != null ? fmtPctSigne(h12.mediane_pct, 1) : '—'}
              delta={
                h12?.proba_positif_pct != null
                  ? `${fmtNumber(h12.proba_positif_pct, 0)} % issues > 0`
                  : undefined
              }
              deltaDir={(h12?.mediane_pct ?? 0) > 0 ? 'up' : 'flat'}
            />
            <MetricCard
              label="Échantillon indépendant (+12M)"
              value={h12 ? `${fmtNumber(h12.n, 0)} ép.` : '—'}
              delta={
                h12?.echantillon_faible
                  ? 'Échantillon faible (N < 5)'
                  : `Statut : ${h12?.statut_statistique ?? '—'}`
              }
              deltaDir="flat"
            />
          </div>

          <MatriceRebonds initialData={data} />

          <p className="rounded-card border border-border bg-surface p-4 text-xs leading-relaxed text-muted">
            Avertissement : les performances historiques mesurées après une baisse ne préjugent pas des performances
            futures. Les indices BRVM affichés sont des indices de prix (hors dividendes réinvestis) et un faible
            nombre d&apos;épisodes historiques (N &lt; 5) interdit toute conclusion statistique.
          </p>
        </div>
      )}
    </div>
  );
}
