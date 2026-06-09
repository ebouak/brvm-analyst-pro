import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TasteTopbar } from '@/components/landing/taste/TasteTopbar';
import { SovereignIndexCards } from '@/components/landing/taste/SovereignIndexCards';
import { TopMoversGallery } from '@/components/landing/taste/TopMoversGallery';
import { SignalDeskPremium } from '@/components/landing/taste/SignalDeskPremium';
import { PremiumCircle } from '@/components/landing/taste/PremiumCircle';
import type { TickItem, IndexCard, Mover, SignalRow } from '@/components/landing/taste/types';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'BRVM Analyst Pro — La maison de marché premium de l’UEMOA',
  description:
    "Terminal boursier BRVM·UEMOA : indices, cours, signaux explicables, diagnostic IA et Cercle Premium.",
};

const nf = (n: number, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });

async function getData() {
  const supabase = createClient();

  // Dernière séance
  const { data: lastDay } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const asOf = (lastDay?.date_marche as string | undefined) ?? null;

  let ticks: TickItem[] = [];
  let gainers: Mover[] = [];
  let losers: Mover[] = [];
  let nbActions = 0;

  if (asOf) {
    const { data: rows } = await supabase
      .from('brvm_actions_daily')
      .select('code, cours_jour, variation_pct')
      .eq('date_marche', asOf)
      .order('variation_pct', { ascending: false });
    const all = (rows ?? []) as { code: string; cours_jour: number | null; variation_pct: number | null }[];
    nbActions = all.length;
    const withVar = all.filter((r) => r.variation_pct != null);
    const toMover = (r: { code: string; cours_jour: number | null; variation_pct: number | null }, dir: 'up' | 'down'): Mover => ({
      sym: r.code,
      dir,
      price: r.cours_jour != null ? nf(r.cours_jour) : '—',
      pct: `${(r.variation_pct ?? 0) >= 0 ? '+' : ''}${(r.variation_pct ?? 0).toFixed(2)}%`,
    });
    gainers = withVar.slice(0, 4).map((r) => toMover(r, 'up'));
    losers = withVar.slice(-4).reverse().map((r) => toMover(r, 'down'));
    ticks = [...gainers, ...losers].map((m) => ({ sym: m.sym, val: m.price, dir: m.dir, pct: m.pct }));
  }

  // Indices
  let indices: IndexCard[] = [];
  const { data: idxRows } = await supabase
    .from('brvm_indices_daily')
    .select('*')
    .order('date_marche', { ascending: false })
    .limit(20);
  if (idxRows && idxRows.length > 0) {
    const latest = (idxRows[0] as Record<string, unknown>).date_marche;
    indices = (idxRows as Record<string, unknown>[])
      .filter((r) => r.date_marche === latest)
      .slice(0, 2)
      .map((r, i) => {
        const v = (r.valeur ?? r.cloture ?? null) as number | null;
        const pct = (r.variation_pct ?? null) as number | null;
        const dir: 'up' | 'down' = (pct ?? 0) >= 0 ? 'up' : 'down';
        return {
          name: String(r.libelle ?? r.code ?? 'Indice'),
          value: v != null ? nf(v, 2) : '—',
          move: pct != null ? `${dir === 'up' ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%` : '—',
          dir,
          desc:
            i === 0
              ? 'L’indice principal de la cote, traité comme un objet de séance premium.'
              : 'Hiérarchie secondaire, lisible, avec air et tension visuelle.',
          featured: i === 0,
        } satisfies IndexCard;
      });
  }

  // Signaux récents
  let signals: SignalRow[] = [];
  const { data: sigDay } = await supabase
    .from('signals_daily')
    .select('*')
    .order('date_marche', { ascending: false })
    .limit(60);
  if (sigDay && sigDay.length > 0) {
    const latest = (sigDay[0] as Record<string, unknown>).date_marche;
    const norm = (v: unknown): SignalRow['action'] | null => {
      const s = String(v ?? '').toUpperCase();
      if (s.includes('BUY') || s.includes('ACHAT')) return 'BUY';
      if (s.includes('SELL') || s.includes('VENTE')) return 'SELL';
      if (s.includes('HOLD') || s.includes('CONSERV') || s.includes('NEUTRE')) return 'HOLD';
      return null;
    };
    const rows = (sigDay as Record<string, unknown>[]).filter((r) => r.date_marche === latest);
    signals = rows
      .map((r) => {
        const action = norm(r.signal ?? r.action ?? r.recommandation);
        const scoreRaw = (r.score ?? r.confiance ?? r.score_total ?? null) as number | null;
        if (!action) return null;
        return {
          action,
          code: String(r.code ?? ''),
          title:
            action === 'BUY'
              ? 'Conditions d’accumulation réunies'
              : action === 'SELL'
                ? 'Tension technique en repli'
                : 'Momentum surveillé, sans excès',
          score: scoreRaw != null ? Math.round(Math.abs(scoreRaw) <= 1 ? scoreRaw * 100 : scoreRaw) : 0,
        } satisfies SignalRow;
      })
      .filter((s): s is SignalRow => s != null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  return { ticks, indices, gainers, losers, signals, asOf, nbActions };
}

const UNIVERSE = [
  { kicker: 'Marché', title: 'Le pouls de la cote', body: 'Cours, indices, heatmap sectorielle, obligations, dividendes.', href: '/dashboard', accent: 'text-up' },
  { kicker: 'Analyse', title: 'La conviction étayée', body: 'Signaux explicables, scanner, fondamentaux, notations, backtest.', href: '/signaux', accent: 'text-sapphire' },
  { kicker: 'Premium · IA', title: 'Le diagnostic d’une maison', body: 'Diagnostic sell-side IA, classements, anomalies, corrélations.', href: '/premium/diagnostic', accent: 'text-gold-2' },
];

export default async function Landing() {
  const { ticks, indices, gainers, losers, signals, asOf, nbActions } = await getData();
  const dateLabel = asOf
    ? new Date(asOf).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="relative z-10 mx-auto max-w-content px-4 pb-12">
      <TasteTopbar ticks={ticks} />

      {/* ── Ouverture : hero ─────────────────────────────────────────── */}
      <section
        className="relative mb-4 mt-4 overflow-hidden rounded-[2.6rem] border border-white/10 p-5 md:p-8"
        style={{ background: 'radial-gradient(circle at 72% 28%,rgba(86,215,253,0.13),transparent 24%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.022))', boxShadow: '0 22px 60px rgba(0,0,0,0.36)' }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-0 select-none font-display"
          style={{ fontSize: 'clamp(5rem,14vw,10rem)', lineHeight: 0.8, letterSpacing: '-0.12em', color: 'rgba(255,255,255,0.035)' }}
        >
          UEMOA
        </span>
        <div className="relative z-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-gold-2" style={{ background: 'rgba(86,215,253,0.09)', borderColor: 'rgba(86,215,253,0.26)' }}>
            <span className="h-2 w-2 rounded-full" style={{ background: '#3fe18b', animation: 'pulse 2.5s infinite' }} />
            {dateLabel ? `Séance · ${dateLabel} · BRVM` : 'Bourse Régionale · UEMOA'}
          </div>
          <h1 className="mb-4 font-display" style={{ fontSize: 'clamp(3rem,6.3vw,6.8rem)', lineHeight: 0.9, letterSpacing: '-0.08em', maxWidth: '11ch' }}>
            La maison de marché <span className="text-gold-shimmer animate-gold-sweep">premium</span> de l’Afrique de l’Ouest.
          </h1>
          <p className="mb-5 max-w-[60ch] text-base leading-[1.75] text-muted">
            Terminal boursier BRVM·UEMOA. Indices, cours, signaux explicables, diagnostic IA et Cercle Premium —
            réunis dans une seule maison.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className="inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-bold text-[#03222b] shadow-gold" style={{ background: 'linear-gradient(180deg,#8fe6ff,#56d7fd)' }}>
              Explorer les univers
            </Link>
            <Link href="/signaux" className="inline-flex min-h-[44px] items-center rounded-full border border-white/10 bg-white/[0.03] px-5 text-sm text-muted transition-all hover:bg-white/[0.06]">
              Signaux récents
            </Link>
            <Link href="/signup" className="inline-flex min-h-[44px] items-center rounded-full border border-white/10 bg-white/[0.03] px-5 text-sm text-muted transition-all hover:bg-white/[0.06]">
              Rejoindre le cercle
            </Link>
          </div>
        </div>
      </section>

      {/* ── Univers du produit ───────────────────────────────────────── */}
      <section className="mb-4 grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-white/10 bg-white/[0.06] md:grid-cols-3">
        {UNIVERSE.map((u) => (
          <Link key={u.kicker} href={u.href} className="group bg-[#0b0b0d] p-6 transition-colors hover:bg-[#101013]">
            <p className={`overline ${u.accent}`}>{u.kicker}</p>
            <h3 className="mt-3 font-display text-2xl text-ivory">{u.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{u.body}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ivory/80 transition-colors group-hover:text-gold-2">
              Explorer <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        ))}
      </section>

      {/* ── Corps : breadth (indices) | movers + signaux ─────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <div className="flex flex-col gap-4">
          <SovereignIndexCards indices={indices} />
          <div className="hidden lg:block">
            <TopMoversGallery gainers={gainers} losers={losers} />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <SignalDeskPremium signals={signals} />
          <div className="lg:hidden">
            <TopMoversGallery gainers={gainers} losers={losers} />
          </div>
        </div>
      </div>

      {/* ── Consécration : Cercle Premium ────────────────────────────── */}
      <div className="mt-4">
        <PremiumCircle />
      </div>

      <footer className="mt-2 flex flex-wrap items-center justify-between gap-4 pb-8 pt-5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
        <span>© {new Date().getFullYear()} BRVM Analyst Pro · UEMOA · {nbActions || 47} valeurs</span>
        <span className="flex gap-4">
          <Link href="/methodologie" className="transition-colors hover:text-ivory">Méthodologie</Link>
          <Link href="/mentions-legales" className="transition-colors hover:text-ivory">Mentions légales</Link>
        </span>
      </footer>
    </div>
  );
}
