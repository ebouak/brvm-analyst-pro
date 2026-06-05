'use client';

import type { DashboardStats } from '@/lib/portfolio/queries';
import { fmtNumber, fmtFcfa } from '@/lib/format';

interface Props {
  stats: DashboardStats | null;
  isLoading: boolean;
}

/**
 * KPI Card wrapper component
 */
function KpiCard({
  icon,
  title,
  value,
  subtitle,
  color = 'text-white',
}: {
  icon: string;
  title: string;
  value: string;
  subtitle: string;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-muted uppercase tracking-wide">{title}</span>
      </div>
      <div className={`text-3xl font-bold tabular ${color}`}>{value}</div>
      <div className="text-xs text-muted">{subtitle}</div>
    </div>
  );
}

/**
 * Loading skeleton for KPI card
 */
function KpiSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 animate-pulse">
      <div className="h-4 bg-elevated rounded w-24 mb-3"></div>
      <div className="h-8 bg-elevated rounded w-32 mb-3"></div>
      <div className="h-3 bg-elevated rounded w-full"></div>
    </div>
  );
}

/**
 * Format percentage with color
 */
function formatPercentage(value: number | null): { formatted: string; color: string } {
  if (value === null || value === 0) {
    return { formatted: '—', color: 'text-muted' };
  }
  const sign = value >= 0 ? '+' : '';
  const formatted = `${sign}${(value * 100).toFixed(2)}%`;
  const color = value >= 0 ? 'text-up' : 'text-down';
  return { formatted, color };
}

/**
 * Format month name from ISO date
 */
function formatMonthName(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const month = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    return month;
  } catch {
    return '—';
  }
}

/**
 * 6 responsive KPI cards for dashboard
 * Grid: 3 columns (lg), 2 (md), 1 (sm)
 */
export default function DashboardKPIs({ stats, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="col-span-full bg-surface border border-border rounded-xl p-4 text-center text-muted">
          Aucune donnée disponible
        </div>
      </div>
    );
  }

  // Card 1: Indice Base 100
  const indiceColor = stats.currentIndex === null ? 'text-muted' : stats.currentIndex >= 100 ? 'text-up' : 'text-down';
  const indiceValue = stats.currentIndex === null ? '—' : stats.currentIndex.toFixed(2);

  // Card 2: Performance Totale
  const perfTotalPercentage = formatPercentage(stats.totalPerf);

  // Card 3: Performance YTD
  const ytdPercentage = formatPercentage(stats.ytdPerf);

  // Card 4: Valeur Portefeuille
  const portfolioValue = stats.currentValue === null ? '—' : fmtNumber(stats.currentValue, 0);

  // Card 5: Dernier Mois
  const lastMonthName = stats.lastMonth ? formatMonthName(stats.lastMonth.date) : '—';
  const lastMonthPerf = formatPercentage(stats.lastMonth?.performance_mensuelle ?? null);

  // Card 6: Mois de Suivi
  const totalMonths = 60; // Per spec: total months = 60
  const progressPercent = stats.monthsTracked > 0 ? (stats.monthsTracked / totalMonths) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Card 1 - Indice Base 100 */}
      <KpiCard
        icon="📊"
        title="Indice Base 100"
        value={indiceValue}
        subtitle="Départ = 100 | >100 = gain | <100 = perte"
        color={indiceColor}
      />

      {/* Card 2 - Performance Totale */}
      <KpiCard
        icon="📈"
        title="Perf. Totale"
        value={perfTotalPercentage.formatted}
        subtitle="Depuis le début du suivi"
        color={perfTotalPercentage.color}
      />

      {/* Card 3 - Performance YTD */}
      <KpiCard
        icon="📅"
        title={`Perf. Année en Cours (YTD)`}
        value={ytdPercentage.formatted}
        subtitle={`Année ${new Date().getFullYear()}`}
        color={ytdPercentage.color}
      />

      {/* Card 4 - Valeur Portefeuille */}
      <KpiCard
        icon="💰"
        title="Valeur Portefeuille"
        value={portfolioValue}
        subtitle="FCFA"
      />

      {/* Card 5 - Dernier Mois */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <span className="text-xs text-muted uppercase tracking-wide">Dernier Mois</span>
        </div>
        <div className="text-3xl font-bold tabular text-white">{lastMonthName}</div>
        <div className={`text-sm font-semibold tabular ${lastMonthPerf.color}`}>
          {lastMonthPerf.formatted}
        </div>
        <div className="text-xs text-muted">Perf du mois</div>
      </div>

      {/* Card 6 - Mois de Suivi */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="text-xs text-muted uppercase tracking-wide">Mois de Suivi</span>
        </div>
        <div className="text-3xl font-bold tabular text-white">
          {stats.monthsTracked} / {totalMonths}
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-up transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        <div className="text-xs text-muted">mois saisis / 60 total</div>
      </div>
    </div>
  );
}
