// frontend/app/landing-preview/page.tsx
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { TasteTopbar } from '@/components/landing/taste/TasteTopbar';
import { HeroDeviceMockup } from '@/components/landing/HeroDeviceMockup';
import { ToolsGrid } from '@/components/landing/ToolsGrid';
import RatingBadge from '@/components/RatingBadge';
import NewsTicker from '@/components/NewsTicker';
import NewsletterForm from '@/components/NewsletterForm';
import { LandingIndices } from '@/components/landing/LandingIndices';
import LandingHeatmap from '@/components/landing/LandingHeatmap';
import { loadHeatmap } from '@/lib/heatmapData';
import type { HeatmapNode } from '@/lib/heatmap';
import { SocialProof } from '@/components/landing/SocialProof';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { RatingSpotlight } from '@/components/landing/RatingSpotlight';
import { DiagnosticSpotlight } from '@/components/landing/DiagnosticSpotlight';
import { PremiumCompare } from '@/components/landing/PremiumCompare';
import Footer from '@/components/Footer';
import { fmtNumber } from '@/lib/format';
import { simulateInvestment, type PricePoint } from '@/lib/simulate';
import { getSgiDirectory } from '@/lib/sgi-frais/queries';
import { PAYS as SGI_PAYS } from '@/lib/sgi-frais/directory';
import type { TickItem } from '@/components/landing/taste/types';
import type { RealtimeActionRow } from '@/lib/realtime/mergeActions';
import type { IndiceDaily, SignalDaily } from '@/lib/types';

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
  let spotlightSignal: (SignalDaily & { code: string }) | null = null;

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

    const { data: topSignal } = await supabase
      .from('signals_daily')
      .select('*')
      .eq('date_marche', asOf)
      .order('score_total', { ascending: false })
      .limit(1)
      .maybeSingle();
    spotlightSignal = (topSignal as (SignalDaily & { code: string })) ?? null;
  }

  let heatmapRows: HeatmapNode[] = [];
  try {
    const { rows } = await loadHeatmap(supabase);
    heatmapRows = rows;
  } catch {
    /* pas de cartographie si données indisponibles */
  }

  const { data: diagReport } = await supabase
    .from('diagnostic_reports')
    .select('code, generated_at, markdown_content')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Brief du jour (extrait) — copie fidèle de app/page.tsx.
  const { data: brief } = await supabase
    .from('brief_daily')
    .select('date_marche, contenu')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Simulation réelle : 1 000 000 FCFA dans SNTS il y a 5 ans — copie fidèle
  // de app/page.tsx.
  let simulation: { finalValue: number; pct: number; years: number } | null = null;
  try {
    const from = new Date();
    from.setFullYear(from.getFullYear() - 5);
    const fromIso = from.toISOString().split('T')[0]!;
    const [{ data: snts }, { data: divs }] = await Promise.all([
      supabase
        .from('brvm_actions_daily')
        .select('date_marche, cours_jour')
        .eq('code', 'SNTS')
        .gte('date_marche', fromIso)
        .order('date_marche', { ascending: true }),
      supabase.from('dividends').select('montant, payment_date, ex_date').eq('code', 'SNTS'),
    ]);
    const prices: PricePoint[] = (snts ?? [])
      .filter((r) => r.cours_jour != null && r.cours_jour > 0)
      .map((r) => ({ date: r.date_marche as string, close: r.cours_jour as number }));
    const dividends = (divs ?? [])
      .map((d) => ({ date: (d.payment_date ?? d.ex_date ?? '') as string, montant: d.montant as number }))
      .filter((d) => d.date);
    const sim = simulateInvestment(1_000_000, fromIso, prices, dividends);
    if (sim) simulation = { finalValue: sim.finalValue, pct: sim.totalReturnPct, years: sim.years };
  } catch {
    /* pas de simulation si données indisponibles */
  }

  const { data: planRows } = await supabase
    .from('subscription_plans')
    .select('id, code, name, price_monthly, is_recommended, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  const planIds = (planRows ?? []).map((p) => p.id as string);
  const { data: featureRows } = planIds.length
    ? await supabase
        .from('plan_features')
        .select('id, plan_id, feature_label, feature_value, sort_order')
        .in('plan_id', planIds)
        .order('sort_order', { ascending: true })
    : { data: [] as { id: string; plan_id: string; feature_label: string; feature_value: string | null }[] };
  const plans = (planRows ?? []).map((p) => ({
    code: p.code as string,
    name: p.name as string,
    // numeric(12,2) revient en chaîne via PostgREST — Number() explicite,
    // même convention que app/pricing/page.tsx et app/account/plan/page.tsx.
    price_monthly: Number(p.price_monthly ?? 0),
    is_recommended: Boolean(p.is_recommended),
    features: (featureRows ?? [])
      .filter((f) => f.plan_id === p.id)
      .map((f) => ({ id: f.id as string, feature_label: f.feature_label as string, feature_value: f.feature_value as string | null })),
  }));

  return {
    asOf,
    ticks,
    tickerRows,
    hausses,
    baisses,
    nbActions,
    volumeTotal,
    indices,
    heatmapRows,
    spotlightSignal,
    diagnosticExample: diagReport ?? null,
    plans,
    simulation,
    briefContenu: (brief?.contenu as string | undefined) ?? null,
  };
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
  const {
    asOf,
    ticks,
    tickerRows,
    hausses,
    baisses,
    nbActions,
    volumeTotal,
    indices,
    heatmapRows,
    spotlightSignal,
    diagnosticExample,
    plans,
    simulation,
    briefContenu,
  } = await getCachedPreviewData();

  // Comptes SGI dynamiques (annuaire Supabase) — appelé hors cache, comme en
  // production (app/page.tsx : getSgiDirectory() n'est pas dans getData()).
  const sgiDirectory = await getSgiDirectory();
  const sgiCount = sgiDirectory.length;
  const sgiPaysCounts = new Map<string, number>();
  for (const s of sgiDirectory) sgiPaysCounts.set(s.pays, (sgiPaysCounts.get(s.pays) ?? 0) + 1);
  const sgiPaysTries = [...sgiPaysCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sgiPaysLines = [
    ...sgiPaysTries.slice(0, 3).map(([c, n]) => `${SGI_PAYS[c]?.nom ?? c} · ${n}`),
    sgiPaysTries.slice(3).map(([c]) => SGI_PAYS[c]?.nom ?? c).join(' · '),
  ].filter(Boolean);

  const dateLabel = asOf
    ? new Date(asOf).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;
  const briefLines = briefContenu
    ? briefContenu.split('\n').filter((l) => l.trim() && !l.startsWith('Analyse complète')).slice(0, 7)
    : [];

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

      <ToolsGrid />

      <RatingSpotlight signal={spotlightSignal} />

      <DiagnosticSpotlight report={diagnosticExample} />

      {/* ── SIMULATEUR (preuve par l'exemple, calcul réel) ────────────── */}
      <section className="landing-sim-section mt-10 overflow-hidden rounded-panel border border-border p-6 md:p-10">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
          <div>
            <p className="overline mb-3 text-gold-2">Simulateur</p>
            <h2 className="mb-3 font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
              Et si vous aviez investi&nbsp;?
            </h2>
            <p className="mb-6 max-w-[46ch] text-sm leading-relaxed text-muted">
              Calculez ce qu&apos;un placement sur n&apos;importe quelle action BRVM aurait rapporté —
              dividendes inclus, sur les cours réels.
            </p>
            <Link
              href="/simulateur"
              className="inline-flex min-h-[44px] items-center rounded-full border border-up/40 px-5 text-sm font-semibold text-up transition-colors hover:bg-up/10"
            >
              Faire le calcul pour moi →
            </Link>
          </div>

          {simulation ? (
            <div className="landing-sim-result rounded-2xl p-6 border">
              <p className="mb-1 text-xs text-muted">1 000 000 FCFA dans SONATEL il y a 5 ans, aujourd&apos;hui :</p>
              <p className="tabular font-display text-4xl font-bold text-ivory md:text-5xl">
                {fmtNumber(Math.round(simulation.finalValue))} <span className="text-lg text-muted">FCFA</span>
              </p>
              <p className={`tabular mt-1 text-lg font-bold ${simulation.pct >= 0 ? 'text-up' : 'text-down'}`}>
                {simulation.pct >= 0 ? '+' : ''}{fmtNumber(simulation.pct, 1)} % · dividendes inclus
              </p>
              <p className="mt-3 text-[10px] text-faint">
                Calcul réel sur les cours de clôture. Performances passées ne préjugent pas des performances futures.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-sunken/30 p-6 text-center">
              <p className="text-sm text-faint">Le calcul s&apos;affichera dès que l&apos;historique sera disponible.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── COMPARATEUR SGI ─────────────────────────────────────────────── */}
      <section className="mt-10 overflow-hidden rounded-panel border border-accent/20 bg-gradient-to-br from-accent/[0.06] to-transparent p-6 md:p-8">
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1.4fr_auto]">
          <div>
            <p className="overline mb-3 text-gold-2">Comparateur · BRVM / UEMOA</p>
            <h2 className="mb-3 max-w-[22ch] font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
              Choisir sa SGI, sans <span className="text-accent">improviser</span>.
            </h2>
            <p className="mb-5 max-w-[58ch] text-sm leading-relaxed text-muted">
              Annuaire complet des {sgiCount} SGI agréées de l&apos;UEMOA — pays, type, groupe, dépôt minimum indicatif —
              et un calculateur de coût réel (courtage, garde, tenue de compte) pour comparer sur des chiffres,
              pas des ordres de grandeur vagues.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/comparateur-sgi"
                className="landing-hero-cta inline-flex min-h-[46px] items-center gap-1.5 rounded-full px-6 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
              >
                Comparer le coût réel <span aria-hidden>→</span>
              </Link>
              <span className="font-mono text-[12px] text-faint">{sgiCount} SGI · 7 pays UEMOA</span>
            </div>
          </div>
          <div className="hidden md:flex md:flex-col md:gap-2 md:border-l md:border-white/10 md:pl-6">
            {sgiPaysLines.map((l) => (
              <span key={l} className="font-mono text-[12.5px] text-muted">
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── BRIEF DU JOUR (vrai contenu) ──────────────────────────────── */}
      {briefLines.length > 0 && (
        <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center">
          <div>
            <p className="overline mb-3 text-gold-2">Brief quotidien</p>
            <h2 className="mb-3 font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
              La séance résumée en 30 secondes, chaque soir.
            </h2>
            <p className="mb-6 max-w-[44ch] text-sm leading-relaxed text-muted">
              Indices, hausses, baisses, volumes et annonces — généré automatiquement après chaque clôture.
            </p>
            <Link
              href="/brief"
              className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-elevated/40 px-5 text-sm font-medium text-ivory transition-all hover:border-accent/40 hover:bg-elevated/70"
            >
              Lire les derniers briefs →
            </Link>
          </div>
          <div className="landing-brief-card rounded-panel border p-5">
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ivory/90">
              {briefLines.join('\n')}
            </pre>
          </div>
        </section>
      )}

      <PremiumCompare plans={plans} />

      <SocialProof />
      <LandingFaq />

      <section className="mt-10">
        <NewsletterForm source="landing-preview" />
      </section>

      <Footer />
    </div>
  );
}
