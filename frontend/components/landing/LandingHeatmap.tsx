import Link from 'next/link';
import HeatmapTreemap from '@/components/HeatmapTreemap';
import brvmLogos from '@/lib/brvmLogos.json';
import type { HeatmapNode } from '@/lib/heatmap';

/**
 * Section landing : cartographie du marché BRVM (treemap façon TradingView,
 * taille = capitalisation, couleur = variation du jour). Données réelles de la
 * dernière séance. Masquée si aucune donnée (jamais de bloc vide).
 */
export default function LandingHeatmap({ rows, dateLabel }: { rows: HeatmapNode[]; dateLabel: string | null }) {
  if (!rows.length) return null;

  return (
    <section className="mt-10 overflow-hidden rounded-panel border border-white/10 bg-white/[0.02] p-6 md:p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="overline mb-2 text-gold-2">Cartographie du marché</p>
          <h2 className="font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
            Toute la cote BRVM, d&apos;un coup d&apos;œil.
          </h2>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">
            Chaque société dimensionnée par sa capitalisation, colorée selon sa variation du jour —
            regroupée par secteur. {dateLabel ? `Séance du ${dateLabel}.` : ''}
          </p>
        </div>
        <Link
          href="/heatmap"
          className="inline-flex min-h-[44px] items-center rounded-full border border-white/10 bg-white/[0.03] px-5 text-sm font-medium text-ivory transition-all hover:border-accent/40 hover:bg-white/[0.06]"
        >
          Ouvrir la heatmap →
        </Link>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-2">
        <HeatmapTreemap data={rows} height={420} logos={brvmLogos as Record<string, string>} />
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-faint">
        Données réelles de la dernière séance · taille = capitalisation boursière (à défaut, valeur échangée) ·
        cliquez une société pour sa fiche.
      </p>
    </section>
  );
}
