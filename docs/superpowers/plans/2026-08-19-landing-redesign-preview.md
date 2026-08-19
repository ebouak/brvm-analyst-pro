# Landing Redesign Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated `/landing-preview` route that demonstrates the target premium hierarchy for the WESTBOURSE landing page (per `docs/LANDING_REDESIGN_AUDIT.md`, Phases 0-9), reusing every real, already-conform component untouched and adding only the three genuinely missing sections (tools grid, Note A–F spotlight, Diagnostic IA spotlight, Premium comparison) — **without modifying any file under `frontend/app/page.tsx` or any production component**. This is Phase 10 of the user's mandated redesign process; nothing here touches production until the user explicitly approves at Phase 12.

**Architecture:** New route `frontend/app/landing-preview/page.tsx` with its own data-fetch function (separate `unstable_cache` key from the production landing, per the established scraper/frontend duplication convention already used elsewhere in this codebase — e.g. `scraper/src/hebdo/pure/` vs `frontend/lib/hebdo/`). It imports and reuses real production components directly (`TasteTopbar`, `NewsTicker`, `LandingIndices`, `LandingHeatmap`, `SocialProof`, `NewsletterForm`, `LandingFaq`, `Footer`, `RatingBadge`) unmodified, and composes four new components that query only already-existing tables (`signals_daily`, `diagnostic_reports`, `subscription_plans`/`plan_features`) — no new tables, no new APIs, no schema changes.

**Tech Stack:** Next.js 14 App Router (Server Components), Supabase (public/anon client only — same `createPublicClient()` used by production landing), TypeScript, TailwindCSS (existing design tokens only, no new tokens).

---

### Task 1 : Scaffold `/landing-preview` — data fetch + baseline assembly

**Files:**
- Create: `frontend/app/landing-preview/page.tsx`

**Context:** This establishes the preview route with its own data layer, reusing the exact same query shapes as `frontend/app/page.tsx` (already read and understood — see `docs/LANDING_REDESIGN_AUDIT.md` §1). Deliberately duplicated rather than extracted into a shared module, to guarantee zero risk to the production `getData()`/`getCachedData()` in `page.tsx` — consistent with this codebase's existing convention of duplicating small pieces of logic across deployment/route boundaries rather than coupling them (see `scraper/src/hebdo/pure/` vs `frontend/lib/hebdo/`, noted in project `CLAUDE.md`).

This task renders a version of the landing that is functionally IDENTICAL in content to production (same sections, same data), except the `ProofBand`-equivalent stats are wired live instead of hardcoded (fixing the regression noted in the audit §8.5) and the movers/heatmap/indices sections are laid out as a 4-card grid instead of the current 2-column split (per the audit §12, section 05). Tasks 2-5 replace/add specific sections on top of this baseline. This task does NOT yet add the Hero mockup, tools grid, rating spotlight, diagnostic spotlight, or premium comparison — those are Tasks 2-6.

- [ ] **Step 1 : Write the route file**

```tsx
// frontend/app/landing-preview/page.tsx
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { TasteTopbar } from '@/components/landing/taste/TasteTopbar';
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

      {/* Hero, ToolsGrid, RatingSpotlight, DiagnosticSpotlight, PremiumCompare : Tasks 2-6 */}

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
```

- [ ] **Step 2 : Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. If `LandingIndices` doesn't accept being nested inside a card this way (it may render its own full-width grid internally), note this as a follow-up in Task 7 (final assembly pass) rather than fighting it in this task — Task 1's job is data correctness, not final visual polish.

- [ ] **Step 3 : Manual check**

Run the dev server (`cd frontend && npm run dev`) and open `/landing-preview`. Confirm: page renders without runtime errors, movers/indices/heatmap show real data matching what `/` currently shows, no console errors about missing props.

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/landing-preview/page.tsx
git commit -m "feat(landing-preview): scaffold route + données réelles (Phase 10 Task 1)"
```

---

### Task 2 : Hero mockup — remplace photo/carte par un mockup d'interface réelle

**Files:**
- Create: `frontend/components/landing/HeroDeviceMockup.tsx`
- Modify: `frontend/app/landing-preview/page.tsx` (insert after `TasteTopbar`, before the preview banner note stays — insert the Hero section)

**Context:** Per audit §2 and §9, this is the highest-impact, highest-complexity visual change: replace `HeroSpotlight`'s photo + Africa map treatment with a device-frame mockup of the real product UI, per all 4 reference images and the mandate's explicit "no stock photos, the real product is the visual." Uses the SAME `ticks` already fetched in Task 1 — no new query. `HeroSpotlight.tsx` (production) is untouched; this is a new, separate component used only by the preview.

- [ ] **Step 1 : Implement**

```tsx
// frontend/components/landing/HeroDeviceMockup.tsx
import Link from 'next/link';
import RatingBadge from '@/components/RatingBadge';
import type { TickItem } from '@/components/landing/taste/types';

interface Props {
  dateLabel: string | null;
  ticks: TickItem[];
  brvmC: number | null;
}

/**
 * Traitement Hero cible (Phase 10, remplace HeroSpotlight sur la preview
 * uniquement) : le produit réel comme visuel principal plutôt qu'une photo —
 * un cadre d'appareil affichant BRVM-C, les cotations réelles déjà calculées
 * par getPreviewData(), aucune nouvelle donnée.
 */
export function HeroDeviceMockup({ dateLabel, ticks, brvmC }: Props) {
  const top = ticks.slice(0, 4);
  return (
    <section className="mt-6 grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="overline mb-3 text-gold-2">La plateforme de référence BRVM</p>
        <h1 className="font-display text-display-lg text-ivory">
          Décidez sur la BRVM avec des <span className="text-accent">données</span>, pas des rumeurs.
        </h1>
        <p className="mt-5 max-w-[52ch] text-base leading-[1.75] text-muted">
          Cours, fondamentaux, dividendes, valorisation, signaux quantitatifs et analyse IA réunis dans
          une seule plateforme dédiée à la BRVM.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="landing-hero-cta inline-flex min-h-[50px] items-center gap-1.5 rounded-full px-7 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
          >
            Créer mon compte gratuit <span aria-hidden>→</span>
          </Link>
          <Link
            href="/societes"
            className="inline-flex min-h-[50px] items-center rounded-full border border-white/15 px-6 text-sm font-medium text-ivory transition-colors hover:border-accent/40"
          >
            Explorer la BRVM
          </Link>
        </div>
        <p className="mt-4 text-[11px] text-faint">Aucune carte bancaire · Compte en 1 minute · Sans engagement</p>
      </div>

      <div className="rounded-panel border border-white/10 bg-surface p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <p className="overline text-gold-2">BRVM-C</p>
          {dateLabel && <span className="text-[10px] text-faint">Séance du {dateLabel}</span>}
        </div>
        <p className="tabular font-display text-4xl text-ivory">{brvmC != null ? brvmC.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-4">
          {top.length > 0 ? (
            top.map((t) => (
              <div key={t.sym} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2">
                <span className="font-mono text-xs font-bold text-ivory">{t.sym}</span>
                <span className={`tabular text-xs font-bold ${t.dir === 'up' ? 'text-up' : 'text-down'}`}>{t.pct}</span>
              </div>
            ))
          ) : (
            <p className="col-span-2 py-4 text-center text-xs text-faint">Données de séance indisponibles.</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-accent/20 bg-accent/[0.05] px-3 py-2.5">
          <span className="text-[11px] text-muted">Note quantitative — exemple</span>
          <RatingBadge scoreTotal={78} confiance={82} />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2 : Wire into the preview page**

In `frontend/app/landing-preview/page.tsx`: add the import `import { HeroDeviceMockup } from '@/components/landing/HeroDeviceMockup';`, and insert `<HeroDeviceMockup dateLabel={dateLabel} ticks={ticks} brvmC={(indices.find((i) => i.code === 'BRVMC')?.valeur as number | undefined) ?? null} />` immediately after `<TasteTopbar ... />` and before the `<section className="mt-10">` (Marché en direct) block.

**Note on the "Note quantitative — exemple" badge**: it hardcodes `scoreTotal={78} confiance={82}` as an illustrative example, clearly labeled "exemple" — this is a deliberate placeholder value used only to demonstrate the visual treatment of `RatingBadge`, not a claim about a real instrument. If this reads as inconsistent with the "no fabricated data" rule at review time, the fix is to fetch one real `signals_daily` row (same pattern as Task 4) instead — flag for the code-quality reviewer to decide.

- [ ] **Step 3 : Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4 : Commit**

```bash
git add frontend/components/landing/HeroDeviceMockup.tsx frontend/app/landing-preview/page.tsx
git commit -m "feat(landing-preview): hero mockup d'interface réelle (Phase 10 Task 2)"
```

---

### Task 3 : Grille d'outils par catégorie

**Files:**
- Create: `frontend/components/landing/ToolsGrid.tsx`
- Modify: `frontend/app/landing-preview/page.tsx` (insert after the "Marché en direct" section, before `SocialProof`)

**Context:** Per audit §12/§13.1 — every link below was verified against the real route list in `frontend/app/` during the audit. "Watchlist" was flagged as unverified and is deliberately **omitted** from this task rather than linked to a guessed route; add it in a follow-up once its real route is confirmed.

- [ ] **Step 1 : Implement**

```tsx
// frontend/components/landing/ToolsGrid.tsx
import Link from 'next/link';

interface Tool {
  label: string;
  href: string;
  desc: string;
}

const CATEGORIES: { title: string; tools: Tool[] }[] = [
  {
    title: 'Analyser',
    tools: [
      { label: 'Note A–F', href: '/notations', desc: 'Notation quantitative de chaque action' },
      { label: 'Screener', href: '/screener', desc: 'Filtres multi-critères sur toute la cote' },
      { label: 'Dividendes', href: '/dividendes', desc: 'Rendement et calendrier de versement' },
      { label: 'Fondamentaux', href: '/fondamentaux', desc: 'États financiers extraits des publications' },
    ],
  },
  {
    title: 'Comprendre',
    tools: [
      { label: 'Diagnostic IA', href: '/premium/diagnostic', desc: 'Analyse sell-side générée par IA' },
      { label: 'Brief quotidien', href: '/brief', desc: 'La séance résumée chaque soir' },
      { label: 'Actualités', href: '/actualites', desc: "Le fil d'actualité du marché" },
      { label: 'Analyses', href: '/analyses', desc: 'Décryptages et études de marché' },
    ],
  },
  {
    title: 'Simuler & suivre',
    tools: [
      { label: 'Simulateur', href: '/simulateur', desc: 'Et si vous aviez investi ?' },
      { label: 'Paper trading', href: '/premium/paper-trading', desc: 'Entraînez-vous avec un capital fictif' },
      { label: 'Alertes', href: '/parametres/alertes', desc: 'Suivi personnalisé en temps réel' },
      { label: 'Conseiller', href: '/conseiller', desc: 'Recommandations basées sur des signaux' },
    ],
  },
  {
    title: 'Comparer',
    tools: [
      { label: 'SGI', href: '/comparateur-sgi', desc: 'Comparateur de coûts réels' },
      { label: 'Obligations', href: '/obligations', desc: 'Marché obligataire UEMOA' },
      { label: 'Matières premières', href: '/weekly', desc: 'Cacao, or et valeurs sensibles' },
      { label: 'Liquidité', href: '/liquidite', desc: 'Score de liquidité par action' },
    ],
  },
];

export function ToolsGrid() {
  return (
    <section className="mt-10">
      <p className="overline mb-3 text-gold-2">Outils</p>
      <h2 className="mb-6 font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
        Tout ce dont vous avez besoin pour investir intelligemment.
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((cat) => (
          <div key={cat.title}>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">{cat.title}</p>
            <div className="space-y-1.5">
              {cat.tools.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="block rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-accent/30 hover:bg-white/[0.04]"
                >
                  <p className="text-sm font-medium text-ivory">{t.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-faint">{t.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2 : Wire into the preview page**

Add `import { ToolsGrid } from '@/components/landing/ToolsGrid';` and `<ToolsGrid />` after the "Marché en direct" `</section>` and before `<SocialProof />`.

- [ ] **Step 3 : Verify every link resolves**

For each `href` in `CATEGORIES`, confirm a matching route exists under `frontend/app/` (already cross-checked against the route listing gathered during the audit — `/notations`, `/screener`, `/dividendes`, `/fondamentaux`, `/premium/diagnostic`, `/brief`, `/actualites`, `/analyses`, `/simulateur`, `/premium/paper-trading`, `/parametres/alertes`, `/conseiller`, `/comparateur-sgi`, `/obligations`, `/weekly`, `/liquidite` all confirmed present). No further action needed unless a route was renamed since the audit — re-run `ls frontend/app` if in doubt.

- [ ] **Step 4 : Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5 : Commit**

```bash
git add frontend/components/landing/ToolsGrid.tsx frontend/app/landing-preview/page.tsx
git commit -m "feat(landing-preview): grille d'outils par catégorie (Phase 10 Task 3)"
```

---

### Task 4 : Spotlight Note A–F (vraie décomposition du signal)

**Files:**
- Create: `frontend/components/landing/RatingSpotlight.tsx`
- Modify: `frontend/app/landing-preview/page.tsx` (fetch one real `signals_daily` row + insert the section)

**Context:** Per audit §8.11 — uses the REAL fields of `SignalDaily` (`score_variation`, `score_volume`, `score_rsi`, `bonus_tendance`, `penalite_liquidite`), not the reference mockups' invented "Fondamentaux/Momentum/Dividende/Valorisation/Risque" labels. Picks one real instrument with a full signal row for the current date (deterministic: the one with the highest `score_total`, so the example is a genuine, currently-strong signal rather than an arbitrary/weak one).

- [ ] **Step 1 : Implement the component**

```tsx
// frontend/components/landing/RatingSpotlight.tsx
import Link from 'next/link';
import RatingBadge from '@/components/RatingBadge';
import type { SignalDaily } from '@/lib/types';

interface Props {
  signal: (SignalDaily & { code: string }) | null;
}

function Bar({ label, value }: { label: string; value: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, ((value + 100) / 200) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="tabular text-faint">{value != null ? value.toFixed(0) : '—'}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06]">
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function RatingSpotlight({ signal }: Props) {
  if (!signal) return null;
  return (
    <section className="mt-10 rounded-panel border border-white/10 bg-white/[0.02] p-6 md:p-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div>
          <p className="overline mb-3 text-gold-2">Note quantitative</p>
          <h2 className="mb-3 font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
            Chaque action. Une note.
          </h2>
          <p className="max-w-[46ch] text-sm leading-relaxed text-muted">
            Chaque note A–F est calculée à partir de signaux quantitatifs explicables — variation,
            volume, RSI, tendance et liquidité — jamais d&apos;opinion inventée.
          </p>
          <Link
            href="/notations"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ivory/80 transition-colors hover:text-gold-2"
          >
            Voir les 48 sociétés <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-lg font-bold text-ivory">{signal.code}</span>
            <RatingBadge scoreTotal={signal.score_total} confiance={signal.confiance} />
          </div>
          <div className="space-y-3">
            <Bar label="Variation" value={signal.score_variation ?? null} />
            <Bar label="Volume" value={signal.score_volume ?? null} />
            <Bar label="RSI" value={signal.score_rsi ?? null} />
            <Bar label="Tendance (bonus)" value={signal.bonus_tendance ?? null} />
            <Bar label="Liquidité (pénalité)" value={signal.penalite_liquidite ?? null} />
          </div>
          <p className="mt-4 text-[10px] text-faint">
            {signal.signal} · confiance {signal.confiance ?? '—'}% · exemple réel de la séance en cours
          </p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2 : Fetch a real example row in the preview page**

In `getPreviewData()` (Task 1's function), add after the existing `hausses`/`baisses` computation (inside the `if (asOf)` block):

```ts
    const { data: topSignal } = await supabase
      .from('signals_daily')
      .select('*')
      .eq('date_marche', asOf)
      .order('score_total', { ascending: false })
      .limit(1)
      .maybeSingle();
```

Add `spotlightSignal: (topSignal as (SignalDaily & { code: string })) ?? null,` to the function's return object (import `SignalDaily` from `@/lib/types`), and thread it through the destructuring in `LandingPreview()`.

- [ ] **Step 3 : Wire into the preview page**

Add `import { RatingSpotlight } from '@/components/landing/RatingSpotlight';` and `<RatingSpotlight signal={spotlightSignal} />` after `<ToolsGrid />`.

- [ ] **Step 4 : Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5 : Commit**

```bash
git add frontend/components/landing/RatingSpotlight.tsx frontend/app/landing-preview/page.tsx
git commit -m "feat(landing-preview): spotlight note A-F avec vraie décomposition du signal (Phase 10 Task 4)"
```

---

### Task 5 : Spotlight Diagnostic IA (exemple réel figé, sans appel LLM)

**Files:**
- Create: `frontend/components/landing/DiagnosticSpotlight.tsx`
- Modify: `frontend/app/landing-preview/page.tsx` (fetch one real `diagnostic_reports` row + insert the section)

**Context:** Per the user's explicit decision (2026-08-19) — a real, already-generated `diagnostic_reports` row, never a live LLM call from the landing. Queries the most recently generated report (`order by generated_at desc limit 1`). If the table is empty (no diagnostic has ever been generated), the section renders a clean empty state rather than fabricating content — same honesty discipline as every other section on this page (brief, news, SGI). `markdown_content` is truncated to a short excerpt (first ~280 characters, cut at the last whole word) since the full report is meant to be read on `/premium/diagnostic`, not reproduced on the landing.

- [ ] **Step 1 : Implement the component**

```tsx
// frontend/components/landing/DiagnosticSpotlight.tsx
import Link from 'next/link';

interface Props {
  report: { code: string; generated_at: string; markdown_content: string } | null;
}

function excerpt(markdown: string, maxLen = 280): string {
  const plain = markdown.replace(/[#*_`>-]/g, '').replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLen) return plain;
  const cut = plain.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace)}…`;
}

export function DiagnosticSpotlight({ report }: Props) {
  return (
    <section className="mt-10 rounded-panel border border-accent/20 bg-gradient-to-br from-accent/[0.06] to-transparent p-6 md:p-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
        <div>
          <p className="overline mb-3 text-gold-2">Diagnostic IA · Premium</p>
          <h2 className="mb-3 font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
            Votre analyste BRVM en quelques secondes.
          </h2>
          <p className="max-w-[46ch] text-sm leading-relaxed text-muted">
            Une analyse façon sell-side sur chaque société — valorisation, forces, risques — générée à
            partir des données réelles de la plateforme. Un outil d&apos;analyse complémentaire, jamais
            une recommandation d&apos;achat ou de vente.
          </p>
          <Link
            href="/premium/diagnostic"
            className="landing-hero-cta mt-5 inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-full px-5 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
          >
            Découvrir Premium <span aria-hidden>→</span>
          </Link>
        </div>

        {report ? (
          <div className="rounded-2xl border border-white/10 bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-ivory">{report.code}</span>
              <span className="text-[10px] text-faint">
                {new Date(report.generated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ivory/85">{excerpt(report.markdown_content)}</p>
            <p className="mt-4 text-[10px] text-faint">
              Exemple réel effectivement généré. Votre analyse sera personnalisée à chaque société.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-sunken/30 p-6 text-center">
            <p className="text-sm text-faint">Un exemple de diagnostic s&apos;affichera ici dès qu&apos;un rapport aura été généré.</p>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2 : Fetch a real example report in the preview page**

In `getPreviewData()`, add (independent of `asOf`, since a diagnostic report's date doesn't need to match the last market session):

```ts
  const { data: diagReport } = await supabase
    .from('diagnostic_reports')
    .select('code, generated_at, markdown_content')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
```

Add `diagnosticExample: diagReport ?? null,` to the return object, thread through the destructuring.

- [ ] **Step 3 : Wire into the preview page**

Add `import { DiagnosticSpotlight } from '@/components/landing/DiagnosticSpotlight';` and `<DiagnosticSpotlight report={diagnosticExample} />` after `<RatingSpotlight signal={spotlightSignal} />`.

- [ ] **Step 4 : Confirm the RLS policy allows this read**

`diagnostic_reports` has policy `"lecture publique diagnostic_reports" ... for select using (true)` (migration `0024`, re-confirmed in the audit's grep) — the anon/public client used here can read it without further changes. No migration needed for this task.

- [ ] **Step 5 : Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6 : Commit**

```bash
git add frontend/components/landing/DiagnosticSpotlight.tsx frontend/app/landing-preview/page.tsx
git commit -m "feat(landing-preview): spotlight diagnostic IA avec exemple réel figé (Phase 10 Task 5)"
```

---

### Task 6 : Comparatif Gratuit vs Premium

**Files:**
- Create: `frontend/components/landing/PremiumCompare.tsx`
- Modify: `frontend/app/landing-preview/page.tsx` (fetch real `subscription_plans`/`plan_features` + insert the section)

**Context:** Per audit §12/§13.4 — reads the exact same tables as `/pricing` (`subscription_plans`, `plan_features`), so the landing can never contradict the real pricing page. Real plan codes confirmed by migration `0041`: `free`, `premium`, `platinium`.

- [ ] **Step 1 : Implement the component**

```tsx
// frontend/components/landing/PremiumCompare.tsx
import Link from 'next/link';

interface PlanFeature {
  feature_label: string;
  feature_value: string | null;
}

interface Plan {
  code: string;
  name: string;
  price_monthly: number;
  is_recommended: boolean;
  features: PlanFeature[];
}

export function PremiumCompare({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) return null;
  return (
    <section className="mt-10">
      <p className="overline mb-3 text-gold-2">Formules</p>
      <h2 className="mb-6 font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
        Gratuit pour commencer, Premium pour aller plus loin.
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.code}
            className={`rounded-panel border p-6 ${p.is_recommended ? 'border-accent/40 bg-accent/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}
          >
            {p.is_recommended && <p className="overline mb-2 text-gold-2">Recommandé</p>}
            <h3 className="font-display text-xl text-ivory">{p.name}</h3>
            <p className="tabular mt-1 text-2xl font-bold text-ivory">
              {p.price_monthly > 0 ? `${p.price_monthly.toLocaleString('fr-FR')} FCFA` : 'Gratuit'}
              {p.price_monthly > 0 && <span className="text-xs font-normal text-faint"> /mois</span>}
            </p>
            <ul className="mt-4 space-y-2">
              {p.features.slice(0, 5).map((f) => (
                <li key={f.feature_label} className="flex items-start gap-2 text-xs text-muted">
                  <span className="mt-0.5 text-up" aria-hidden>✓</span>
                  <span>{f.feature_label}{f.feature_value ? ` — ${f.feature_value}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-5 text-center">
        <Link href="/pricing" className="text-sm font-medium text-ivory/80 transition-colors hover:text-gold-2">
          Comparer toutes les formules en détail →
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2 : Fetch real plans + features in the preview page**

In `getPreviewData()`, add:

```ts
  const { data: planRows } = await supabase
    .from('subscription_plans')
    .select('id, code, name, price_monthly, is_recommended, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  const planIds = (planRows ?? []).map((p) => p.id as string);
  const { data: featureRows } = planIds.length
    ? await supabase
        .from('plan_features')
        .select('plan_id, feature_label, feature_value, sort_order')
        .in('plan_id', planIds)
        .order('sort_order', { ascending: true })
    : { data: [] as { plan_id: string; feature_label: string; feature_value: string | null }[] };
  const plans = (planRows ?? []).map((p) => ({
    code: p.code as string,
    name: p.name as string,
    price_monthly: (p.price_monthly as number) ?? 0,
    is_recommended: Boolean(p.is_recommended),
    features: (featureRows ?? [])
      .filter((f) => f.plan_id === p.id)
      .map((f) => ({ feature_label: f.feature_label as string, feature_value: f.feature_value as string | null })),
  }));
```

Add `plans,` to the return object, thread through the destructuring.

- [ ] **Step 3 : Wire into the preview page**

Add `import { PremiumCompare } from '@/components/landing/PremiumCompare';` and `<PremiumCompare plans={plans} />` after `<DiagnosticSpotlight report={diagnosticExample} />`.

- [ ] **Step 4 : Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5 : Commit**

```bash
git add frontend/components/landing/PremiumCompare.tsx frontend/app/landing-preview/page.tsx
git commit -m "feat(landing-preview): comparatif gratuit vs premium depuis subscription_plans (Phase 10 Task 6)"
```

---

### Task 7 : Passe d'assemblage final + vérification visuelle complète

**Files:**
- Modify: `frontend/app/landing-preview/page.tsx` (ordering/spacing only, no new data)

**Context:** With all 6 sections now present, this task is pure layout polish — confirm the final section order matches the mandate exactly (Header → Ticker → Hero → Trust bar → Marché en direct → Heatmap → Outils → Note A–F → Diagnostic IA → Simulateur → SGI → Communauté → Premium → Brief → FAQ → Newsletter → CTA final → Footer), and fix any visual issues found in Task 1 Step 2's note about `LandingIndices` nesting.

- [ ] **Step 1 : Review section order against the mandate**

Read the current `frontend/app/landing-preview/page.tsx` top to bottom. Confirm order matches the list above. Note: this plan's Tasks 1-6 did not add a Simulateur, SGI, or Brief section to the preview — those are marked "Réutiliser tel quel" in the audit (§12, rows 10/11/12) and were deliberately left for this task to port over verbatim from `frontend/app/page.tsx` (the simulator block, lines ~411-449, and the SGI bandeau block, lines ~372-405, and the brief block, lines ~452-475 — copy the JSX and the underlying data fetches into `getPreviewData()`/`LandingPreview()`, adapting only variable names if they collide).

- [ ] **Step 2 : Port the Simulateur, SGI, and Brief sections**

Add the three missing data fetches to `getPreviewData()` (simulation via `simulateInvestment` on SNTS, `getSgiDirectory()` call, and `brief_daily` query) — copy the exact logic from `frontend/app/page.tsx` lines 142-167 (simulation), 247-256 (SGI, called outside `getData()` in production — call it the same way here, outside `getPreviewData()`), and 134-140 (brief). Add the corresponding JSX blocks, copied from `frontend/app/page.tsx` lines 372-405 (SGI), 411-449 (simulateur), 452-475 (brief), placed after `<ToolsGrid />`/`<RatingSpotlight />`/`<DiagnosticSpotlight />`/`<PremiumCompare />` and before `<SocialProof />`.

- [ ] **Step 3 : Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4 : Manual visual check, both themes**

Run `cd frontend && npm run dev`, open `/landing-preview`. Toggle the theme switch in `TasteTopbar` and confirm both light and dark render without broken contrast (per audit §5 — Hero/Footer are intentionally theme-invariant, everything else should follow the toggle). Resize to mobile width and confirm no horizontal scroll, no cut-off content.

- [ ] **Step 5 : Commit**

```bash
git add frontend/app/landing-preview/page.tsx
git commit -m "feat(landing-preview): assemblage final, simulateur/SGI/brief portés (Phase 10 Task 7)"
```

---

### Task 8 : Document de comparaison avant/après (Phase 11)

**Files:**
- Create: `docs/LANDING_REDESIGN_AVANT_APRES.md`

**Context:** Per the mandate's Phase 11 — for each section, objective/changement visuel/changement UX/fonctionnalités conservées/impact technique. This is a documentation task, no code.

- [ ] **Step 1 : Write the comparison document**

For each of the 18 mandate sections (reuse the table from `docs/LANDING_REDESIGN_AUDIT.md` §12 as the source of truth), write one short entry: what existed before, what exists in `/landing-preview` now, and confirm every "Conserver"-tagged section in the audit is verifiably unchanged in data/behavior between `/` and `/landing-preview` (same query, same table, same computed value — not just visually similar).

- [ ] **Step 2 : Commit**

```bash
git add docs/LANDING_REDESIGN_AVANT_APRES.md
git commit -m "docs(landing): comparaison avant/après refonte (Phase 11)"
```

---

## Self-review notes (writing-plans discipline)

- **Spec coverage**: all 4 "à créer" components from the audit (§13) are covered (Tasks 2-6, including Hero as a 5th "restructurer" item promoted to its own task given its HIGH complexity rating in §21). All "conserver"/"restructurer" sections are covered across Tasks 1 and 7. Phase 11 (comparison doc) is Task 8.
- **No production files touched**: every `Modify` target across all 8 tasks is `frontend/app/landing-preview/page.tsx` or a new file under `frontend/components/landing/` — never `frontend/app/page.tsx` or any existing component. This satisfies the mandate's Phase 9/10/12 constraint by construction, not by discipline alone.
- **Known open item carried into Task 2**: the `RatingBadge scoreTotal={78} confiance={82}` illustrative value in `HeroDeviceMockup` is the one deliberately-not-real number introduced by this plan — flagged explicitly in Task 2 for the code-quality reviewer to weigh in on (replace with a real fetched signal, matching `RatingSpotlight`'s pattern, or keep as a clearly-labeled illustrative example).
- **"Watchlist" tool link**: deliberately omitted from Task 3's `ToolsGrid` rather than guessed — add only once its real route is confirmed (see audit §13.1).
