// frontend/app/landing-preview/page.tsx
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { TasteTopbar } from '@/components/landing/taste/TasteTopbar';
import { HeroDeviceMockup } from '@/components/landing/HeroDeviceMockup';
import RatingBadge from '@/components/RatingBadge';
import NewsTicker from '@/components/NewsTicker';
import NewsletterForm from '@/components/NewsletterForm';
import { LandingIndices } from '@/components/landing/LandingIndices';
import LandingHeatmap from '@/components/landing/LandingHeatmap';
import { loadHeatmap } from '@/lib/heatmapData';
import type { HeatmapNode } from '@/lib/heatmap';
import { SocialProof } from '@/components/landing/SocialProof';
import { LandingFaq } from '@/components/landing/LandingFaq';
import Footer from '@/components/Footer';
import { fmtNumber } from '@/lib/format';
import type { TickItem } from '@/components/landing/taste/types';
import type { RealtimeActionRow } from '@/lib/realtime/mergeActions';
import type { IndiceDaily } from '@/lib/types';

// Preview isolée — jamais indexée, jamais liée depuis la nav publique.
export const metadata = {
  title: 'WESTBOURSE — Aperçu refonte landing (non publié)',
  robots: { index: false, follow: false },
};

const nf = (n: number, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });

interface MoverRow {
  code: string;
  cours: number | null;
  pct: number;
  score: number | null;
  confiance: number | null;
}

async function getPreviewData() {
  const supabase = createPublicClient();

  const { data: lastDay } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const asOf = (lastDay?.date_marche as string | undefined) ?? null;

  let ticks: TickItem[] = [];
  let tickerRows: RealtimeActionRow[] = [];
  let hausses: MoverRow[] = [];
  let baisses: MoverRow[] = [];
  let nbActions = 0;
  let volumeTotal = 0;

  let indices: IndiceDaily[] = [];
  const { data: lastIdx } = await supabase
    .from('brvm_indices_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const idxDate = (lastIdx?.date_marche as string | undefined) ?? null;
  if (idxDate) {
    const { data: idxRows } = await supabase.from('brvm_indices_daily').select('*').eq('date_marche', idxDate);
    indices = (idxRows ?? []) as IndiceDaily[];
  }

  if (asOf) {
    const [{ data: rows }, { data: sigs }] = await Promise.all([
      supabase
        .from('brvm_actions_daily')
        .select('code, cours_jour, variation_pct, volume')
        .eq('date_marche', asOf)
        .order('variation_pct', { ascending: false }),
      supabase.from('signals_daily').select('code, score_total, confiance').eq('date_marche', asOf),
    ]);
    const all = (rows ?? []) as { code: string; cours_jour: number | null; variation_pct: number | null; volume: number | null }[];
    nbActions = all.length;
    volumeTotal = all.reduce((s, r) => s + (r.volume ?? 0), 0);
    const sigByCode = new Map((sigs ?? []).map((s) => [s.code as string, s]));
    const withVar = all.filter((r) => r.variation_pct != null);
    const toRow = (r: (typeof all)[number]): MoverRow => ({
      code: r.code,
      cours: r.cours_jour,
      pct: r.variation_pct ?? 0,
      score: (sigByCode.get(r.code)?.score_total as number | undefined) ?? null,
      confiance: (sigByCode.get(r.code)?.confiance as number | undefined) ?? null,
    });
    hausses = withVar.filter((r) => (r.variation_pct ?? 0) > 0).slice(0, 5).map(toRow);
    baisses = withVar.filter((r) => (r.variation_pct ?? 0) < 0).slice(-5).reverse().map(toRow);
    const tickSource = [...hausses, ...baisses];
    ticks = tickSource.map((m) => ({
      sym: m.code,
      val: m.cours != null ? nf(m.cours) : '—',
      dir: m.pct >= 0 ? ('up' as const) : ('down' as const),
      pct: `${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(2)}%`,
    }));
    tickerRows = tickSource.map((m) => ({ code: m.code, cours_jour: m.cours, variation_pct: m.pct }));
  }

  let heatmapRows: HeatmapNode[] = [];
  try {
    const { rows } = await loadHeatmap(supabase);
    heatmapRows = rows;
  } catch {
    /* pas de cartographie si données indisponibles */
  }

  return { asOf, ticks, tickerRows, hausses, baisses, nbActions, volumeTotal, indices, heatmapRows };
}

// Clé de cache distincte de 'landing-data' (production) — aucune interférence
// possible entre le cache de / et celui de /landing-preview.
const getCachedPreviewData = unstable_cache(getPreviewData, ['landing-preview-data'], { revalidate: 300 });

function MoverLine({ m }: { m: MoverRow }) {
  const up = m.pct >= 0;
  return (
    <Link
      href={`/societes/${m.code}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:border-accent/30 hover:bg-white/[0.04]"
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <span className="font-mono text-sm font-bold text-ivory">{m.code}</span>
        <RatingBadge scoreTotal={m.score} confiance={m.confiance} />
      </span>
      <span className="flex items-baseline gap-3 shrink-0">
        <span className="tabular text-sm text-ivory">{m.cours != null ? nf(m.cours) : '—'}</span>
        <span className={`tabular text-xs font-bold ${up ? 'text-up' : 'text-down'}`}>
          {up ? '+' : ''}{m.pct.toFixed(2)}%
        </span>
      </span>
    </Link>
  );
}

export default async function LandingPreview() {
  const { asOf, ticks, tickerRows, hausses, baisses, nbActions, volumeTotal, indices, heatmapRows } =
    await getCachedPreviewData();

  const dateLabel = asOf
    ? new Date(asOf).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="relative z-10 mx-auto max-w-content px-4 pb-12">
      <div className="mb-4 rounded-xl border border-gold-2/40 bg-gold-2/10 px-4 py-2 text-center text-xs text-gold-2">
        Aperçu de refonte — non publié, non indexé, aucune donnée de production modifiée.
      </div>

      <TasteTopbar ticks={ticks} liveRows={tickerRows} dateMarche={asOf} />

      <HeroDeviceMockup
        dateLabel={dateLabel}
        ticks={ticks}
        brvmC={(indices.find((i) => i.code === 'BRVMC')?.valeur as number | undefined) ?? null}
        topMover={
          hausses[0]
            ? { code: hausses[0].code, score: hausses[0].score, confiance: hausses[0].confiance }
            : baisses[0]
              ? { code: baisses[0].code, score: baisses[0].score, confiance: baisses[0].confiance }
              : null
        }
      />

      {/* ToolsGrid, RatingSpotlight, DiagnosticSpotlight, PremiumCompare : Tasks 3-6 */}

      <section className="mt-10">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <p className="overline text-gold-2">Marché en direct</p>
          <span className="overline text-faint">Données réelles de la dernière séance</span>
        </div>

        <NewsTicker className="-mx-4 rounded-none sm:mx-0 sm:rounded-xl" />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-panel border border-white/10 bg-white/[0.02] p-5">
            <p className="overline mb-3 text-up">Top hausses</p>
            <div className="space-y-2">
              {hausses.length > 0 ? hausses.map((m) => <MoverLine key={m.code} m={m} />) : (
                <p className="py-6 text-center text-xs text-faint">Aucune hausse signée cette séance.</p>
              )}
            </div>
          </div>
          <div className="rounded-panel border border-white/10 bg-white/[0.02] p-5">
            <p className="overline mb-3 text-gold-2">BRVM-C</p>
            <p className="tabular font-display text-3xl text-ivory">
              {indices.find((i) => i.code === 'BRVMC')?.valeur != null
                ? nf(indices.find((i) => i.code === 'BRVMC')!.valeur as number, 2)
                : '—'}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3">
              <div>
                <dt className="sr-only">sociétés suivies</dt>
                <dd className="tabular font-display text-lg text-ivory">{nbActions > 0 ? nbActions : '—'}</dd>
                <dd className="mt-0.5 text-[10px] text-faint">sociétés suivies</dd>
              </div>
              <div>
                <dt className="sr-only">titres échangés</dt>
                <dd className="tabular font-display text-lg text-ivory">{volumeTotal > 0 ? fmtNumber(volumeTotal) : '—'}</dd>
                <dd className="mt-0.5 text-[10px] text-faint">titres échangés</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-panel border border-white/10 bg-white/[0.02] p-5">
            <p className="overline mb-3 text-down">Top baisses</p>
            <div className="space-y-2">
              {baisses.length > 0 ? baisses.map((m) => <MoverLine key={m.code} m={m} />) : (
                <p className="py-6 text-center text-xs text-faint">Aucune baisse signée cette séance.</p>
              )}
            </div>
          </div>
          <div className="rounded-panel border border-white/10 bg-white/[0.02] p-5">
            <p className="overline mb-3 text-gold-2">Indices BRVM</p>
            <LandingIndices indices={indices} />
          </div>
        </div>

        <LandingHeatmap rows={heatmapRows} dateLabel={dateLabel} />
      </section>

      <SocialProof />
      <LandingFaq />

      <section className="mt-10">
        <NewsletterForm source="landing-preview" />
      </section>

      <Footer />
    </div>
  );
}
