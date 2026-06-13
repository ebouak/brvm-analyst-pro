import { getCorrelationsData, getAgroNews } from '@/lib/premium/correlations';
import CorrelationsCharts from '@/components/premium/CorrelationsCharts';
import { fmtDateFR } from '@/lib/format';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  StatPill,
} from '@/components/ui/premium';

export const revalidate = 3600;

export default async function CorrelationsPage() {
  const [series, news] = await Promise.all([getCorrelationsData(), getAgroNews()]);

  const available = series.filter((s) => s.dataAvailable);
  const maxCorr = available.reduce(
    (best, s) => (Math.abs(s.coefficient) > Math.abs(best.coefficient) ? s : best),
    available[0] ?? { commodityLabel: '—', coefficient: 0 },
  );
  const avgCorr =
    available.length > 0
      ? available.reduce((s, c) => s + Math.abs(c.coefficient), 0) / available.length
      : 0;

  const corrSign = maxCorr.coefficient >= 0 ? '+' : '';

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <SectionHeader
        kicker="Intelligence de marché"
        title="Corrélation Matières Premières"
        subtitle="Relation entre le cours des actions BRVM et les matières premières sous-jacentes — huile de palme, caoutchouc, sucre, cacao."
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Filières analysées"
          value={`${available.length}/${series.length}`}
          delta="filières agro-industrielles BRVM"
          deltaDir="flat"
          accent="sapphire"
        />
        <MetricCard
          label="Plus forte corrélation"
          value={available.length ? `${corrSign}${maxCorr.coefficient.toFixed(2)}` : '—'}
          delta={maxCorr.commodityLabel}
          deltaDir={maxCorr.coefficient >= 0 ? 'up' : 'down'}
          accent="emerald"
        />
        <MetricCard
          label="Corrélation moyenne"
          value={available.length ? avgCorr.toFixed(2) : '—'}
          delta="variations mensuelles (Pearson)"
          deltaDir="flat"
          accent="gold"
        />
      </div>

      {/* ── Séparateur éditorial ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gold/50">
          Analyse graphique
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── Graphiques (client component) ────────────────────────────────── */}
      <PremiumPanel glow className="p-5">
        <CorrelationsCharts series={series} />
      </PremiumPanel>

      {/* ── Actualité & publications des sociétés agro ───────────────────── */}
      {news.length > 0 && (
        <PremiumPanel className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gold/60 mb-4">
            Actualité des sociétés agro
          </p>
          <ul className="space-y-2">
            {news.map((n, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-border/40 pb-2 last:border-0">
                <span className="tabular text-[11px] text-faint shrink-0 mt-0.5 w-20">{fmtDateFR(n.date)}</span>
                {n.code && (
                  <a href={`/actions/${n.code}`} className="font-mono text-xs font-bold text-gold shrink-0 hover:text-gold-soft">
                    {n.code}
                  </a>
                )}
                <span className="text-xs text-muted leading-relaxed flex-1">{n.title}</span>
                <span className="text-[10px] text-faint shrink-0">{n.source}</span>
              </li>
            ))}
          </ul>
        </PremiumPanel>
      )}

    </div>
  );
}
