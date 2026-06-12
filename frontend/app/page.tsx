import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TasteTopbar } from '@/components/landing/taste/TasteTopbar';
import RatingBadge from '@/components/RatingBadge';
import { simulateInvestment, type PricePoint } from '@/lib/simulate';
import { fmtNumber } from '@/lib/format';
import type { TickItem } from '@/components/landing/taste/types';

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
  let nbActions = 0;
  let volumeTotal = 0;

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
    ticks = [...hausses, ...baisses].map((m) => ({
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

  return { asOf, ticks, hausses, baisses, nbActions, volumeTotal, brief, simulation };
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
  const { asOf, ticks, hausses, baisses, nbActions, volumeTotal, brief, simulation } = await getData();
  const dateLabel = asOf
    ? new Date(asOf).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;
  const briefLines = brief
    ? (brief.contenu as string).split('\n').filter((l) => l.trim() && !l.startsWith('Analyse complète')).slice(0, 7)
    : [];

  return (
    <div className="relative z-10 mx-auto max-w-content px-4 pb-12">
      <TasteTopbar ticks={ticks} />

      {/* ── HERO : promesse + preuve en direct ───────────────────────── */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-center">
        <div>
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-gold-2"
            style={{ background: 'rgba(86,215,253,0.09)', borderColor: 'rgba(86,215,253,0.26)' }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: '#3fe18b', animation: 'pulse 2.5s infinite' }} />
            {dateLabel ? `Séance du ${dateLabel}` : 'Bourse Régionale des Valeurs Mobilières'}
          </div>

          <h1
            className="mb-5 font-display text-ivory"
            style={{ fontSize: 'clamp(2.6rem,5.4vw,4.6rem)', lineHeight: 1.02, letterSpacing: '-0.05em' }}
          >
            Décidez sur la BRVM avec des <span className="text-gold-shimmer animate-gold-sweep">données</span>,
            pas des rumeurs.
          </h1>

          <p className="mb-7 max-w-[56ch] text-base leading-[1.75] text-muted">
            Cours actualisés toutes les 15 minutes, note A–F sur chaque action, fondamentaux extraits des
            publications officielles, simulateur et brief quotidien. L&apos;essentiel est gratuit.
          </p>

          <div className="mb-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex min-h-[48px] items-center rounded-full px-6 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
              style={{ background: 'linear-gradient(180deg,#8fe6ff,#56d7fd)' }}
            >
              Créer un compte gratuit
            </Link>
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
        <aside
          className="rounded-panel border border-white/10 p-5"
          style={{
            background:
              'radial-gradient(circle at 80% 0%,rgba(86,215,253,0.10),transparent 40%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))',
            boxShadow: '0 22px 60px rgba(0,0,0,0.36)',
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="overline text-gold-2">La séance, en direct</p>
            <Link href="/societes" className="text-[11px] text-muted transition-colors hover:text-ivory">
              Tout voir →
            </Link>
          </div>

          {hausses.length === 0 && baisses.length === 0 ? (
            <p className="py-10 text-center text-sm text-faint">Prochaine séance : lundi 09h00 GMT.</p>
          ) : (
            <div className="space-y-2">
              {hausses.map((m) => (
                <MoverLine key={m.code} m={m} />
              ))}
              <div className="my-3 border-t border-white/[0.06]" aria-hidden />
              {baisses.map((m) => (
                <MoverLine key={m.code} m={m} />
              ))}
            </div>
          )}

          <p className="mt-4 text-[10px] leading-relaxed text-faint">
            Données réelles de la dernière séance · note A–F dérivée des signaux quantitatifs (NR = non noté).
          </p>
        </aside>
      </section>

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
      <section
        className="mt-10 overflow-hidden rounded-panel border border-white/10 p-6 md:p-10"
        style={{
          background:
            'radial-gradient(circle at 15% 50%,rgba(63,225,139,0.06),transparent 45%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))',
        }}
      >
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
          <div>
            <p className="overline mb-3 text-gold-2">Simulateur</p>
            <h2 className="mb-3 font-display text-2xl text-ivory md:text-3xl" style={{ letterSpacing: '-0.03em' }}>
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
            <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-6">
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
            <h2 className="mb-3 font-display text-2xl text-ivory md:text-3xl" style={{ letterSpacing: '-0.03em' }}>
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
          <div className="rounded-panel border border-white/10 bg-black/30 p-5">
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ivory/90">
              {briefLines.join('\n')}
            </pre>
          </div>
        </section>
      )}

      {/* ── PREMIUM (une ligne, sans noyer le gratuit) ────────────────── */}
      <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-panel border border-accent/25 bg-accent/[0.04] p-6 md:flex-row md:items-center">
        <div>
          <p className="overline mb-1 text-gold-2">Premium</p>
          <p className="max-w-[58ch] text-sm leading-relaxed text-muted">
            <span className="text-ivory">Diagnostic IA façon sell-side sur chaque société</span> — valorisation,
            forces, risques — plus rapports mensuels PDF et paper trading automatique.
          </p>
        </div>
        <Link
          href="/premium/diagnostic"
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-full px-5 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
          style={{ background: 'linear-gradient(180deg,#8fe6ff,#56d7fd)' }}
        >
          Découvrir le diagnostic IA
        </Link>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────── */}
      <section className="mt-12 text-center">
        <h2 className="mx-auto mb-3 max-w-[24ch] font-display text-3xl text-ivory md:text-4xl" style={{ letterSpacing: '-0.04em' }}>
          Votre prochaine décision mérite mieux qu&apos;une intuition.
        </h2>
        <p className="mb-6 text-sm text-muted">Compte gratuit · aucune carte bancaire · 1 minute.</p>
        <Link
          href="/signup"
          className="inline-flex min-h-[50px] items-center rounded-full px-8 text-base font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
          style={{ background: 'linear-gradient(180deg,#8fe6ff,#56d7fd)' }}
        >
          Créer mon compte gratuit
        </Link>
      </section>

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pb-8 pt-6 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
        <span>© {new Date().getFullYear()} BRVM Analyst Pro · UEMOA · {nbActions || 48} valeurs</span>
        <span className="flex gap-4">
          <Link href="/societes" className="transition-colors hover:text-ivory">Sociétés</Link>
          <Link href="/simulateur" className="transition-colors hover:text-ivory">Simulateur</Link>
          <Link href="/brief" className="transition-colors hover:text-ivory">Brief</Link>
          <Link href="/methodologie" className="transition-colors hover:text-ivory">Méthodologie</Link>
          <Link href="/mentions-legales" className="transition-colors hover:text-ivory">Mentions légales</Link>
        </span>
      </footer>
    </div>
  );
}
