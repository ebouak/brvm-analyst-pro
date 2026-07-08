'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { MetricCard, PremiumPanel, EmptyStatePremium, SectionHeader } from '@/components/ui/premium';
import type {
  JobRunRow,
  PatternErrorRow,
  PatternScoreRow,
  IntraDayMonitoringDashboard,
} from '@/lib/admin/intraday-monitoring';

const DASH = '—';

function fmtDateTime(d: string | null): string {
  if (!d) return DASH;
  try {
    const p = new Date(d);
    if (Number.isNaN(p.getTime())) return DASH;
    return p.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return DASH;
  }
}

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  try {
    const p = new Date(d + 'T00:00:00Z');
    if (Number.isNaN(p.getTime())) return DASH;
    return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return DASH;
  }
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return DASH;
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: 'text-up',
  PARTIAL: 'text-warn',
  FAILED: 'text-down',
  RUNNING: 'text-info',
};

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: 'Succès',
  PARTIAL: 'Partiel',
  FAILED: 'Échec',
  RUNNING: 'En cours',
};

const PHASE_LABEL: Record<string, string> = {
  integrity_check: 'Vérification intégrité',
  reconstruct: 'Reconstruction',
  detect_raw: 'Détection brute',
  qualify: 'Qualification',
  aggregate: 'Agrégation',
};

interface Props extends IntraDayMonitoringDashboard {}

export default function IntraDayMonitoringDashboard({
  runs,
  errors,
  scores,
  kpis,
}: Props) {
  // Build trend data for chart
  const trendData = scores
    .sort((a, b) => a.date_marche.localeCompare(b.date_marche))
    .map(s => ({
      date: fmtDate(s.date_marche),
      count: s.patterns_detected_count || 0,
    }));

  // Alert logic
  const hasFailures = kpis.failed_count > 0;
  const errorRate = kpis.runs24h > 0 ? (kpis.failed_count / kpis.runs24h) * 100 : 0;
  const hasHighErrorRate = errorRate > 20;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {hasFailures && (
        <div className="rounded-panel border border-down/30 bg-down/10 p-4">
          <span className="font-semibold text-down">
            ⚠️ {kpis.failed_count} exécution(s) échouée(s) dans les dernières 24 heures
          </span>
        </div>
      )}

      {hasHighErrorRate && !hasFailures && (
        <div className="rounded-panel border border-warn/30 bg-warn/10 p-4">
          <span className="font-semibold text-warn">⚠️ Taux d'erreur élevé : {errorRate.toFixed(0)}%</span>
        </div>
      )}

      {!hasFailures && !hasHighErrorRate && (
        <div className="rounded-panel border border-up/30 bg-up/10 p-4">
          <span className="font-semibold text-up">✓ Tous les systèmes sont sains</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Exécutions (24h)" value={String(kpis.runs24h)} accent="sapphire" />
        <MetricCard label="Réussies" value={String(kpis.success_count)} accent="emerald" />
        <MetricCard label="Échouées" value={String(kpis.failed_count)} accent="neutral" />
        <MetricCard label="Patterns trouvés" value={String(kpis.patterns_detected)} accent="gold" />
        <MetricCard
          label="Durée moyenne"
          value={kpis.avg_duration_ms != null ? fmtDuration(kpis.avg_duration_ms) : DASH}
          accent="neutral"
        />
      </div>

      {/* Trend Chart */}
      {trendData.length > 0 ? (
        <PremiumPanel>
          <div className="p-4">
            <h3 className="font-semibold text-ivory mb-4">Patterns Détectés (7 derniers jours)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" />
                <YAxis stroke="rgba(255,255,255,0.4)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(10, 20, 23, 0.95)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#FCFCFC' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#56D7FD"
                  strokeWidth={2}
                  dot={{ fill: '#56D7FD', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Patterns"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PremiumPanel>
      ) : null}

      {/* Job Runs Table */}
      <div className="space-y-3">
        <h2 className="text-sm uppercase tracking-wider text-faint font-medium">Exécutions Récentes</h2>
        {runs.length === 0 ? (
          <EmptyStatePremium
            title="Aucune exécution enregistrée"
            hint="Les tâches batch intraday patterns apparaîtront ici une fois lancées."
          />
        ) : (
          <PremiumPanel className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Phase</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Durée</th>
                  <th className="px-4 py-3 font-medium text-right tabular">Entrée</th>
                  <th className="px-4 py-3 font-medium text-right tabular">Sortie</th>
                  <th className="px-4 py-3 font-medium text-right">Erreurs</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-ivory tabular">{fmtDate(run.date_marche)}</td>
                    <td className="px-4 py-2.5 text-muted text-xs">
                      {PHASE_LABEL[run.phase as keyof typeof PHASE_LABEL] ?? run.phase}
                    </td>
                    <td
                      className={`px-4 py-2.5 font-medium ${STATUS_STYLE[run.status] ?? 'text-muted'}`}
                    >
                      {STATUS_LABEL[run.status as keyof typeof STATUS_LABEL] ?? run.status}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted tabular">
                      {fmtDuration(run.duration_ms)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ivory tabular">
                      {run.rows_in ?? DASH}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ivory tabular">
                      {run.rows_out ?? DASH}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {run.errors_count > 0 ? (
                        <span className="font-medium text-down">{run.errors_count}</span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PremiumPanel>
        )}
      </div>

      {/* Error Feed */}
      {errors.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm uppercase tracking-wider text-faint font-medium">Incidents Récents</h2>
          <PremiumPanel className="divide-y divide-border/40 p-0">
            {errors.map(err => (
              <div key={err.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <span className="text-xs font-medium text-faint">
                      {PHASE_LABEL[err.phase as keyof typeof PHASE_LABEL] ?? err.phase}
                    </span>
                    <span className="text-xs font-mono text-down">{err.table_name}</span>
                  </div>
                  <span className="text-xs text-faint tabular whitespace-nowrap">
                    {fmtDateTime(err.created_at)}
                  </span>
                </div>
                <p className="text-xs text-muted break-words leading-relaxed">{err.error_message}</p>
                {err.code && <p className="text-xs text-faint mt-1 font-mono">Code: {err.code}</p>}
              </div>
            ))}
          </PremiumPanel>
        </div>
      )}
    </div>
  );
}
