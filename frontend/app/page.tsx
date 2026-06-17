import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TasteTopbar } from '@/components/landing/taste/TasteTopbar';
import { HeroPulseCTA } from '@/components/landing/HeroPulseCTA';
import ScreensShowcase from '@/components/landing/ScreensShowcase';
import RatingBadge from '@/components/RatingBadge';
import NewsTicker from '@/components/NewsTicker';
import MarketSessionBanner from '@/components/landing/MarketSessionBanner';
import SgiComparator from '@/components/landing/SgiComparator';
import NewsletterForm from '@/components/NewsletterForm';
import { LandingIndices } from '@/components/landing/LandingIndices';
import { simulateInvestment, type PricePoint } from '@/lib/simulate';
import { fmtNumber } from '@/lib/format';
import type { TickItem } from '@/components/landing/taste/types';
import type { IndiceDaily } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'BRVM Analyst Pro — Décidez sur la BRVM avec des données, pas des rumeurs',
  description:
    'Cours BRVM toutes les 15 min, note A–F par action, fondamentaux vérifiés, simulateur et brief quotidien. Gratuit — créez votre compte en 1 minute.',
};

const nf = (n: number, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });

interface MoverRow {
  code: string;
  cours: number | null;
  pct: number;
  score: number | null;
  confiance: number | null;
}

interface NewsCardItem {
  id: string;
  titre: string;
  date_publication: string | null;
  source_url: string | null;
  instrument_code: string | null;
}

async function getData() {
  const supabase = createClient();

  const { data: lastDay } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const asOf = (lastDay?.date_marche as string | undefined) ?? null;

  let ticks: TickItem[] = [];
  let hausses: MoverRow[] = [];
  let baisses: MoverRow[] = [];
  let flatTop: MoverRow[] = [];
  let nbActions = 0;
  let volumeTotal = 0;

  // Indices BRVM (11) — date propre, pas toujours alignée sur les cours actions.
  let indices: IndiceDaily[] = [];
  const { data: lastIdx } = await supabase
    .from('brvm_indices_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const idxDate = (lastIdx?.date_marche as string | undefined) ?? null;
  if (idxDate) {
    const { data: idxRows } = await supabase
      .from('brvm_indices_daily')
      .select('*')
      .eq('date_marche', idxDate);
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
    hausses = withVar.filter((r) => (r.variation_pct ?? 0) > 0).slice(0, 3).map(toRow);
    baisses = withVar.filter((r) => (r.variation_pct ?? 0) < 0).slice(-3).reverse().map(toRow);
    // Repli « séance peu animée » : la BRVM est peu liquide, beaucoup de titres
    // ne s'échangent pas → variation 0 % fréquente et légitime. Sans mover signé,
    // on montre quand même la séance via les plus gros volumes (jamais vide alors
    // que des données existent).
    if (hausses.length === 0 && baisses.length === 0) {
      flatTop = [...all]
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, 6)
        .map(toRow);
    }
    const tickSource = hausses.length || baisses.length ? [...hausses, ...baisses] : flatTop;
    ticks = tickSource.map((m) => ({
      sym: m.code,
      val: m.cours != null ? nf(m.cours) : '—',
      dir: m.pct >= 0 ? ('up' as const) : ('down' as const),
      pct: `${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(2)}%`,
    }));
  }

  // Brief du jour (extrait)
  const { data: brief } = await supabase
    .from('brief_daily')
    .select('date_marche, contenu')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Simulation réelle : 1 000 000 FCFA dans SNTS il y a 5 ans
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

  // Actualités du marché (4 dernières) pour la section cartes
  const { data: newsRows } = await supabase
    .from('brvm_news')
    .select('id, titre, date_publication, source_url, instrument_code')
    .order('date_publication', { ascending: false })
    .limit(4);
  const news = (newsRows ?? []) as NewsCardItem[];

  return { asOf, ticks, hausses, baisses, flatTop, nbActions, volumeTotal, brief, simulation, indices, news };
}

/* ── Petits composants de section (serveur) ──────────────────────────── */

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

const STEPS = [
  {
    n: '01',
    title: 'Consultez la note A–F',
    body: 'Chaque action notée chaque jour selon des signaux quantitatifs explicables — jamais d’opinion inventée.',
    href: '/societes',
    cta: 'Voir les 48 sociétés',
  },
  {
    n: '02',
    title: 'Vérifiez les fondamentaux',
    body: 'États financiers extraits des publications officielles : CA, résultat net, PER, ROE, dividendes.',
    href: '/societes',
    cta: 'Explorer les fiches',
  },
  {
    n: '03',
    title: 'Entraînez-vous sans risque',
    body: 'Paper trading avec capital fictif, alertes personnalisées et suivi de portefeuille en réel.',
    href: '/signup',
    cta: 'Créer un compte gratuit',
  },
];

export default async function Landing() {
  const { asOf, ticks, hausses, baisses, flatTop, nbActions, volumeTotal, brief, simulation, indices, news } = await getData();
  const dateLabel = asOf
    ? new Date(asOf).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;
  const briefLines = brief
    ? (brief.contenu as string).split('\n').filter((l) => l.trim() && !l.startsWith('Analyse complète')).slice(0, 7)
    : [];

  return (
    <div className="relative z-10 mx-auto max-w-content px-4 pb-12">
      <TasteTopbar ticks={ticks} />

      {/* ── TICKER ACTUALITÉS ─────────────────────────────────────────── */}
      <NewsTicker className="mt-3 -mx-4 rounded-none sm:mx-0 sm:rounded-xl" />

      {/* ── BANDEAU MARCHÉ — état de séance temps réel ────────────────── */}
      <MarketSessionBanner className="mt-4" />

      {/* ── HERO : promesse + preuve en direct ───────────────────────── */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-center">
        <div>
          <div className="landing-hero-badge mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-gold-2">
            <span className="h-2 w-2 rounded-full bg-up animate-pulse" />
            {dateLabel ? `Séance du ${dateLabel}` : 'Bourse Régionale des Valeurs Mobilières'}
          </div>

          <h1 className="mb-5 font-display text-ivory text-display-lg">
            Décidez sur la BRVM avec des <span className="text-gold-shimmer animate-gold-sweep">données</span>,
            pas des rumeurs.
          </h1>

          <p className="mb-7 max-w-[56ch] text-base leading-[1.75] text-muted">
            Cours actualisés toutes les 15 minutes, note A–F sur chaque action, fondamentaux extraits des
            publications officielles, simulateur et brief quotidien. L&apos;essentiel est gratuit.
          </p>

          <div className="mb-8 flex flex-wrap items-center gap-3">
            <HeroPulseCTA />
            <Link
              href="/societes"
              className="inline-flex min-h-[48px] items-center rounded-full border border-white/10 bg-white/[0.03] px-6 text-sm font-medium text-ivory transition-all hover:border-accent/40 hover:bg-white/[0.06]"
            >
              Explorer sans compte →
            </Link>
          </div>

          {/* Preuves chiffrées réelles */}
          <dl className="grid max-w-md grid-cols-3 gap-4 border-t border-white/[0.07] pt-5">
            {[
              { v: nbActions > 0 ? String(nbActions) : '48', l: 'sociétés suivies' },
              { v: '15 min', l: 'fréquence des cours' },
              { v: volumeTotal > 0 ? fmtNumber(volumeTotal) : '—', l: 'titres échangés (séance)' },
            ].map((s) => (
              <div key={s.l}>
                <dt className="sr-only">{s.l}</dt>
                <dd className="tabular font-display text-2xl text-ivory">{s.v}</dd>
                <dd className="mt-0.5 text-[11px] leading-tight text-faint">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Carte séance live — le produit en démonstration */}
        <aside className="landing-live-card rounded-panel border border-white/10 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="overline text-gold-2">La séance, en direct</p>
            <Link href="/societes" className="text-[11px] text-muted transition-colors hover:text-ivory">
              Tout voir →
            </Link>
          </div>

          {hausses.length > 0 || baisses.length > 0 ? (
            <div className="space-y-2">
              {hausses.map((m) => (
                <MoverLine key={m.code} m={m} />
              ))}
              <div className="my-3 border-t border-white/[0.06]" aria-hidden />
              {baisses.map((m) => (
                <MoverLine key={m.code} m={m} />
              ))}
            </div>
          ) : flatTop.length > 0 ? (
            <div className="space-y-2">
              <p className="mb-1 text-[11px] text-muted">Séance peu animée — cours stables (titres les plus échangés) :</p>
              {flatTop.map((m) => (
                <MoverLine key={m.code} m={m} />
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-faint">
              {dateLabel ? `Séance du ${dateLabel} — données en cours de consolidation.` : 'Données de séance indisponibles pour le moment.'}
            </p>
          )}

          <p className="mt-4 text-[10px] leading-relaxed text-faint">
            Données réelles de la dernière séance · note A–F dérivée des signaux quantitatifs (NR = non noté).
          </p>
        </aside>
      </section>

      {/* ── INDICES BRVM (11, groupés principaux + sectoriels) ────────── */}
      <LandingIndices indices={indices} />

      {/* ── ÉCRANS RÉELS DE LA PLATEFORME ─────────────────────────────── */}
      <ScreensShowcase />

      {/* ── 3 ÉTAPES ──────────────────────────────────────────────────── */}
      <section className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-white/10 bg-white/[0.06] md:grid-cols-3">
        {STEPS.map((s) => (
          <Link key={s.n} href={s.href} className="group bg-[#0b0b0d] p-6 transition-colors hover:bg-[#101013]">
            <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-gold-2">{s.n}</p>
            <h2 className="mt-3 font-display text-xl text-ivory">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ivory/80 transition-colors group-hover:text-gold-2">
              {s.cta} <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        ))}
      </section>

      {/* ── SIMULATEUR (preuve par l'exemple, calcul réel) ────────────── */}
      <section className="landing-sim-section mt-10 overflow-hidden rounded-panel border border-white/10 p-6 md:p-10">
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
            <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-6 text-center">
              <p className="text-sm text-faint">Le calcul s&apos;affichera dès que l&apos;historique sera disponible.</p>
            </div>
          )}
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
              className="inline-flex min-h-[44px] items-center rounded-full border border-white/10 bg-white/[0.03] px-5 text-sm font-medium text-ivory transition-all hover:border-accent/40 hover:bg-white/[0.06]"
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

      {/* ── 3 CARTES : Analyse · Premium · Actualités ─────────────────── */}
      <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Carte 1 — Analyse exclusive → inscription */}
        <article className="flex flex-col rounded-panel border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-accent/40 hover:bg-white/[0.05]">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-up/30 bg-up/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-up">
            <span className="h-1.5 w-1.5 rounded-full bg-up animate-pulse" /> Données temps réel
          </span>
          <h3 className="mt-4 font-display text-xl text-ivory">Accédez à des analyses exclusives</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Note A–F sur chaque action, signaux quantitatifs, watchlist et alertes. L&apos;essentiel est
            gratuit — créez votre compte en 1 minute.
          </p>
          <Link
            href="/signup"
            className="mt-5 inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-full border border-up/40 px-5 text-sm font-semibold text-up transition-colors hover:bg-up/10"
          >
            Espace Analyse <span aria-hidden>→</span>
          </Link>
        </article>

        {/* Carte 2 — Premium → pricing */}
        <article className="flex flex-col rounded-panel border border-accent/25 bg-accent/[0.05] p-6 transition-all hover:border-accent/50">
          <p className="overline text-gold-2">Premium</p>
          <h3 className="mt-3 font-display text-xl text-ivory">Passez à Premium</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Diagnostic IA façon sell-side sur chaque société — valorisation, forces, risques —
            rapports mensuels PDF et paper trading automatique.
          </p>
          <Link
            href="/pricing"
            className="landing-hero-cta mt-5 inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-full px-5 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
          >
            Découvrir <span aria-hidden>→</span>
          </Link>
        </article>

        {/* Carte 3 — Actualités du marché (vraies données brvm_news) */}
        <article className="flex flex-col rounded-panel border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl text-ivory">Actualités du Marché</h3>
            <Link href="/actualites" className="text-[11px] text-muted transition-colors hover:text-ivory">
              Tout voir →
            </Link>
          </div>
          {news.length > 0 ? (
            <ul className="mt-4 flex-1 space-y-3">
              {news.slice(0, 3).map((n) => {
                const dateLabelN = n.date_publication
                  ? new Date(n.date_publication).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                  : null;
                const inner = (
                  <>
                    <p className="line-clamp-2 text-sm leading-snug text-ivory/90 transition-colors group-hover:text-gold-2">
                      {n.titre}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-[10px] text-faint">
                      {n.instrument_code && <span className="tabular font-medium text-muted">{n.instrument_code}</span>}
                      {dateLabelN && <span>{dateLabelN}</span>}
                    </p>
                  </>
                );
                return (
                  <li key={n.id} className="border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
                    {n.source_url ? (
                      <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="group block">
                        {inner}
                      </a>
                    ) : (
                      <div className="group">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 flex-1 py-6 text-center text-sm text-faint">
              Aucune actualité disponible pour le moment.
            </p>
          )}
        </article>
      </section>

      {/* ── COMPARATEUR DES SGI (annuaire UEMOA + critères + FAQ) ──────── */}
      <SgiComparator />

      {/* ── NEWSLETTER ───────────────────────────────────────────────── */}
      <section className="mt-10">
        <NewsletterForm source="landing" />
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────── */}
      <section className="mt-12 text-center">
        <h2 className="mx-auto mb-3 max-w-[24ch] font-display text-3xl text-ivory md:text-4xl [letter-spacing:-0.04em]">
          Votre prochaine décision mérite mieux qu&apos;une intuition.
        </h2>
        <p className="mb-6 text-sm text-muted">Compte gratuit · aucune carte bancaire · 1 minute.</p>
        <Link
          href="/signup"
          className="landing-hero-cta inline-flex min-h-[50px] items-center rounded-full px-8 text-base font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
        >
          Créer mon compte gratuit
        </Link>
      </section>

    </div>
  );
}
