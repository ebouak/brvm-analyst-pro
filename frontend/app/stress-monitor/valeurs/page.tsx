import type { Metadata } from 'next';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { EmptyStatePremium, MetricCard } from '@/components/ui/premium';
import { StressSubNav } from '@/components/stress/StressSubNav';
import { ClassementsResilience } from '@/components/stress/ClassementsResilience';
import { chargerResilienceScanner } from '@/lib/stress/lectureResilience';
import { fmtNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Stock Resilience Scanner · BRVM Market Stress Monitor',
  description:
    'Classements de résistance, décrochages anormaux, heatmap sectorielle pondérée et analyse fondamentale sectorisée des valeurs de la BRVM.',
};

export default async function StressValeursPage() {
  const access = await canAccess('stress_scanner');
  if (!access.allowed) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <EnTeteCote
          titre="Analyse des valeurs & résilience"
          description="Stock Resilience Scanner : résistance aux corrections, décrochages anormaux et fondamentaux sectorisés."
          source="WESTBOURSE"
        />
        <StressSubNav actif="valeurs" />
        <AccessGate
          required={access.required === 'disabled' ? 'disabled' : access.required === 'pro' ? 'pro' : 'premium'}
          feature="Stock Resilience Scanner"
          hint="Accédez aux classements A/B/C, à la détection des décrochages anormaux, à la heatmap sectorielle pondérée et à l'analyse fondamentale sectorisée complète."
          from="/stress-monitor/valeurs"
        />
      </div>
    );
  }

  const data = await chargerResilienceScanner();
  const nbRepli10 = data.actions.filter((a) => a.drawdown_pct != null && a.drawdown_pct <= -10).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <EnTeteCote
        titre="Analyse des valeurs & résilience"
        description="Stock Resilience Scanner : résistance, décrochages anormaux, heatmap sectorielle et synthèse fondamentale sectorisée."
        seance={data.date_marche}
        compte={data.nb_valeurs > 0 ? { n: data.nb_valeurs, libelle: 'valeurs analysées' } : null}
        source={data.source_mode === 'table_precalculee' ? 'Snapshot BRVM & WESTBOURSE' : 'Calcul direct BRVM & WESTBOURSE'}
      />

      <StressSubNav actif="valeurs" />

      {data.actions.length === 0 ? (
        <div className="mt-8">
          <EmptyStatePremium
            title="Aucune donnée de valeurs disponible"
            hint="Exécutez le scanner (`stress:resilience`) pour alimenter le classement."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Valeurs analysées"
              value={fmtNumber(data.nb_valeurs, 0)}
              unit="actions actives"
              accent="gold"
            />
            <MetricCard
              label="En repli ≥ 10 %"
              value={fmtNumber(nbRepli10, 0)}
              delta="Drawdown depuis le sommet 1 an"
              deltaDir={nbRepli10 > 0 ? 'down' : 'flat'}
            />
            <MetricCard
              label="Décrochages anormaux"
              value={fmtNumber(data.nb_decrochages_anormaux, 0)}
              delta="Écart ≤ −8 pts vs marché"
              deltaDir={data.nb_decrochages_anormaux > 0 ? 'down' : 'flat'}
            />
            <MetricCard
              label="Valeurs peu liquides"
              value={fmtNumber(data.nb_illiquides, 0)}
              delta="Faible variation ≠ solidité"
              deltaDir="flat"
            />
          </div>

          <ClassementsResilience actions={data.actions} secteurs={data.secteurs} />

          <p className="rounded-card border border-border bg-surface p-4 text-xs leading-relaxed text-muted">
            Avertissement : cette vue présente séparément les indicateurs observés (drawdown, écart relatif au marché,
            multiples, ROE, dividende et liquidité) sans score composite ni recommandation d&apos;achat ou de vente. Une
            faible baisse sur une valeur peu liquide ne traduit pas nécessairement une solidité fondamentale.
          </p>
        </div>
      )}
    </div>
  );
}
