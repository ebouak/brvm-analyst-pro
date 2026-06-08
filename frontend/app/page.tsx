import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import LandingTicker, { type TickerItem } from '@/components/landing/LandingTicker';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'BRVM Analyst Pro — La maison de marché premium de l’UEMOA',
  description:
    "Terminal d'analyse institutionnel pour la Bourse Régionale des Valeurs Mobilières : cours, signaux, fondamentaux, diagnostic IA.",
};

interface IndexLine {
  code: string;
  libelle: string;
  valeur: number | null;
  variation: number | null;
}

async function getMarketData(): Promise<{
  ticker: TickerItem[];
  indices: IndexLine[];
  asOf: string | null;
  nbActions: number;
}> {
  const supabase = createClient();

  // Dernière séance des actions
  const { data: lastDay } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const asOf = (lastDay?.date_marche as string | undefined) ?? null;

  let ticker: TickerItem[] = [];
  let nbActions = 0;
  if (asOf) {
    const { data: rows } = await supabase
      .from('brvm_actions_daily')
      .select('code, cours_jour, variation_pct')
      .eq('date_marche', asOf)
      .order('variation_pct', { ascending: false });
    const all = (rows ?? []) as { code: string; cours_jour: number | null; variation_pct: number | null }[];
    nbActions = all.length;
    // Ticker = plus forts mouvements (haut + bas) pour la vivacité
    const top = all.slice(0, 8);
    const bottom = all.slice(-8).reverse();
    ticker = [...top, ...bottom].map((r) => ({ code: r.code, cours: r.cours_jour, variation: r.variation_pct }));
  }

  // Indices (défensif sur les colonnes)
  let indices: IndexLine[] = [];
  const { data: idxDay } = await supabase
    .from('brvm_indices_daily')
    .select('*')
    .order('date_marche', { ascending: false })
    .limit(20);
  if (idxDay && idxDay.length > 0) {
    const latestDate = (idxDay[0] as Record<string, unknown>).date_marche;
    indices = (idxDay as Record<string, unknown>[])
      .filter((r) => r.date_marche === latestDate)
      .slice(0, 4)
      .map((r) => ({
        code: String(r.code ?? ''),
        libelle: String(r.libelle ?? r.code ?? ''),
        valeur: (r.valeur ?? r.cloture ?? null) as number | null,
        variation: (r.variation_pct ?? null) as number | null,
      }));
  }

  return { ticker, indices, asOf, nbActions };
}

const PILLARS = [
  {
    kicker: 'Marché',
    title: 'Le pouls de la cote',
    body: 'Cours actualisés, indices, heatmap sectorielle, obligations et dividendes — la séance régionale, lisible d’un regard.',
    href: '/dashboard',
    accent: 'text-up',
  },
  {
    kicker: 'Analyse',
    title: 'La conviction, étayée',
    body: 'Signaux explicables, scanner technique, fondamentaux par secteur, notations et backtest. Chaque décision, documentée.',
    href: '/signaux',
    accent: 'text-sapphire',
  },
  {
    kicker: 'Premium · IA',
    title: 'Le diagnostic d’une maison',
    body: 'Diagnostic financier sell-side généré par IA, classements, anomalies, corrélations. L’intelligence d’un bureau d’études, intégrée.',
    href: '/premium/diagnostic',
    accent: 'text-gold',
  },
];

export default async function Landing() {
  const { ticker, indices, asOf, nbActions } = await getMarketData();
  const dateLabel = asOf
    ? new Date(asOf).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-bg text-ivory overflow-x-hidden">
      {/* Halo d'atmosphère */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-obsidian-glow" />

      {/* ── Barre de marque ───────────────────────────────────────────── */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-gold/30 bg-gradient-to-b from-gold/15 to-transparent">
            <span className="font-display text-lg font-semibold text-gold">B</span>
          </div>
          <div className="leading-none">
            <p className="font-display text-base font-semibold tracking-tight text-ivory">BRVM Analyst</p>
            <p className="overline text-gold/80">Pro · UEMOA</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:text-ivory"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-all hover:bg-gold/20 hover:shadow-gold-sm active:scale-95"
          >
            Accès au terminal
          </Link>
        </nav>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-12 md:pt-24">
        <p className="overline mb-6 text-gold/80 animate-rise-in">Bourse Régionale des Valeurs Mobilières — UEMOA</p>
        <h1 className="font-display text-display-xl max-w-4xl text-ivory animate-rise-in" style={{ animationDelay: '60ms' }}>
          La maison de marché<br />
          <span className="text-gold-shimmer animate-gold-sweep bg-[length:200%_auto]">premium</span> de l’Afrique de l’Ouest.
        </h1>
        <p
          className="mt-7 max-w-2xl text-lg leading-relaxed text-muted animate-rise-in"
          style={{ animationDelay: '140ms' }}
        >
          Un terminal institutionnel pour lire la BRVM avec la rigueur d’un bureau d’études :
          cours, signaux explicables, fondamentaux par secteur et diagnostic IA — réunis dans une seule maison.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3 animate-rise-in" style={{ animationDelay: '220ms' }}>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-obsidian shadow-gold transition-all hover:bg-gold-soft active:scale-95"
          >
            Entrer dans le terminal
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <Link
            href="/premium/diagnostic"
            className="inline-flex items-center gap-2 rounded-xl border border-border-strong px-6 py-3 text-sm font-medium text-ivory transition-colors hover:border-gold/40 hover:text-gold"
          >
            Voir le diagnostic IA
          </Link>
        </div>
      </section>

      {/* ── Ticker live ───────────────────────────────────────────────── */}
      <div className="relative z-10">
        <LandingTicker items={ticker} />
      </div>

      {/* ── Preuve vivante : indices + état de séance ─────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="overline text-gold/70">La séance, en direct</p>
            <h2 className="font-display mt-2 text-display-lg text-ivory">Le marché, sans détour</h2>
          </div>
          {dateLabel && (
            <p className="hidden text-sm text-muted sm:block">
              Dernière séance · <span className="text-ivory">{dateLabel}</span>
            </p>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {indices.map((idx) => {
            const up = (idx.variation ?? 0) >= 0;
            return (
              <div
                key={idx.code}
                className="rounded-panel border border-border bg-surface p-5 shadow-card transition-all hover:border-gold/30"
              >
                <p className="text-xs text-muted">{idx.libelle}</p>
                <p className="tabular mt-3 text-2xl font-semibold text-ivory">
                  {idx.valeur != null ? idx.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}
                </p>
                <p className={`tabular mt-1 text-sm font-medium ${up ? 'text-up' : 'text-down'}`}>
                  {idx.variation != null ? `${up ? '▲' : '▼'} ${Math.abs(idx.variation).toFixed(2)} %` : ''}
                </p>
              </div>
            );
          })}
          {/* Carte récap valeurs suivies */}
          <div className="rounded-panel border border-gold/20 bg-gradient-to-b from-gold/[0.06] to-transparent p-5 shadow-card">
            <p className="text-xs text-gold/80">Valeurs suivies</p>
            <p className="tabular mt-3 text-2xl font-semibold text-ivory">{nbActions || 47}</p>
            <p className="mt-1 text-sm text-muted">actions de la cote régionale</p>
          </div>
        </div>
      </section>

      {/* ── Les trois piliers ─────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20">
        <div className="gold-rule mb-12" />
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-border bg-border md:grid-cols-3">
          {PILLARS.map((p) => (
            <Link
              key={p.kicker}
              href={p.href}
              className="group relative bg-surface p-8 transition-colors hover:bg-elevated"
            >
              <p className={`overline ${p.accent}`}>{p.kicker}</p>
              <h3 className="font-display mt-4 text-2xl text-ivory">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{p.body}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-ivory/80 transition-colors group-hover:text-gold">
                Explorer <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Bande de consécration premium ─────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-panel border border-gold/25 bg-gradient-to-br from-gold/[0.08] via-surface to-surface p-10 shadow-gold md:p-14">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
          <p className="overline relative text-gold">Cercle premium</p>
          <h2 className="font-display relative mt-4 max-w-2xl text-display-lg text-ivory">
            L’intelligence d’une maison d’investissement, à votre table.
          </h2>
          <p className="relative mt-5 max-w-xl text-base leading-relaxed text-muted">
            Diagnostic financier sell-side généré par IA, classements propriétaires, détection d’anomalies et corrélations.
            Réservé aux membres du cercle.
          </p>
          <Link
            href="/signup"
            className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-obsidian shadow-gold transition-all hover:bg-gold-soft active:scale-95"
          >
            Rejoindre le cercle <span>→</span>
          </Link>
        </div>
      </section>

      {/* ── Pied ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} BRVM Analyst Pro · UEMOA</p>
          <nav className="flex items-center gap-5">
            <Link href="/methodologie" className="transition-colors hover:text-ivory">Méthodologie</Link>
            <Link href="/mentions-legales" className="transition-colors hover:text-ivory">Mentions légales</Link>
            <Link href="/confidentialite" className="transition-colors hover:text-ivory">Confidentialité</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
