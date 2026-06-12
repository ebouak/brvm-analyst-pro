# Game-Changers BRVM Analyst Pro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter 6 fonctionnalités différenciantes : score de valorisation fondamentale, backtest sur signaux réels, onboarding profil investisseur, feed d'actualités BRVM, comparateur enrichi, et mode débutant.

**Architecture:** Chaque feature est indépendante et peut être mergée séparément. Les features 1–2 sont purement frontend (calculs côté serveur, pas de nouvelle table). Les features 3–4 nécessitent des migrations Supabase. Les features 5–6 sont purement frontend.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, TailwindCSS (tokens dark-finance), Supabase PostgreSQL (anon+RLS), Recharts / Lightweight Charts.

**Codebase key facts (lire avant de toucher quoi que ce soit) :**
- Design tokens : `bg`=#030303, `surface`=#0a1417, `gold`/`accent`=#56D7FD (cyan), `up`=#3fe18b, `down`=#ff6b6b, `ivory`=#FCFCFC
- Kit UI : `@/components/ui/premium` → `SectionHeader`, `PremiumPanel`, `MetricCard`, `StatPill`, `EmptyStatePremium`
- Auth : `createClient()` depuis `@/lib/supabase/server` (Server Components) ; `createClient()` depuis `@/lib/supabase/client` (Client Components)
- Supabase `profiles` table : colonnes `id uuid PK`, `email`, `is_premium bool`, `premium_since`, `created_at`, `updated_at` — trigger `on_auth_user_created` la peuple automatiquement
- `lib/financials/fundamentals.ts` : `calculateFundamentals(p: FundamentalsParams): FundamentalRatios` — retourne PER, PB, ROE, BPA, etc.
- `lib/backtest.ts` : `runBacktest(input: BacktestInput): BacktestResult` — prend `closes[]`, `signals[]`, `dates[]`, retourne courbe équité, métriques
- Backtest page existante : `/backtest/page.tsx` — utilise `simpleSignal()` (momentum naïf) au lieu des vrais signaux
- Compare page existante : `/actions/compare/page.tsx` avec `CompareChart`, `CompareSelector`, `CompareStats`
- DB password migration : `Dieusauveur007/` (avec slash final) ; host : `aws-0-eu-west-3.pooler.supabase.com:6543` user `postgres.vozwivhmjfmnnnjbbkpt`

---

## File Structure

### Feature 1 — Score valorisation fondamentale
- **Create** `frontend/lib/financials/valuation.ts` — fonctions pures `grahamNumber()`, `dcfSimple()`, `valuationScore()`, `valuationBadge()`
- **Modify** `frontend/app/actions/[code]/financials/page.tsx` — ajouter badge + panneau valorisation
- **Modify** `frontend/app/actions/page.tsx` — colonne badge dans le tableau marché

### Feature 2 — Backtest sur signaux réels
- **Modify** `frontend/app/backtest/page.tsx` — fetch `signals_daily` et passer les vrais signaux à `runBacktest()` ; fallback `simpleSignal()` si aucun signal
- **Modify** `frontend/app/actions/[code]/page.tsx` — ajouter bouton "Backtester" → `/backtest?code=XXX`

### Feature 3 — Onboarding profil investisseur
- **Create** `supabase/migrations/0027_investor_profile.sql` — colonnes `profil`, `horizon`, `mode_debutant`, `onboarding_done` sur `profiles`
- **Create** `frontend/components/OnboardingModal.tsx` — modale 3 étapes (profil, horizon, mode débutant) ; `'use client'`
- **Create** `frontend/app/onboarding/actions.ts` — Server Action `saveInvestorProfile()`
- **Modify** `frontend/app/layout.tsx` — afficher `<OnboardingModal>` si `onboarding_done = false`

### Feature 4 — Feed actualités BRVM/COSUMAF
- **Create** `supabase/migrations/0028_brvm_news.sql` — table `brvm_news`
- **Create** `scraper/src/scrapers/brvmNews.ts` — scraper brvm.org/fr/actualites/ + cosumaf.org/actualites
- **Modify** `scraper/src/persistence/repository.ts` — `upsertNews()`
- **Create** `scraper/src/scrapers/runNews.ts` — orchestrateur
- **Modify** `scraper/src/index.ts` — commande `news`
- **Create** `frontend/app/actualites/page.tsx` — page fil d'actualités
- **Create** `frontend/components/dashboard/NewsFeed.tsx` — widget 5 dernières actus sur dashboard
- **Modify** `frontend/app/dashboard/page.tsx` — intégrer NewsFeed

### Feature 5 — Comparateur enrichi
- **Modify** `frontend/app/actions/compare/page.tsx` — ajouter section "Fondamentaux côte à côte" + "Verdict"
- **Create** `frontend/components/CompareFundamentals.tsx` — tableau comparatif fondamentaux
- **Create** `frontend/components/CompareVerdict.tsx` — verdict automatique (badge le plus attractif)

### Feature 6 — Mode investisseur débutant
- **Create** `frontend/lib/beginner-mode.tsx` — React context + hook `useBeginnerMode()` ; persistence localStorage
- **Modify** `frontend/app/layout.tsx` — provider `BeginnerModeProvider`
- **Create** `frontend/components/BeginnerToggle.tsx` — switch dans la nav/paramètres
- **Modify** `frontend/components/SignalBadge.tsx` — afficher explication simplifiée si mode actif
- **Modify** `frontend/components/TechnicalSummary.tsx` — tooltip simplifié si mode actif
- **Modify** `frontend/app/actions/[code]/page.tsx` — `<BeginnerHint>` inline sur RSI, MACD, score

---

## Task 1 — Score de valorisation fondamentale

**Files:**
- Create: `frontend/lib/financials/valuation.ts`
- Modify: `frontend/app/actions/[code]/financials/page.tsx`
- Modify: `frontend/app/actions/page.tsx`

- [ ] **Step 1 : Créer `frontend/lib/financials/valuation.ts`**

```ts
import type { FundamentalRatios } from './types';

export type ValuationVerdict = 'sous-evalue' | 'juste-prix' | 'surcote' | 'inconnu';

export interface ValuationResult {
  grahamNumber: number | null;
  dcfValue: number | null;
  marginOfSafety: number | null; // (grahamNumber - cours) / grahamNumber, en %
  verdict: ValuationVerdict;
  scoreValorisation: number | null; // 0-100
}

/**
 * Graham Number = sqrt(22.5 × BPA × VCA)
 * VCA (Valeur Comptable par Action) = capitaux_propres / shares
 */
export function grahamNumber(
  bpa: number | null,
  vca: number | null,
): number | null {
  if (!bpa || bpa <= 0 || !vca || vca <= 0) return null;
  return Math.sqrt(22.5 * bpa * vca);
}

/**
 * DCF ultra-simplifié : FCF × (1 + g) / (r - g) / shares
 * g = 5% (croissance perpétuelle), r = 10% (taux d'actualisation)
 */
export function dcfSimple(
  fcf: number | null,
  shares: number | null,
  g = 0.05,
  r = 0.10,
): number | null {
  if (!fcf || fcf <= 0 || !shares || shares <= 0 || r <= g) return null;
  return (fcf * (1 + g)) / (r - g) / shares;
}

export function computeValuation(
  ratios: FundamentalRatios,
  coursActuel: number | null,
  fcf: number | null,
  shares: number | null,
): ValuationResult {
  const vca =
    ratios.capitalisation && ratios.per && ratios.bpa
      ? ratios.bpa / (ratios.per === 0 ? null! : 1) // fallback
      : null;

  // VCA depuis PB et cours : VCA = cours / PB
  const vcaFromPB =
    coursActuel && ratios.pb && ratios.pb > 0
      ? coursActuel / ratios.pb
      : null;

  const graham = grahamNumber(ratios.bpa, vcaFromPB);
  const dcf = dcfSimple(fcf, shares);

  // Marge de sécurité Graham
  const marginOfSafety =
    graham && coursActuel
      ? ((graham - coursActuel) / graham) * 100
      : null;

  // Score composite 0-100 : combine margin of safety + PER normalisé + PB
  let score: number | null = null;
  const scores: number[] = [];

  if (marginOfSafety !== null) {
    // +50 si MOS > 30%, 0 si MOS < -30%
    scores.push(Math.max(0, Math.min(100, 50 + marginOfSafety)));
  }
  if (ratios.per !== null) {
    // PER idéal < 15 (score 100) → > 30 (score 0)
    scores.push(Math.max(0, Math.min(100, ((30 - ratios.per) / 15) * 100)));
  }
  if (ratios.pb !== null) {
    // PB idéal < 1 (score 100) → > 3 (score 0)
    scores.push(Math.max(0, Math.min(100, ((3 - ratios.pb) / 2) * 100)));
  }
  if (scores.length > 0) {
    score = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  let verdict: ValuationVerdict = 'inconnu';
  if (score !== null) {
    if (score >= 60) verdict = 'sous-evalue';
    else if (score >= 35) verdict = 'juste-prix';
    else verdict = 'surcote';
  }

  return { grahamNumber: graham, dcfValue: dcf, marginOfSafety, verdict, scoreValorisation: score };
}

export const VERDICT_LABELS: Record<ValuationVerdict, string> = {
  'sous-evalue': 'Sous-évalué',
  'juste-prix': 'Juste prix',
  'surcote': 'Surcoté',
  'inconnu': 'Données insuffisantes',
};

export const VERDICT_COLORS: Record<ValuationVerdict, string> = {
  'sous-evalue': 'text-up border-up/40 bg-up/10',
  'juste-prix': 'text-gold border-gold/40 bg-gold/10',
  'surcote': 'text-down border-down/40 bg-down/10',
  'inconnu': 'text-faint border-border bg-surface',
};
```

- [ ] **Step 2 : Ajouter badge valorisation sur `frontend/app/actions/[code]/financials/page.tsx`**

Après le calcul de `ratios`, ajouter :

```tsx
import { computeValuation, VERDICT_LABELS, VERDICT_COLORS } from '@/lib/financials/valuation';

// Dans le composant, après `const ratios = calculateFundamentals(...)` :
const valuation = computeValuation(
  ratios,
  data.latestDaily?.cours_jour ?? null,
  latestCashflow?.flux_tresorerie_disponible ?? null,
  data.instrument.shares,
);
```

Dans le JSX, après le header de page (avant `<WeekRange52>`), ajouter un panneau valorisation :

```tsx
{/* Panneau valorisation */}
<div className="bg-surface border border-border rounded-xl p-4 flex flex-wrap items-center gap-6">
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted uppercase tracking-wide">Valorisation</span>
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${VERDICT_COLORS[valuation.verdict]}`}>
      {VERDICT_LABELS[valuation.verdict]}
    </span>
  </div>
  {valuation.grahamNumber && (
    <div className="text-xs text-muted">
      Graham : <span className="tabular text-ivory font-medium">{Math.round(valuation.grahamNumber).toLocaleString('fr-FR')} FCFA</span>
    </div>
  )}
  {valuation.marginOfSafety !== null && (
    <div className="text-xs text-muted">
      Marge sécurité : <span className={`tabular font-medium ${valuation.marginOfSafety >= 0 ? 'text-up' : 'text-down'}`}>
        {valuation.marginOfSafety >= 0 ? '+' : ''}{valuation.marginOfSafety.toFixed(1)}%
      </span>
    </div>
  )}
  {valuation.scoreValorisation !== null && (
    <div className="text-xs text-muted">
      Score : <span className="tabular text-ivory font-medium">{Math.round(valuation.scoreValorisation)}/100</span>
    </div>
  )}
  {valuation.verdict === 'inconnu' && (
    <p className="text-xs text-faint">BPA, PB ou FCF manquants pour calculer la valorisation.</p>
  )}
</div>
```

- [ ] **Step 3 : Ajouter colonne "Valorisation" dans `frontend/app/actions/page.tsx`**

Lire le fichier, trouver le tableau des actions et ajouter une colonne badge. Le tableau se trouve dans la section qui mappe `actions`. Ajouter dans l'en-tête `<th>` :

```tsx
<th className="px-3 py-2 text-left text-[10px] text-faint uppercase hidden xl:table-cell">Valorisation</th>
```

Et dans chaque ligne, après la colonne signal/score, ajouter :

```tsx
// En haut du fichier, importer :
import { computeValuation, VERDICT_LABELS, VERDICT_COLORS } from '@/lib/financials/valuation';
import type { FundamentalRatios } from '@/lib/financials/types';
```

```tsx
// Dans la cellule de la ligne action (a = ActionDaily + ratios optionnels) :
<td className="px-3 py-2 hidden xl:table-cell">
  {(() => {
    const verdict = (a as { valVerdict?: string }).valVerdict;
    if (!verdict) return <span className="text-faint text-xs">—</span>;
    const cls = VERDICT_COLORS[verdict as keyof typeof VERDICT_COLORS] ?? 'text-faint';
    return (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cls}`}>
        {VERDICT_LABELS[verdict as keyof typeof VERDICT_LABELS]}
      </span>
    );
  })()}
</td>
```

> Note : Pour éviter de charger les fondamentaux de 48 actions sur la page liste, le verdict est calculé uniquement avec les données déjà présentes (cours + signal score). Si `score_total` > 70 et données insuffisantes, afficher `—`. L'implémentation réelle passe par `brvm_instruments.shares` + la vue `mv_signal_inputs` qui contient déjà des métriques. Pour la v1, laisser `—` sur la liste et ne montrer la valorisation complète que sur la fiche financials. Revenir sur ce point en Task 1b si le temps le permet.

- [ ] **Step 4 : Vérifier le typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/financials/valuation.ts frontend/app/actions/\[code\]/financials/page.tsx
git commit -m "feat(valuation): Graham Number + DCF simplifié + badge Sous-évalué/Juste prix/Surcoté"
```

---

## Task 2 — Backtest sur signaux réels + bouton fiche action

**Files:**
- Modify: `frontend/app/backtest/page.tsx`
- Modify: `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1 : Modifier `frontend/app/backtest/page.tsx` pour utiliser les vrais signaux**

Lire le fichier. Trouver la section `if (selectedCode)` qui fetch les prix et appelle `simpleSignal()`. Remplacer par :

```ts
// Fetch prix ET signaux en parallèle
const [{ data: rows }, { data: sigRows }] = await Promise.all([
  (() => {
    let q = supabase
      .from('brvm_actions_daily')
      .select('cours_jour, date_marche')
      .eq('code', selectedCode)
      .order('date_marche', { ascending: true })
      .not('cours_jour', 'is', null);
    if (dateFrom) q = q.gte('date_marche', dateFrom);
    else if (periodToDate(period)) q = q.gte('date_marche', periodToDate(period)!);
    if (dateTo) q = q.lte('date_marche', dateTo);
    return q;
  })(),
  (() => {
    let q = supabase
      .from('signals_daily')
      .select('signal, date_marche')
      .eq('code', selectedCode)
      .order('date_marche', { ascending: true });
    if (dateFrom) q = q.gte('date_marche', dateFrom);
    else if (periodToDate(period)) q = q.gte('date_marche', periodToDate(period)!);
    if (dateTo) q = q.lte('date_marche', dateTo);
    return q;
  })(),
]);

const priceRows = (rows ?? []) as { cours_jour: number; date_marche: string }[];
const signalMap = new Map(
  ((sigRows ?? []) as { signal: SignalLabel; date_marche: string }[]).map((s) => [s.date_marche, s.signal])
);

if (priceRows.length < 2) {
  noData = true;
} else {
  closes = priceRows.map((r) => r.cours_jour);
  dates = priceRows.map((r) => r.date_marche);
  // Utilise le vrai signal si disponible, sinon fallback momentum
  const signals: SignalLabel[] = dates.map((d, i) =>
    signalMap.has(d) ? signalMap.get(d)! : simpleSignal(closes)[i]!
  );
  const hasRealSignals = dates.some((d) => signalMap.has(d));
  result = runBacktest({ closes, signals, dates, feesPct, slippagePct });
  // Passer hasRealSignals à l'UI
  (result as BacktestResult & { hasRealSignals?: boolean }).hasRealSignals = hasRealSignals;
}
```

Ajouter le type augmenté en haut du fichier :

```ts
type BacktestResultEx = BacktestResult & { hasRealSignals?: boolean };
```

Changer la déclaration `let result` en `let result: BacktestResultEx | null = null;`.

Dans le JSX, après les `StatPill` de couverture, ajouter un badge source de signal :

```tsx
{result && (
  <StatPill tone={(result as BacktestResultEx).hasRealSignals ? 'emerald' : 'neutral'}>
    {(result as BacktestResultEx).hasRealSignals
      ? 'Signaux BRVM Analyst Pro'
      : 'Signal momentum (fallback)'}
  </StatPill>
)}
```

- [ ] **Step 2 : Ajouter bouton "Backtester" sur la fiche action `/actions/[code]/page.tsx`**

Lire le fichier. Trouver la section en-tête de la fiche (SectionHeader ou bloc titre + cours). Ajouter, juste après les boutons existants (Publications, etc.) :

```tsx
<Link
  href={`/backtest?code=${code}`}
  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:border-cyan/40 hover:text-cyan transition"
>
  ◈ Backtester
</Link>
```

- [ ] **Step 3 : Vérifier le typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/backtest/page.tsx frontend/app/actions/\[code\]/page.tsx
git commit -m "feat(backtest): signaux réels depuis signals_daily + fallback momentum + bouton fiche action"
```

---

## Task 3 — Onboarding profil investisseur

**Files:**
- Create: `supabase/migrations/0027_investor_profile.sql`
- Create: `frontend/components/OnboardingModal.tsx`
- Create: `frontend/app/onboarding/actions.ts`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1 : Créer la migration `0027_investor_profile.sql`**

```sql
-- supabase/migrations/0027_investor_profile.sql
-- Ajoute les colonnes profil investisseur et mode débutant à la table profiles.

alter table public.profiles
  add column if not exists profil text check (profil in ('prudent','modere','agressif')),
  add column if not exists horizon text check (horizon in ('court','moyen','long')),
  add column if not exists mode_debutant boolean not null default false,
  add column if not exists onboarding_done boolean not null default false;

-- Politique UPDATE : l'utilisateur peut mettre à jour son propre profil
create policy if not exists "profil modifiable par le propriétaire"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

- [ ] **Step 2 : Appliquer la migration**

```bash
node -e "
const pg = require('pg');
const client = new pg.Client({
  host: 'aws-0-eu-west-3.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.vozwivhmjfmnnnjbbkpt',
  password: 'Dieusauveur007/',
  ssl: { rejectUnauthorized: false },
});
const fs = require('fs');
client.connect().then(() => client.query(fs.readFileSync('supabase/migrations/0027_investor_profile.sql', 'utf8'))).then(() => { console.log('OK'); client.end(); }).catch(e => { console.error(e.message); client.end(); });
"
```

Expected: `OK`

- [ ] **Step 3 : Créer `frontend/app/onboarding/actions.ts`**

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveInvestorProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  const profil = formData.get('profil') as string | null;
  const horizon = formData.get('horizon') as string | null;
  const mode_debutant = formData.get('mode_debutant') === 'true';

  const { error } = await supabase
    .from('profiles')
    .update({ profil, horizon, mode_debutant, onboarding_done: true })
    .eq('id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { success: true };
}
```

- [ ] **Step 4 : Créer `frontend/components/OnboardingModal.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { saveInvestorProfile } from '@/app/onboarding/actions';

type Step = 1 | 2 | 3;

const PROFILS = [
  { key: 'prudent', label: 'Prudent', desc: 'Préserver le capital, faible volatilité' },
  { key: 'modere', label: 'Modéré', desc: 'Équilibre rendement / risque' },
  { key: 'agressif', label: 'Agressif', desc: 'Croissance maximale, risque assumé' },
] as const;

const HORIZONS = [
  { key: 'court', label: 'Court terme', desc: '< 1 an' },
  { key: 'moyen', label: 'Moyen terme', desc: '1 – 5 ans' },
  { key: 'long', label: 'Long terme', desc: '> 5 ans' },
] as const;

export default function OnboardingModal() {
  const [step, setStep] = useState<Step>(1);
  const [profil, setProfil] = useState<string>('modere');
  const [horizon, setHorizon] = useState<string>('moyen');
  const [debutant, setDebutant] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const fd = new FormData();
    fd.set('profil', profil);
    fd.set('horizon', horizon);
    fd.set('mode_debutant', String(debutant));
    startTransition(() => { void saveInvestorProfile(fd); });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl shadow-modal w-full max-w-md mx-4 p-6 space-y-6">

        {/* Étape 1 : Profil */}
        {step === 1 && (
          <>
            <div className="space-y-1">
              <p className="text-[10px] text-faint uppercase tracking-wide">Bienvenue · Étape 1/3</p>
              <h2 className="text-lg font-semibold text-ivory">Quel est votre profil ?</h2>
              <p className="text-xs text-muted">Personnalise vos signaux et recommandations.</p>
            </div>
            <div className="space-y-2">
              {PROFILS.map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setProfil(key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    profil === key
                      ? 'border-cyan/50 bg-cyan/10 text-ivory'
                      : 'border-border text-muted hover:border-cyan/30'
                  }`}
                >
                  <span className="font-semibold text-sm">{label}</span>
                  <span className="text-xs text-faint ml-2">{desc}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setStep(2)}
              className="w-full py-2.5 rounded-xl bg-cyan/90 text-bg font-semibold text-sm hover:bg-cyan transition">
              Suivant →
            </button>
          </>
        )}

        {/* Étape 2 : Horizon */}
        {step === 2 && (
          <>
            <div className="space-y-1">
              <p className="text-[10px] text-faint uppercase tracking-wide">Étape 2/3</p>
              <h2 className="text-lg font-semibold text-ivory">Votre horizon d'investissement ?</h2>
            </div>
            <div className="space-y-2">
              {HORIZONS.map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHorizon(key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    horizon === key
                      ? 'border-cyan/50 bg-cyan/10 text-ivory'
                      : 'border-border text-muted hover:border-cyan/30'
                  }`}
                >
                  <span className="font-semibold text-sm">{label}</span>
                  <span className="text-xs text-faint ml-2">{desc}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm hover:border-cyan/30 transition">
                ← Retour
              </button>
              <button type="button" onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-xl bg-cyan/90 text-bg font-semibold text-sm hover:bg-cyan transition">
                Suivant →
              </button>
            </div>
          </>
        )}

        {/* Étape 3 : Mode débutant */}
        {step === 3 && (
          <>
            <div className="space-y-1">
              <p className="text-[10px] text-faint uppercase tracking-wide">Étape 3/3</p>
              <h2 className="text-lg font-semibold text-ivory">Votre niveau d'expérience ?</h2>
              <p className="text-xs text-muted">Le mode débutant remplace le jargon par des explications simples.</p>
            </div>
            <div className="space-y-2">
              {[
                { val: false, label: 'Investisseur averti', desc: 'Afficher les termes techniques complets' },
                { val: true, label: 'Mode débutant', desc: 'Explications simplifiées et contexte pédagogique' },
              ].map(({ val, label, desc }) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setDebutant(val)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    debutant === val
                      ? 'border-cyan/50 bg-cyan/10 text-ivory'
                      : 'border-border text-muted hover:border-cyan/30'
                  }`}
                >
                  <span className="font-semibold text-sm">{label}</span>
                  <span className="text-xs text-faint ml-2">{desc}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm hover:border-cyan/30 transition">
                ← Retour
              </button>
              <button type="button" onClick={submit} disabled={pending}
                className="flex-1 py-2.5 rounded-xl bg-up/90 text-bg font-semibold text-sm hover:bg-up transition disabled:opacity-50">
                {pending ? 'Enregistrement…' : 'Commencer →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5 : Afficher la modale dans `frontend/app/layout.tsx`**

Lire le fichier. Dans `RootLayout`, après avoir récupéré `user`, ajouter :

```ts
// Après la récupération de user + isPremium, ajouter :
let onboardingDone = true;
if (user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_done')
    .eq('id', user.id)
    .maybeSingle();
  onboardingDone = profile?.onboarding_done ?? false;
}
```

Importer le composant en haut du fichier :

```ts
import OnboardingModal from '@/components/OnboardingModal';
```

Dans le JSX retourné, avant `</body>`, ajouter :

```tsx
{user && !onboardingDone && <OnboardingModal />}
```

- [ ] **Step 6 : Vérifier le typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7 : Commit**

```bash
git add supabase/migrations/0027_investor_profile.sql \
        frontend/components/OnboardingModal.tsx \
        frontend/app/onboarding/actions.ts \
        frontend/app/layout.tsx
git commit -m "feat(onboarding): modale 3 étapes profil/horizon/niveau + migration profiles"
```

---

## Task 4 — Feed actualités BRVM/COSUMAF

**Files:**
- Create: `supabase/migrations/0028_brvm_news.sql`
- Create: `scraper/src/scrapers/brvmNews.ts`
- Modify: `scraper/src/persistence/repository.ts`
- Create: `scraper/src/scrapers/runNews.ts`
- Modify: `scraper/src/index.ts`
- Create: `frontend/app/actualites/page.tsx`
- Create: `frontend/components/dashboard/NewsFeed.tsx`
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1 : Créer la migration `0028_brvm_news.sql`**

```sql
-- supabase/migrations/0028_brvm_news.sql
create table if not exists public.brvm_news (
  id              uuid primary key default gen_random_uuid(),
  dedupe_hash     text unique not null,       -- sha256(titre+date+source)
  titre           text not null,
  date_publication date not null,
  source          text not null check (source in ('brvm','cosumaf','autre')),
  source_url      text,
  resume          text,
  instrument_code text references public.brvm_instruments(code) on update cascade,
  secteur         text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_brvm_news_date on public.brvm_news (date_publication desc);
create index if not exists idx_brvm_news_code on public.brvm_news (instrument_code);
alter table public.brvm_news enable row level security;
create policy "actualites publiques" on public.brvm_news for select using (true);
```

- [ ] **Step 2 : Appliquer la migration**

```bash
node -e "
const pg = require('pg');
const client = new pg.Client({
  host: 'aws-0-eu-west-3.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.vozwivhmjfmnnnjbbkpt',
  password: 'Dieusauveur007/',
  ssl: { rejectUnauthorized: false },
});
const fs = require('fs');
client.connect().then(() => client.query(fs.readFileSync('supabase/migrations/0028_brvm_news.sql', 'utf8'))).then(() => { console.log('OK'); client.end(); }).catch(e => { console.error(e.message); client.end(); });
"
```

Expected: `OK`

- [ ] **Step 3 : Créer `scraper/src/scrapers/brvmNews.ts`**

```ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import pino from 'pino';

const log = pino({ name: 'brvmNews' });

export interface NewsItem {
  dedupe_hash: string;
  titre: string;
  date_publication: string; // YYYY-MM-DD
  source: 'brvm' | 'cosumaf';
  source_url: string | null;
  resume: string | null;
  instrument_code: string | null;
}

function hashItem(titre: string, date: string, source: string): string {
  return createHash('sha256').update(`${titre}|${date}|${source}`).digest('hex');
}

function parseDate(raw: string): string | null {
  // Formats rencontrés : "12/06/2026", "12 juin 2026", "2026-06-12"
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0]!;
  const fr = raw.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (fr) return `${fr[3]}-${fr[2]!.padStart(2, '0')}-${fr[1]!.padStart(2, '0')}`;
  const mois: Record<string, string> = {
    janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
    juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
  };
  const litteral = raw.toLowerCase().match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (litteral) {
    const m = mois[litteral[2]!];
    if (m) return `${litteral[3]}-${m}-${litteral[1]!.padStart(2, '0')}`;
  }
  return null;
}

async function scrapeBrvmActualites(): Promise<NewsItem[]> {
  const url = 'https://www.brvm.org/fr/actualites';
  try {
    const { data } = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(data);
    const items: NewsItem[] = [];
    // Sélectionner les liens d'actualités — adapter le sélecteur si la structure change
    $('article, .news-item, .actualite-item, [class*="article"]').each((_, el) => {
      const titre = $(el).find('h2, h3, .titre, [class*="title"]').first().text().trim();
      const dateRaw = $(el).find('time, .date, [class*="date"]').first().text().trim();
      const lien = $(el).find('a').first().attr('href');
      const resume = $(el).find('p, .resume, [class*="excerpt"]').first().text().trim().slice(0, 500);
      if (!titre || titre.length < 5) return;
      const date = parseDate(dateRaw) ?? new Date().toISOString().slice(0, 10);
      const source_url = lien
        ? lien.startsWith('http') ? lien : `https://www.brvm.org${lien}`
        : null;
      items.push({
        dedupe_hash: hashItem(titre, date, 'brvm'),
        titre,
        date_publication: date,
        source: 'brvm',
        source_url,
        resume: resume || null,
        instrument_code: null,
      });
    });
    log.info({ count: items.length }, 'BRVM actualités scrapées');
    return items;
  } catch (err) {
    log.warn({ err }, 'Échec scraping brvm.org/actualites — retour tableau vide');
    return [];
  }
}

async function scrapeCosumaf(): Promise<NewsItem[]> {
  const url = 'https://www.cosumaf.org/actualites';
  try {
    const { data } = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(data);
    const items: NewsItem[] = [];
    $('article, .actualite, [class*="news"], [class*="article"]').each((_, el) => {
      const titre = $(el).find('h2, h3, .titre, [class*="title"]').first().text().trim();
      const dateRaw = $(el).find('time, .date, [class*="date"]').first().text().trim();
      const lien = $(el).find('a').first().attr('href');
      const resume = $(el).find('p, .resume').first().text().trim().slice(0, 500);
      if (!titre || titre.length < 5) return;
      const date = parseDate(dateRaw) ?? new Date().toISOString().slice(0, 10);
      const source_url = lien
        ? lien.startsWith('http') ? lien : `https://www.cosumaf.org${lien}`
        : null;
      items.push({
        dedupe_hash: hashItem(titre, date, 'cosumaf'),
        titre,
        date_publication: date,
        source: 'cosumaf',
        source_url,
        resume: resume || null,
        instrument_code: null,
      });
    });
    log.info({ count: items.length }, 'COSUMAF actualités scrapées');
    return items;
  } catch (err) {
    log.warn({ err }, 'Échec scraping cosumaf.org — retour tableau vide');
    return [];
  }
}

export async function scrapeAllNews(): Promise<NewsItem[]> {
  const [brvm, cosumaf] = await Promise.all([scrapeBrvmActualites(), scrapeCosumaf()]);
  return [...brvm, ...cosumaf];
}
```

- [ ] **Step 4 : Ajouter `upsertNews()` dans `scraper/src/persistence/repository.ts`**

Lire le fichier. À la fin, ajouter :

```ts
import type { NewsItem } from '../scrapers/brvmNews.js';

export async function upsertNews(items: NewsItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const { data, error } = await supabase
    .from('brvm_news')
    .upsert(items, { onConflict: 'dedupe_hash', ignoreDuplicates: true });
  if (error) throw new Error(`upsert brvm_news: ${error.message}`);
  return items.length;
}
```

- [ ] **Step 5 : Créer `scraper/src/scrapers/runNews.ts`**

```ts
import { scrapeAllNews } from './brvmNews.js';
import { upsertNews } from '../persistence/repository.js';
import pino from 'pino';

const log = pino({ name: 'runNews' });

export async function runNews(): Promise<void> {
  log.info('Démarrage scraping actualités BRVM + COSUMAF');
  const items = await scrapeAllNews();
  const nb = await upsertNews(items);
  log.info({ nb }, 'Actualités insérées/ignorées');
}
```

- [ ] **Step 6 : Ajouter commande `news` dans `scraper/src/index.ts`**

Lire le fichier. Dans le switch/if principal des commandes, ajouter :

```ts
case 'news': {
  const { runNews } = await import('./scrapers/runNews.js');
  await runNews();
  break;
}
```

Et dans `package.json` scraper, ajouter :

```json
"news": "tsx src/index.ts news"
```

- [ ] **Step 7 : Créer `frontend/app/actualites/page.tsx`**

```tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SectionHeader } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Actualités BRVM' };

const SOURCE_LABELS: Record<string, string> = {
  brvm: 'BRVM',
  cosumaf: 'COSUMAF',
  autre: 'Autre',
};

export default async function ActualitesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('brvm_news')
    .select('*')
    .order('date_publication', { ascending: false })
    .limit(100);

  const news = (data ?? []) as Array<{
    id: string;
    titre: string;
    date_publication: string;
    source: string;
    source_url: string | null;
    resume: string | null;
    instrument_code: string | null;
    secteur: string | null;
  }>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Marché · BRVM · COSUMAF"
        title="Actualités"
        subtitle="Communiqués officiels BRVM et COSUMAF mis à jour quotidiennement."
      />

      {news.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm">Aucune actualité disponible. Lancez <code className="text-cyan text-xs">npm run news</code> dans le scraper pour alimenter le fil.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {news.map((item) => (
            <div key={item.id} className="bg-surface border border-border rounded-xl p-4 hover:border-cyan/30 transition space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-cyan/30 text-cyan bg-cyan/10 font-semibold">
                  {SOURCE_LABELS[item.source] ?? item.source}
                </span>
                <span className="text-xs text-faint tabular">{item.date_publication}</span>
                {item.instrument_code && (
                  <Link href={`/actions/${item.instrument_code}`} className="text-xs text-gold hover:underline">{item.instrument_code}</Link>
                )}
              </div>
              {item.source_url ? (
                <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold text-ivory hover:text-cyan transition line-clamp-2">
                  {item.titre}
                </a>
              ) : (
                <p className="text-sm font-semibold text-ivory line-clamp-2">{item.titre}</p>
              )}
              {item.resume && <p className="text-xs text-muted line-clamp-2">{item.resume}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8 : Créer `frontend/components/dashboard/NewsFeed.tsx`**

```tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

interface NewsRow {
  id: string;
  titre: string;
  date_publication: string;
  source: string;
  source_url: string | null;
}

export default async function NewsFeed() {
  const supabase = createClient();
  const { data } = await supabase
    .from('brvm_news')
    .select('id, titre, date_publication, source, source_url')
    .order('date_publication', { ascending: false })
    .limit(5);

  const news = (data ?? []) as NewsRow[];

  if (news.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted uppercase tracking-wide">Actualités</span>
        <Link href="/actualites" className="text-[10px] text-cyan hover:underline">Tout voir →</Link>
      </div>
      <div className="space-y-2">
        {news.map((n) => (
          <div key={n.id} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[9px] text-cyan uppercase font-bold">{n.source}</span>
              <span className="text-[9px] text-faint">{n.date_publication}</span>
            </div>
            {n.source_url ? (
              <a href={n.source_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-ivory hover:text-cyan transition line-clamp-2 leading-tight">
                {n.titre}
              </a>
            ) : (
              <p className="text-xs text-ivory line-clamp-2 leading-tight">{n.titre}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 9 : Intégrer NewsFeed dans `frontend/app/dashboard/page.tsx`**

Lire le fichier. Importer le composant (Server Component — import direct) et l'ajouter dans la colonne "Brief analytique" ou en 5e colonne selon la disposition. Chercher le bloc `<BriefCard>` ou équivalent et ajouter après :

```tsx
import NewsFeed from '@/components/dashboard/NewsFeed';
// ... dans le JSX :
<NewsFeed />
```

- [ ] **Step 10 : Vérifier le typecheck**

```bash
cd frontend && npx tsc --noEmit && cd ../scraper && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11 : Commit**

```bash
git add supabase/migrations/0028_brvm_news.sql \
        scraper/src/scrapers/brvmNews.ts \
        scraper/src/scrapers/runNews.ts \
        scraper/src/persistence/repository.ts \
        scraper/src/index.ts \
        frontend/app/actualites/page.tsx \
        frontend/components/dashboard/NewsFeed.tsx \
        frontend/app/dashboard/page.tsx
git commit -m "feat(news): feed actualités BRVM+COSUMAF — scraper + table + page + widget dashboard"
```

---

## Task 5 — Comparateur enrichi avec fondamentaux + verdict

**Files:**
- Create: `frontend/components/CompareFundamentals.tsx`
- Create: `frontend/components/CompareVerdict.tsx`
- Modify: `frontend/app/actions/compare/page.tsx`

- [ ] **Step 1 : Créer `frontend/components/CompareFundamentals.tsx`**

```tsx
import type { FundamentalRatios } from '@/lib/financials/types';
import { computeValuation, VERDICT_LABELS, VERDICT_COLORS } from '@/lib/financials/valuation';

interface FundaRow {
  code: string;
  designation: string | null;
  ratios: FundamentalRatios;
  coursActuel: number | null;
  fcf: number | null;
  shares: number | null;
}

const COLORS = ['#3fe18b', '#56D7FD', '#ffb300', '#7e57c2', '#f44336', '#e6e9f0'];

const ROWS: { key: keyof FundamentalRatios; label: string; fmt: (v: number) => string }[] = [
  { key: 'per',                label: 'PER',                     fmt: (v) => v.toFixed(1) + 'x' },
  { key: 'pb',                 label: 'P/B',                     fmt: (v) => v.toFixed(2) + 'x' },
  { key: 'rendement_dividende',label: 'Rdt dividende',            fmt: (v) => v.toFixed(2) + '%' },
  { key: 'roe',                label: 'ROE',                     fmt: (v) => v.toFixed(1) + '%' },
  { key: 'marge_nette',        label: 'Marge nette',             fmt: (v) => v.toFixed(1) + '%' },
  { key: 'bpa',                label: 'BPA (FCFA)',              fmt: (v) => Math.round(v).toLocaleString('fr-FR') },
  { key: 'dette_sur_capitaux_propres', label: 'Dette / Capitaux', fmt: (v) => v.toFixed(2) + 'x' },
  { key: 'croissance_ca',      label: 'Croiss. CA',             fmt: (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%' },
];

export default function CompareFundamentals({ rows }: { rows: FundaRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs text-muted uppercase tracking-wide">Fondamentaux comparés</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left text-faint font-normal">Indicateur</th>
              {rows.map((r, i) => (
                <th key={r.code} className="px-4 py-2 text-right font-semibold"
                  style={{ color: COLORS[i % COLORS.length] }}>
                  {r.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, label, fmt }) => (
              <tr key={key} className="border-b border-border/50 last:border-0 hover:bg-white/2 transition">
                <td className="px-4 py-2 text-muted">{label}</td>
                {rows.map((r) => {
                  const v = r.ratios[key];
                  return (
                    <td key={r.code} className="px-4 py-2 text-right tabular text-ivory">
                      {v != null ? fmt(v as number) : <span className="text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Ligne valorisation */}
            <tr className="border-b border-border/50 hover:bg-white/2 transition">
              <td className="px-4 py-2 text-muted font-semibold">Valorisation</td>
              {rows.map((r) => {
                const val = computeValuation(r.ratios, r.coursActuel, r.fcf, r.shares);
                return (
                  <td key={r.code} className="px-4 py-2 text-right">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${VERDICT_COLORS[val.verdict]}`}>
                      {VERDICT_LABELS[val.verdict]}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Créer `frontend/components/CompareVerdict.tsx`**

```tsx
import type { FundamentalRatios } from '@/lib/financials/types';
import { computeValuation, VERDICT_LABELS } from '@/lib/financials/valuation';

interface FundaRow {
  code: string;
  designation: string | null;
  ratios: FundamentalRatios;
  coursActuel: number | null;
  fcf: number | null;
  shares: number | null;
  perfPct?: number | null; // performance sur la période sélectionnée
}

export default function CompareVerdict({ rows }: { rows: FundaRow[] }) {
  if (rows.length < 2) return null;

  // Score composite : valuation + performance période
  const scored = rows.map((r) => {
    const val = computeValuation(r.ratios, r.coursActuel, r.fcf, r.shares);
    const valScore = val.scoreValorisation ?? 50;
    const perfScore = r.perfPct != null
      ? Math.max(0, Math.min(100, 50 + r.perfPct * 2))
      : 50;
    const total = valScore * 0.6 + perfScore * 0.4;
    return { code: r.code, designation: r.designation, total, verdict: val.verdict };
  }).sort((a, b) => b.total - a.total);

  const winner = scored[0]!;

  return (
    <div className="bg-surface border border-cyan/20 rounded-xl p-4 space-y-3">
      <span className="text-[10px] text-cyan uppercase tracking-wide font-bold">Verdict comparatif</span>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-2xl">🏆</span>
        <div>
          <p className="text-sm font-semibold text-ivory">
            {winner.code}{winner.designation ? ` — ${winner.designation}` : ''}
          </p>
          <p className="text-xs text-muted">
            Meilleur profil sur la période · valorisation <span className="text-ivory">{VERDICT_LABELS[winner.verdict]}</span>
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        {scored.map((s, rank) => (
          <div key={s.code} className="flex items-center gap-2">
            <span className="text-[10px] text-faint w-4">{rank + 1}.</span>
            <span className="text-xs text-ivory font-medium w-16">{s.code}</span>
            <div className="flex-1 bg-border rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-cyan transition-all"
                style={{ width: `${s.total.toFixed(0)}%` }}
              />
            </div>
            <span className="text-[10px] text-faint tabular w-8 text-right">{s.total.toFixed(0)}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-faint italic">Score = 60% valorisation fondamentale + 40% performance sur la période. Aucun conseil d'investissement.</p>
    </div>
  );
}
```

- [ ] **Step 3 : Enrichir `frontend/app/actions/compare/page.tsx`**

Lire le fichier. Après la section existante des graphiques et stats, ajouter un `getData` pour charger les fondamentaux de chaque code sélectionné. Ajouter après `getSeries()` :

```ts
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import CompareFundamentals from '@/components/CompareFundamentals';
import CompareVerdict from '@/components/CompareVerdict';

// Dans la fonction page, après getSeries() :
const fundamentals = await Promise.all(
  codes.map(async (code) => {
    const f = await loadCompanyFinancials(code);
    if (!f) return null;
    const latestIncome = f.incomeStatements[0] ?? null;
    const prevIncome = f.incomeStatements[1] ?? null;
    const latestBalance = f.balanceSheets[0] ?? null;
    const latestCashflow = f.cashFlowStatements[0] ?? null;
    const ratios = calculateFundamentals({
      coursActuel: f.latestDaily?.cours_jour ?? null,
      shares: f.instrument.shares,
      cours_bas_52s: f.latestDaily?.cours_bas_52s ?? null,
      cours_haut_52s: f.latestDaily?.cours_haut_52s ?? null,
      income: latestIncome,
      incomePrev: prevIncome,
      balance: latestBalance,
      cashflow: latestCashflow,
    });
    return {
      code,
      designation: f.instrument.designation,
      ratios,
      coursActuel: f.latestDaily?.cours_jour ?? null,
      fcf: latestCashflow?.flux_tresorerie_disponible ?? null,
      shares: f.instrument.shares,
    };
  })
);
const fundaRows = fundamentals.filter(Boolean) as NonNullable<typeof fundamentals[number]>[];
```

Dans le JSX, après `<CompareStats>`, ajouter :

```tsx
{fundaRows.length >= 2 && (
  <>
    <CompareVerdict rows={fundaRows} />
    <CompareFundamentals rows={fundaRows} />
  </>
)}
```

- [ ] **Step 4 : Vérifier le typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5 : Commit**

```bash
git add frontend/components/CompareFundamentals.tsx \
        frontend/components/CompareVerdict.tsx \
        frontend/app/actions/compare/page.tsx
git commit -m "feat(compare): fondamentaux côte à côte + verdict automatique + score valorisation"
```

---

## Task 6 — Mode investisseur débutant

**Files:**
- Create: `frontend/lib/beginner-mode.tsx`
- Modify: `frontend/app/layout.tsx`
- Create: `frontend/components/BeginnerToggle.tsx`
- Modify: `frontend/components/SignalBadge.tsx`

- [ ] **Step 1 : Créer `frontend/lib/beginner-mode.tsx`**

```tsx
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const KEY = 'brvm_beginner_mode';

interface BeginnerCtx {
  beginner: boolean;
  toggle: () => void;
}

const Ctx = createContext<BeginnerCtx>({ beginner: false, toggle: () => {} });

export function BeginnerModeProvider({ children, initial = false }: { children: ReactNode; initial?: boolean }) {
  const [beginner, setBeginner] = useState(initial);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored !== null) setBeginner(stored === 'true');
    else setBeginner(initial);
  }, [initial]);

  function toggle() {
    setBeginner((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, String(next));
      return next;
    });
  }

  return <Ctx.Provider value={{ beginner, toggle }}>{children}</Ctx.Provider>;
}

export function useBeginnerMode() {
  return useContext(Ctx);
}
```

- [ ] **Step 2 : Ajouter `BeginnerModeProvider` dans `frontend/app/layout.tsx`**

Lire le fichier. Importer :

```ts
import { BeginnerModeProvider } from '@/lib/beginner-mode';
```

Charger la préférence DB (si user connecté) pour l'hydratation initiale :

```ts
// Après récupération du profil user :
let initialBeginner = false;
if (user) {
  const { data: pref } = await supabase
    .from('profiles')
    .select('mode_debutant')
    .eq('id', user.id)
    .maybeSingle();
  initialBeginner = pref?.mode_debutant ?? false;
}
```

Envelopper `{children}` avec :

```tsx
<BeginnerModeProvider initial={initialBeginner}>
  {children}
</BeginnerModeProvider>
```

- [ ] **Step 3 : Créer `frontend/components/BeginnerToggle.tsx`**

```tsx
'use client';

import { useBeginnerMode } from '@/lib/beginner-mode';

export default function BeginnerToggle() {
  const { beginner, toggle } = useBeginnerMode();
  return (
    <button
      type="button"
      onClick={toggle}
      title={beginner ? 'Passer en mode expert' : 'Passer en mode débutant'}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition ${
        beginner
          ? 'border-cyan/40 text-cyan bg-cyan/10'
          : 'border-border text-faint hover:border-cyan/30 hover:text-muted'
      }`}
    >
      {beginner ? '🎓 Débutant' : '◈ Expert'}
    </button>
  );
}
```

Ajouter ce toggle dans la nav existante. Lire `frontend/lib/nav.ts` ou `frontend/components/ConditionalShell.tsx` pour trouver où insérer. Ajouter `<BeginnerToggle />` dans la barre latérale ou le header mobile, juste avant les liens utilisateur.

- [ ] **Step 4 : Modifier `frontend/components/SignalBadge.tsx` pour les explications simplifiées**

Lire le fichier. Ajouter le hook et un tooltip conditionnel :

```tsx
'use client';

import { useBeginnerMode } from '@/lib/beginner-mode';

const SIGNAL_HINTS: Record<string, string> = {
  BUY: "Le système pense que l'action est en bonne position pour monter — signal d'achat.",
  HOLD: "Pas de signal fort : attendre avant d'agir.",
  SELL: "Le signal suggère de sortir ou d'éviter cette action.",
};

// Dans le composant SignalBadge, ajouter :
const { beginner } = useBeginnerMode();

// Dans le JSX, après le badge coloré, ajouter :
{beginner && signal in SIGNAL_HINTS && (
  <span className="block text-[10px] text-faint mt-0.5 leading-snug">
    {SIGNAL_HINTS[signal]}
  </span>
)}
```

- [ ] **Step 5 : Ajouter `BeginnerHint` sur la fiche action `/actions/[code]/page.tsx`**

Lire le fichier. Créer un composant inline `BeginnerHint` côté client et l'utiliser sur RSI, MACD, score :

Ajouter en haut du fichier (ou dans un fichier séparé `frontend/components/BeginnerHint.tsx`) :

```tsx
'use client';

import { useBeginnerMode } from '@/lib/beginner-mode';

export function BeginnerHint({ text }: { text: string }) {
  const { beginner } = useBeginnerMode();
  if (!beginner) return null;
  return (
    <p className="text-[10px] text-cyan/70 italic mt-0.5 leading-snug">{text}</p>
  );
}
```

Utiliser dans la fiche :

```tsx
// Après le RSI affiché :
<BeginnerHint text="RSI < 30 = l'action est potentiellement survendue (bon point d'entrée possible). RSI > 70 = suracheté (prudence)." />

// Après le MACD :
<BeginnerHint text="MACD positif = tendance haussière. MACD négatif = tendance baissière." />

// Après le score signal :
<BeginnerHint text="Score > 60 = signal favorable. Score < 40 = signal défavorable. Entre les deux = neutre." />
```

- [ ] **Step 6 : Vérifier le typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7 : Commit**

```bash
git add frontend/lib/beginner-mode.tsx \
        frontend/components/BeginnerToggle.tsx \
        frontend/components/BeginnerHint.tsx \
        frontend/components/SignalBadge.tsx \
        frontend/app/layout.tsx \
        frontend/app/actions/\[code\]/page.tsx
git commit -m "feat(debutant): mode investisseur débutant — explications simplifiées RSI/MACD/signal, toggle persistant"
```

---

## Final build + push

Après toutes les tâches :

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` ou équivalent.

```bash
git push origin main
```

---

## Self-Review

### Spec coverage
- ✅ Task 1 : Graham Number + DCF + badge valorisation sur fiche financials
- ✅ Task 2 : Signaux réels depuis `signals_daily` + bouton "Backtester" fiche action
- ✅ Task 3 : Onboarding modal 3 étapes (profil / horizon / niveau) + migration + layout
- ✅ Task 4 : Scraper BRVM+COSUMAF + table + page + widget dashboard
- ✅ Task 5 : Fondamentaux côte à côte + verdict automatique sur `/actions/compare`
- ✅ Task 6 : BeginnerModeProvider + toggle nav + SignalBadge + BeginnerHint fiche action

### Placeholder scan
- Aucun "TBD" ou "TODO" — chaque étape a du code réel
- Note tâche 1 (colonne liste) : volontairement simplifiée (affiche `—`) pour éviter N+48 requêtes fondamentaux ; documenté dans le plan

### Type consistency
- `ValuationVerdict` défini dans `valuation.ts` et utilisé tel quel dans `CompareFundamentals` et `CompareVerdict`
- `FundaRow` interface dupliquée entre `CompareFundamentals` et `CompareVerdict` (léger) — acceptable, même shape
- `NewsItem` exporté depuis `brvmNews.ts`, importé dans `repository.ts`
- `BeginnerHint` exporté depuis son fichier, importé dans la fiche action
