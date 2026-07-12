# Widgets embeddables BRVM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trois widgets BRVM (`/embed/ticker`, `/embed/heatmap`, `/embed/valeur/[code]`) embarquables par les médias en `<iframe>`, sans cookie ni traceur, avec backlink vers WESTBOURSE.

**Architecture:** Pages Next server-rendered (ISR 300 s) lisant Supabase en clé anon, servies hors du chrome applicatif. Une exception CSP **chirurgicale** ouvre `frame-ancestors *` sur `/embed/*` uniquement — le reste du site conserve `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`.

**Tech Stack:** Next.js 14 App Router, TailwindCSS, `@supabase/supabase-js` (client anon `lib/supabase/public.ts`), tests purs `.test.mjs` via `npx tsx`.

**Spec:** `docs/superpowers/specs/2026-07-12-widgets-embeddables-design.md`

---

## Fichiers

| Fichier | Rôle |
|---|---|
| Modify `frontend/next.config.js:29-72` | CSP : règle stricte hors `/embed` + règle ouverte `/embed/:path*` |
| Modify `frontend/sentry.client.config.ts` | Ne pas initialiser Sentry sur `/embed` (zéro traceur) |
| Create `frontend/components/layout/NonEmbedChrome.tsx` | Masque bannière cookies, PostHog, SW, splash sur `/embed` |
| Modify `frontend/app/layout.tsx:242-252` | Enrobe le chrome client dans `NonEmbedChrome` |
| Modify `frontend/components/ConditionalShell.tsx` | `/embed` dans `BARE_PREFIXES` (ni sidebar, ni footer, ni nudge) |
| Create `frontend/lib/embed/params.ts` + `.test.mjs` | Parse `theme` / `lang` / `codes` (purs) |
| Create `frontend/lib/embed/i18n.ts` | Libellés fr/en (map simple) |
| Create `frontend/app/embed/layout.tsx` | Layout minimal + rafraîchissement 300 s sans JS |
| Create `frontend/components/embed/EmbedFrame.tsx` | Coque commune + backlink UTM |
| Create `frontend/components/embed/TickerStrip.tsx` | Défilement **CSS pur** (aucun `useEffect`) |
| Create `frontend/components/embed/AutoHeight.tsx` | ResizeObserver → postMessage (facultatif) |
| Modify `frontend/app/globals.css` | Keyframes du défilement ticker |
| Create `frontend/app/embed/ticker/page.tsx` | Widget bandeau |
| Create `frontend/app/embed/heatmap/page.tsx` | Widget grille |
| Create `frontend/app/embed/valeur/[code]/page.tsx` | Widget valeur (code validé) |
| Modify `frontend/app/developers/page.tsx:92` | Section « Widgets » + snippets |
| Create `frontend/scripts/embed-check.html` | Harnais de test T1 (hors origine) |

---

### Task 1 : CSP — ouvrir `/embed` sans affaiblir le reste

**Files:** Modify `frontend/next.config.js`

- [ ] **Step 1 : Scinder la règle de headers**

Dans `async headers()`, la constante `csp` existante reste inchangée. Ajouter
juste après elle une CSP dédiée à l'embed (même politique, `frame-ancestors *`) :

```js
    // CSP des pages embarquables : identique, mais autorisant l'embarquement
    // par n'importe quel site (c'est tout l'objet des widgets).
    const cspEmbed = csp.replace("frame-ancestors 'self'", 'frame-ancestors *');
```

Puis remplacer le `return [...]` par **deux** entrées :

```js
    return [
      {
        // Tout SAUF /embed : anti-clickjacking intact.
        source: '/((?!embed).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
      {
        // Widgets embarquables. AUCUN X-Frame-Options : l'en-tête legacy prime
        // sur la CSP dans tous les navigateurs — le laisser annulerait
        // silencieusement l'ouverture. Pas de COOP non plus (isolerait l'iframe).
        source: '/embed/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: cspEmbed },
        ],
      },
    ];
```

- [ ] **Step 2 : Vérifier les en-têtes réellement servis**

Run: `cd frontend && npm run dev` puis dans un autre terminal :

```bash
curl -sI http://localhost:3000/dashboard | grep -iE 'x-frame|frame-ancestors'
curl -sI http://localhost:3000/embed/ticker | grep -iE 'x-frame|frame-ancestors'
```

Expected : `/dashboard` → `X-Frame-Options: SAMEORIGIN` **et** `frame-ancestors 'self'`.
`/embed/ticker` → **aucun** `X-Frame-Options`, et `frame-ancestors *`.
(La page 404 à ce stade est normale — seuls les en-têtes comptent.)

- [ ] **Step 3 : Commit**

```bash
git add frontend/next.config.js
git commit -m "feat(embed): CSP — ouvre frame-ancestors sur /embed uniquement (anti-clickjacking preserve ailleurs)"
```

---

### Task 2 : Zéro traceur sur `/embed`

**Files:** Modify `frontend/sentry.client.config.ts`, Create `frontend/components/layout/NonEmbedChrome.tsx`, Modify `frontend/app/layout.tsx`, Modify `frontend/components/ConditionalShell.tsx`

- [ ] **Step 1 : Sentry — ne pas initialiser sur /embed**

Dans `sentry.client.config.ts`, remplacer la ligne `enabled:` de `Sentry.init` par :

```ts
  // Les pages /embed sont servies chez des tiers : aucun traceur, aucun cookie
  // (argument commercial autant que règle RGPD — cf. spec §5).
  enabled:
    process.env.NODE_ENV === 'production' &&
    !!dsn &&
    !(typeof window !== 'undefined' && window.location.pathname.startsWith('/embed')),
```

- [ ] **Step 2 : Créer le garde de chrome client**

Create `frontend/components/layout/NonEmbedChrome.tsx` :

```tsx
'use client';

import { usePathname } from 'next/navigation';

/**
 * Masque tout le chrome applicatif (bannière cookies, analytics, service worker,
 * splash, palette) sur les pages `/embed/*`, qui sont servies dans des iframes
 * de sites tiers : aucun cookie, aucun traceur — cf. spec §5.
 */
export default function NonEmbedChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/embed')) return null;
  return <>{children}</>;
}
```

- [ ] **Step 3 : Enrober le chrome dans `app/layout.tsx`**

Importer `NonEmbedChrome` et enrober **uniquement** les composants de chrome
(surtout pas `ConditionalShell`, qui rend les enfants) :

```tsx
            <ConditionalShell isPremium={isPremium} isAdmin={isAdmin}>{children}</ConditionalShell>
            <NonEmbedChrome>
              <CommandPaletteProvider />
              <ServiceWorkerRegister />
              {hasUser && !onboardingDone && <OnboardingModal />}
              <CookieBanner />
              <PostHogInit />
            </NonEmbedChrome>
```

Et déplacer `<SplashScreen />` à l'intérieur de `NonEmbedChrome` également.

- [ ] **Step 4 : Pas de shell applicatif sur /embed**

Dans `frontend/components/ConditionalShell.tsx`, ajouter `'/embed'` au tableau
`BARE_PREFIXES` (à côté de `'/fiscalite'`). Les pages embed sont alors rendues
nues, sans sidebar, sans footer, sans encart de contact.

- [ ] **Step 5 : Vérifier + commit**

Run: `cd frontend && npx tsc --noEmit` → 0 erreur.

```bash
git add frontend/sentry.client.config.ts frontend/components/layout/NonEmbedChrome.tsx frontend/app/layout.tsx frontend/components/ConditionalShell.tsx
git commit -m "feat(embed): zero cookie/traceur sur /embed (ni consent, ni posthog, ni sentry, ni SW)"
```

---

### Task 3 : Paramètres et libellés (TDD, fonctions pures)

**Files:** Create `frontend/lib/embed/params.test.mjs`, Create `frontend/lib/embed/params.ts`, Create `frontend/lib/embed/i18n.ts`

- [ ] **Step 1 : Écrire le test AVANT**

Create `frontend/lib/embed/params.test.mjs` :

```js
// Exécuter : cd frontend && npx tsx lib/embed/params.test.mjs
import assert from 'node:assert';
import { parseTheme, parseLang, parseCodes, MAX_CODES } from './params.ts';

// Thème : dark par défaut, valeur inconnue → dark.
assert.equal(parseTheme(undefined), 'dark');
assert.equal(parseTheme('light'), 'light');
assert.equal(parseTheme('LIGHT'), 'light');
assert.equal(parseTheme('fluo'), 'dark');

// Langue : fr par défaut, valeur inconnue → fr.
assert.equal(parseLang(undefined), 'fr');
assert.equal(parseLang('en'), 'en');
assert.equal(parseLang('EN'), 'en');
assert.equal(parseLang('de'), 'fr');

// Codes : liste vide → null (= toutes les actions).
assert.equal(parseCodes(undefined), null);
assert.equal(parseCodes(''), null);
assert.equal(parseCodes('  ,  '), null);

// Codes : normalisés en majuscules, espaces retirés, doublons écartés.
assert.deepEqual(parseCodes('snts, etit ,SNTS'), ['SNTS', 'ETIT']);

// Codes : plafonné à MAX_CODES (sinon un tiers fait exploser la requête).
const trop = Array.from({ length: MAX_CODES + 10 }, (_, i) => `C${i}`).join(',');
assert.equal(parseCodes(trop).length, MAX_CODES);

console.log('✓ params.test.mjs : tous les tests passent');
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `cd frontend && npx tsx lib/embed/params.test.mjs`
Expected : FAIL — module `./params.ts` introuvable.

- [ ] **Step 3 : Implémenter**

Create `frontend/lib/embed/params.ts` :

```ts
/** Paramètres d'URL des widgets embarquables. Fonctions pures (params.test.mjs). */

export type EmbedTheme = 'dark' | 'light';
export type EmbedLang = 'fr' | 'en';

/** Plafond de codes du ticker : sans borne, un tiers peut faire exploser la requête. */
export const MAX_CODES = 20;

export function parseTheme(raw: string | undefined): EmbedTheme {
  return raw?.toLowerCase() === 'light' ? 'light' : 'dark';
}

export function parseLang(raw: string | undefined): EmbedLang {
  return raw?.toLowerCase() === 'en' ? 'en' : 'fr';
}

/** `?codes=snts,etit` → ['SNTS','ETIT'] ; absent/vide → null (= toutes les actions). */
export function parseCodes(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const codes = [
    ...new Set(
      raw
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  return codes.length === 0 ? null : codes.slice(0, MAX_CODES);
}
```

Create `frontend/lib/embed/i18n.ts` :

```ts
import type { EmbedLang } from './params';

/** Libellés des widgets. Map simple — pas de bibliothèque i18n (YAGNI). */
export const T: Record<EmbedLang, Record<string, string>> = {
  fr: {
    variation: 'Variation',
    volume: 'Volume',
    cours: 'Cours',
    indisponible: 'Données indisponibles',
    seance: 'Séance',
    donnees: 'Données',
  },
  en: {
    variation: 'Change',
    volume: 'Volume',
    cours: 'Price',
    indisponible: 'Data unavailable',
    seance: 'Session',
    donnees: 'Data',
  },
};
```

- [ ] **Step 4 : Vérifier le succès**

Run: `cd frontend && npx tsx lib/embed/params.test.mjs`
Expected : `✓ params.test.mjs : tous les tests passent`

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/embed/
git commit -m "feat(embed): parsing theme/lang/codes (TDD, plafond 20 codes) + libelles fr/en"
```

---

### Task 4 : Layout embed + coque commune (backlink)

**Files:** Create `frontend/app/embed/layout.tsx`, Create `frontend/components/embed/EmbedFrame.tsx`, Create `frontend/components/embed/AutoHeight.tsx`

- [ ] **Step 1 : Layout minimal + rafraîchissement sans JS**

Create `frontend/app/embed/layout.tsx` :

```tsx
/**
 * Layout des widgets embarquables. Aucun chrome, aucun cookie, aucun traceur
 * (NonEmbedChrome les neutralise). Le `meta refresh` maintient la fraîcheur
 * chez un média qui laisse sa page ouverte, SANS aucun JavaScript (spec §4.1).
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <meta httpEquiv="refresh" content="300" />
      <div className="min-h-0">{children}</div>
    </>
  );
}
```

- [ ] **Step 2 : Coque commune avec le backlink**

Create `frontend/components/embed/EmbedFrame.tsx` :

```tsx
import type { EmbedTheme, EmbedLang } from '@/lib/embed/params';
import { T } from '@/lib/embed/i18n';

const SITE = 'https://westbourse.com';
/** Backlink mesurable : permet de prouver la traction des widgets. */
export const BACKLINK = `${SITE}/?utm_source=widget&utm_medium=embed&utm_campaign=brvm-widget`;

/** Coque commune : fond selon le thème + lien retour (l'objectif SEO du widget). */
export default function EmbedFrame({
  theme,
  lang,
  children,
}: {
  theme: EmbedTheme;
  lang: EmbedLang;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  return (
    <div
      className={`flex flex-col gap-1 p-2 font-sans ${
        dark ? 'bg-[#030303] text-[#FCFCFC]' : 'bg-white text-[#101418]'
      }`}
    >
      {children}
      <a
        href={BACKLINK}
        target="_blank"
        rel="noopener"
        className={`self-end text-[10px] tracking-wide ${dark ? 'text-[#56d7fd]' : 'text-[#0c8fae]'} hover:underline`}
      >
        {T[lang].donnees} · WESTBOURSE
      </a>
    </div>
  );
}
```

- [ ] **Step 3 : Auto-hauteur (facultative)**

Create `frontend/components/embed/AutoHeight.tsx` :

```tsx
'use client';

import { useEffect } from 'react';

/**
 * Publie la hauteur réelle du widget au site hôte. FACULTATIF : l'iframe
 * fonctionne sans (hauteur fixe). Le snippet hôte DOIT valider `event.origin`
 * (cf. /developers) — sinon n'importe quelle iframe pourrait le redimensionner.
 */
export default function AutoHeight() {
  useEffect(() => {
    const send = (h: number) => window.parent?.postMessage({ type: 'wb-resize', height: h }, '*');
    send(document.body.scrollHeight);
    const ro = new ResizeObserver(([e]) => send(e.contentRect.height));
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);
  return null;
}
```

- [ ] **Step 4 : Vérifier le rafraîchissement automatique**

⚠️ Next 14 (React 18) ne hisse pas les balises `<meta>` vers le `<head>` : la
balise sera rendue dans le corps. Les navigateurs honorent le `meta refresh`
même hors du `<head>`, mais **il faut le vérifier**, pas le supposer.

Run: `cd frontend && npm run dev`, ouvrir `http://localhost:3000/embed/ticker`,
laisser l'onglet ouvert 5 minutes.
Expected : la page se recharge d'elle-même (l'onglet affiche brièvement le
spinner de chargement).

**Si elle ne se recharge pas**, remplacer la balise par un rechargement natif
sans cookie ni traceur (dernier recours — réintroduit 1 ligne de JS, mais ne
casse rien si le JS est absent) dans `AutoHeight.tsx` :

```tsx
    const t = setTimeout(() => window.location.reload(), 300_000);
    return () => { ro.disconnect(); clearTimeout(t); };
```

- [ ] **Step 5 : Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` → 0 erreur.

```bash
git add frontend/app/embed/layout.tsx frontend/components/embed/
git commit -m "feat(embed): layout minimal (meta-refresh sans JS) + coque backlink + auto-hauteur facultative"
```

---

### Task 5 : Widget ticker (défilement CSS pur)

**Files:** Modify `frontend/app/globals.css`, Create `frontend/components/embed/TickerStrip.tsx`, Create `frontend/app/embed/ticker/page.tsx`

- [ ] **Step 1 : Keyframes du défilement (CSS pur — aucun JS, cf. test T3)**

Ajouter à la fin de `frontend/app/globals.css` :

```css
/* Défilement du ticker embarquable — CSS PUR : doit fonctionner sans JavaScript
   (agrégateurs, robots). Aucun useEffect côté composant. */
@keyframes wb-ticker-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.wb-ticker-track {
  display: flex;
  width: max-content;
  animation: wb-ticker-scroll 40s linear infinite;
}
.wb-ticker:hover .wb-ticker-track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .wb-ticker-track { animation: none; }
  .wb-ticker { overflow-x: auto; }
}
```

- [ ] **Step 2 : Composant (serveur, sans état)**

Create `frontend/components/embed/TickerStrip.tsx` :

```tsx
import type { EmbedTheme } from '@/lib/embed/params';

export interface TickerItem {
  code: string;
  cours: number | null;
  variation: number | null;
}

const fmt = (v: number | null) => (v == null ? '—' : v.toLocaleString('fr-FR'));

/** Bandeau défilant. Composant SERVEUR : zéro JS (le défilement est en CSS). */
export default function TickerStrip({ items, theme }: { items: TickerItem[]; theme: EmbedTheme }) {
  const dark = theme === 'dark';
  // Piste dupliquée : l'animation translate de -50 % boucle sans saut visible.
  const track = [...items, ...items];
  return (
    <div className="wb-ticker overflow-hidden">
      <div className="wb-ticker-track">
        {track.map((it, i) => {
          const up = (it.variation ?? 0) >= 0;
          return (
            <span
              key={`${it.code}-${i}`}
              className={`flex shrink-0 items-baseline gap-1.5 whitespace-nowrap px-3 text-[13px] ${
                dark ? 'border-[#1a2a30]' : 'border-[#e6e8ea]'
              } border-r`}
            >
              <b className="font-semibold">{it.code}</b>
              <span className="tabular-nums">{fmt(it.cours)}</span>
              <span className={`tabular-nums ${up ? 'text-[#3fe18b]' : 'text-[#ff6b6b]'}`}>
                {it.variation == null ? '—' : `${up ? '+' : ''}${it.variation.toFixed(2)}%`}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Page du widget**

Create `frontend/app/embed/ticker/page.tsx` :

```tsx
import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { parseTheme, parseLang, parseCodes } from '@/lib/embed/params';
import { T } from '@/lib/embed/i18n';
import EmbedFrame from '@/components/embed/EmbedFrame';
import AutoHeight from '@/components/embed/AutoHeight';
import TickerStrip, { type TickerItem } from '@/components/embed/TickerStrip';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Cours BRVM en direct — WESTBOURSE', robots: { index: false } };

export default async function EmbedTickerPage({
  searchParams,
}: {
  searchParams: { theme?: string; lang?: string; codes?: string };
}) {
  const theme = parseTheme(searchParams.theme);
  const lang = parseLang(searchParams.lang);
  const codes = parseCodes(searchParams.codes);

  const sb = createPublicClient();
  const { data: last } = await sb
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const date = last?.[0]?.date_marche ?? null;

  let items: TickerItem[] = [];
  if (date) {
    let q = sb
      .from('brvm_actions_daily')
      .select('code, cours_jour, variation_pct')
      .eq('date_marche', date)
      .order('code');
    if (codes) q = q.in('code', codes);
    const { data } = await q;
    items = ((data ?? []) as { code: string; cours_jour: number | null; variation_pct: number | null }[]).map((a) => ({
      code: a.code,
      cours: a.cours_jour,
      variation: a.variation_pct,
    }));
  }

  return (
    <EmbedFrame theme={theme} lang={lang}>
      <AutoHeight />
      {items.length === 0 ? (
        <p className="px-2 py-3 text-xs opacity-70">{T[lang].indisponible}</p>
      ) : (
        <TickerStrip items={items} theme={theme} />
      )}
    </EmbedFrame>
  );
}
```

- [ ] **Step 4 : Vérifier**

Run: `cd frontend && npm run dev`, ouvrir `http://localhost:3000/embed/ticker`
→ le bandeau défile. Puis **désactiver JavaScript** dans le navigateur et
recharger → **le défilement continue** (test T3 : animation CSS pure).

- [ ] **Step 5 : Commit**

```bash
git add frontend/app/globals.css frontend/components/embed/TickerStrip.tsx frontend/app/embed/ticker/
git commit -m "feat(embed): widget ticker (defilement CSS pur, fonctionne sans JS)"
```

---

### Task 6 : Widget heatmap

**Files:** Create `frontend/app/embed/heatmap/page.tsx`

- [ ] **Step 1 : Page**

```tsx
import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { parseTheme, parseLang } from '@/lib/embed/params';
import { T } from '@/lib/embed/i18n';
import EmbedFrame from '@/components/embed/EmbedFrame';
import AutoHeight from '@/components/embed/AutoHeight';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Heatmap BRVM du jour — WESTBOURSE', robots: { index: false } };

/** Intensité de la tuile selon l'ampleur de la variation (dégradé honnête). */
function tileClass(v: number | null): string {
  if (v == null) return 'bg-[#1a2a30] text-[#8b93a7]';
  if (v > 3) return 'bg-[#3fe18b] text-[#03222b]';
  if (v > 0) return 'bg-[#3fe18b]/40 text-[#FCFCFC]';
  if (v === 0) return 'bg-[#1a2a30] text-[#FCFCFC]';
  if (v > -3) return 'bg-[#ff6b6b]/40 text-[#FCFCFC]';
  return 'bg-[#ff6b6b] text-[#2b0303]';
}

export default async function EmbedHeatmapPage({
  searchParams,
}: {
  searchParams: { theme?: string; lang?: string };
}) {
  const theme = parseTheme(searchParams.theme);
  const lang = parseLang(searchParams.lang);

  const sb = createPublicClient();
  const { data: last } = await sb
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const date = last?.[0]?.date_marche ?? null;

  const { data } = date
    ? await sb
        .from('brvm_actions_daily')
        .select('code, variation_pct')
        .eq('date_marche', date)
        .order('code')
    : { data: null };
  const rows = (data ?? []) as { code: string; variation_pct: number | null }[];

  return (
    <EmbedFrame theme={theme} lang={lang}>
      <AutoHeight />
      {rows.length === 0 ? (
        <p className="px-2 py-3 text-xs opacity-70">{T[lang].indisponible}</p>
      ) : (
        <>
          <p className="px-1 text-[10px] opacity-60">
            {T[lang].seance} {date}
          </p>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
            {rows.map((r) => (
              <div
                key={r.code}
                className={`rounded px-1.5 py-2 text-center ${tileClass(r.variation_pct)}`}
              >
                <div className="text-[11px] font-semibold">{r.code}</div>
                <div className="tabular-nums text-[11px]">
                  {r.variation_pct == null
                    ? '—'
                    : `${r.variation_pct >= 0 ? '+' : ''}${r.variation_pct.toFixed(1)}%`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </EmbedFrame>
  );
}
```

- [ ] **Step 2 : Vérifier + commit**

Run: ouvrir `http://localhost:3000/embed/heatmap` → grille colorée, séance affichée.

```bash
git add frontend/app/embed/heatmap/
git commit -m "feat(embed): widget heatmap des variations du jour"
```

---

### Task 7 : Widget valeur (code validé, titre dynamique)

**Files:** Create `frontend/app/embed/valeur/[code]/page.tsx`

- [ ] **Step 1 : Page**

Le code est **validé contre le référentiel** avant toute requête de marché :
un code inconnu ne doit pas générer de page ISR ni de requête (spec §4.4).

```tsx
import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { parseTheme, parseLang } from '@/lib/embed/params';
import { T } from '@/lib/embed/i18n';
import EmbedFrame from '@/components/embed/EmbedFrame';
import AutoHeight from '@/components/embed/AutoHeight';

export const revalidate = 300;

/** Vérifie que le code existe VRAIMENT (anti-abus : pas d'ISR non bornée). */
async function loadValeur(codeRaw: string) {
  const code = codeRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) return null;

  const sb = createPublicClient();
  const { data: instr } = await sb
    .from('brvm_instruments')
    .select('code, designation')
    .eq('code', code)
    .eq('type', 'action')
    .maybeSingle();
  if (!instr) return null;

  const { data: rows } = await sb
    .from('brvm_actions_daily')
    .select('date_marche, cours_jour, variation_pct, volume')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1);
  const last = rows?.[0] ?? null;
  return { code, nom: (instr.designation as string | null) ?? code, last };
}

export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const v = await loadValeur(params.code);
  if (!v?.last) return { title: 'WESTBOURSE — BRVM', robots: { index: false } };
  const cours = v.last.cours_jour?.toLocaleString('fr-FR') ?? '—';
  const varPct =
    v.last.variation_pct == null
      ? ''
      : ` ${v.last.variation_pct >= 0 ? '+' : ''}${v.last.variation_pct.toFixed(2)}%`;
  const titre = `${v.code} · ${cours} FCFA${varPct} · WESTBOURSE`;
  return {
    title: titre,
    robots: { index: false },
    openGraph: { title: titre, description: `${v.nom} — cours BRVM en direct.` },
  };
}

export default async function EmbedValeurPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { theme?: string; lang?: string };
}) {
  const theme = parseTheme(searchParams.theme);
  const lang = parseLang(searchParams.lang);
  const v = await loadValeur(params.code);
  const up = (v?.last?.variation_pct ?? 0) >= 0;

  return (
    <EmbedFrame theme={theme} lang={lang}>
      <AutoHeight />
      {!v || !v.last ? (
        <p className="px-2 py-6 text-center text-xs opacity-70">{T[lang].indisponible}</p>
      ) : (
        <div className="px-1 py-1">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="text-base font-semibold">{v.code}</div>
              <div className="truncate text-[11px] opacity-60">{v.nom}</div>
            </div>
            <div className="text-right">
              <div className="tabular-nums text-xl font-semibold">
                {v.last.cours_jour?.toLocaleString('fr-FR') ?? '—'}
                <span className="ml-1 text-[11px] opacity-60">FCFA</span>
              </div>
              <div
                className={`tabular-nums text-sm ${up ? 'text-[#3fe18b]' : 'text-[#ff6b6b]'}`}
              >
                {v.last.variation_pct == null
                  ? '—'
                  : `${up ? '+' : ''}${v.last.variation_pct.toFixed(2)}%`}
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[10px] opacity-60">
            <span>
              {T[lang].volume} : {v.last.volume?.toLocaleString('fr-FR') ?? '—'}
            </span>
            <span>
              {T[lang].seance} {v.last.date_marche}
            </span>
          </div>
        </div>
      )}
    </EmbedFrame>
  );
}
```

- [ ] **Step 2 : Vérifier (dont l'anti-abus)**

Ouvrir `http://localhost:3000/embed/valeur/SNTS` → carte remplie, onglet du
navigateur titré « SNTS · … · WESTBOURSE ».
Ouvrir `http://localhost:3000/embed/valeur/ZZZZ` → « Données indisponibles »
(**aucune** erreur, aucune requête de marché).

- [ ] **Step 3 : Commit**

```bash
git add frontend/app/embed/valeur/
git commit -m "feat(embed): widget valeur (code valide contre le referentiel, titre/OG dynamiques)"
```

---

### Task 8 : Section « Widgets » sur /developers

**Files:** Modify `frontend/app/developers/page.tsx`

- [ ] **Step 1 : Ajouter la section après le bloc « Exemple » (~ligne 92)**

Les snippets **incluent `title`** sur l'iframe (WCAG 4.1.2 : sans lui, c'est le
score Lighthouse du média qui chute) et le snippet d'auto-hauteur **valide
`event.origin`** (sans ce contrôle, n'importe quelle iframe de leur page
pourrait redimensionner la nôtre).

```tsx
        <section className="space-y-4">
          <h2 className="font-display text-xl text-white">Widgets embarquables</h2>
          <p className="text-sm text-muted">
            Intégrez les données BRVM sur votre site en copiant une ligne. Les widgets
            ne posent <strong className="text-white">aucun cookie</strong> et n&apos;utilisent
            aucun traceur : leur intégration ne déclenche pas d&apos;obligation de consentement
            chez vous. Paramètres : <code>?theme=dark|light</code>, <code>?lang=fr|en</code>,
            et <code>?codes=SNTS,ETIT</code> (ticker, 20 max).
          </p>

          {[
            { nom: 'Bandeau des cours', path: '/embed/ticker', h: 56, titre: 'Cours BRVM — WESTBOURSE' },
            { nom: 'Heatmap du jour', path: '/embed/heatmap', h: 420, titre: 'Heatmap BRVM — WESTBOURSE' },
            { nom: 'Fiche valeur', path: '/embed/valeur/SNTS', h: 180, titre: 'Cours SNTS — WESTBOURSE' },
          ].map((w) => (
            <div key={w.path} className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="border-b border-border px-4 py-2 text-sm text-white">{w.nom}</div>
              <div className="p-4 space-y-3">
                <iframe
                  title={w.titre}
                  src={w.path}
                  width="100%"
                  height={w.h}
                  style={{ border: 0 }}
                  loading="lazy"
                />
                <pre className="overflow-x-auto rounded-lg bg-bg border border-border/60 p-3 text-[11px] text-faint">{`<iframe title="${w.titre}" src="https://westbourse.com${w.path}" width="100%" height="${w.h}" frameborder="0" loading="lazy"></iframe>`}</pre>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
            <p className="text-sm text-white">Hauteur automatique (facultatif)</p>
            <p className="text-xs text-muted">
              Le widget publie sa hauteur réelle. Ce script l&apos;applique — il
              <strong className="text-white"> vérifie l&apos;origine</strong>, ce qui est
              indispensable : sans ce contrôle, n&apos;importe quelle autre iframe de votre
              page pourrait redimensionner le widget.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-bg border border-border/60 p-3 text-[11px] text-faint">{`<iframe id="wb-widget" title="Cours BRVM — WESTBOURSE"
  src="https://westbourse.com/embed/ticker" width="100%" height="56"
  frameborder="0" loading="lazy"></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://westbourse.com') return;   // obligatoire
    if (!e.data || e.data.type !== 'wb-resize') return;
    document.getElementById('wb-widget').style.height = e.data.height + 'px';
  });
</script>`}</pre>
          </div>
        </section>
```

- [ ] **Step 2 : Vérifier + commit**

Run: ouvrir `http://localhost:3000/developers` → les 3 widgets s'affichent en
aperçu live (même origine) et les snippets sont copiables.

```bash
git add frontend/app/developers/page.tsx
git commit -m "feat(embed): section Widgets sur /developers (snippets avec title + controle d'origine)"
```

---

### Task 9 : Tests de sécurité T1 / T2 / T3

**Files:** Create `frontend/scripts/embed-check.html`

- [ ] **Step 1 : Harnais T1 — ouverture ET confinement**

Create `frontend/scripts/embed-check.html` :

```html
<!doctype html>
<meta charset="utf-8" />
<title>Vérification embed WESTBOURSE (hors origine)</title>
<body style="font-family: system-ui; background:#111; color:#eee">
  <h2>Doivent s'AFFICHER (widgets)</h2>
  <iframe title="ticker" src="http://localhost:3000/embed/ticker" width="100%" height="56"></iframe>
  <iframe title="heatmap" src="http://localhost:3000/embed/heatmap" width="100%" height="420"></iframe>
  <iframe title="valeur" src="http://localhost:3000/embed/valeur/SNTS" width="100%" height="180"></iframe>

  <h2>Doit rester BLOQUÉ (anti-clickjacking du site)</h2>
  <iframe title="dashboard" src="http://localhost:3000/dashboard" width="100%" height="200"></iframe>
</body>
```

- [ ] **Step 2 : Exécuter T1**

Servir ce fichier depuis une **autre origine** (port différent = origine
différente, ce qui suffit) :

```bash
cd frontend/scripts && python -m http.server 8081
```

Ouvrir `http://localhost:8081/embed-check.html`.

Expected :
- les **3 widgets s'affichent** → l'ouverture CSP fonctionne ;
- le cadre `/dashboard` **reste vide** et la console affiche un refus de type
  « Refused to frame … because an ancestor violates … frame-ancestors » →
  l'anti-clickjacking du reste du site est **intact**.

Si `/dashboard` s'affiche : **P0**, la règle `'/((?!embed).*)'` ne s'applique
pas — corriger avant d'aller plus loin.

- [ ] **Step 3 : Exécuter T2 — sonde RLS**

La clé anon est publique (déjà dans le JS du site) ; on vérifie qu'elle ne peut
pas **écrire** les tables lues par les widgets.

> ⚠️ **Piège : ne PAS sonder par un `PATCH`.** Sous RLS, un `UPDATE` sans policy
> ne renvoie **pas** d'erreur : la RLS filtre les lignes, 0 ligne matche, et
> PostgREST répond **204** — un succès. Un 204 ne prouve donc **rien**.
> Il faut sonder par un **`INSERT`**, que la RLS refuse **explicitement**
> (`42501 : new row violates row-level security policy`). Le payload volontairement
> incomplet ci-dessous violerait de toute façon les contraintes NOT NULL : aucune
> écriture n'est possible, quel que soit le résultat.

```bash
cd frontend
URL=$(grep -m1 '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"\r')
KEY=$(grep -m1 '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '"\r')
for TABLE in brvm_actions_daily brvm_instruments; do
  curl -s -w ' -> HTTP %{http_code}\n' -X POST "$URL/rest/v1/$TABLE" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" -d '{"code":"__PROBE__"}' | cut -c1-90
done
```

Expected (constaté le 2026-07-12) : **HTTP 401** avec
`"code":"42501","message":"new row violates row-level security policy"` sur les
deux tables → la clé anon est bien en **lecture seule**.

Si un **201** apparaît : **P0** — la table est ouverte en écriture aux widgets
et à quiconque lit la clé dans le HTML ; ajouter une policy restrictive avant
tout déploiement.

- [ ] **Step 4 : Exécuter T3 — rendu sans JavaScript**

Désactiver JavaScript dans le navigateur, ouvrir `http://localhost:3000/embed/ticker` :
le contenu **et le défilement** doivent fonctionner (animation CSS pure).
Seule l'auto-hauteur cesse — sans rien casser.

- [ ] **Step 5 : Commit**

```bash
git add frontend/scripts/embed-check.html
git commit -m "test(embed): harnais T1 (CSP ouverture + confinement hors origine)"
```

---

### Task 10 : Vérification finale et déploiement

- [ ] `cd frontend && npx tsc --noEmit` → 0 erreur.
- [ ] `npx tsx lib/embed/params.test.mjs` → vert.
- [ ] `NODE_OPTIONS=--max-old-space-size=4096 npm run build` → `✓ Compiled successfully`
      (heap 4 Go requis en local ; Vercel n'est pas concerné).
- [ ] T1, T2, T3 rejoués une dernière fois (Task 9).
- [ ] `git push origin main` — le déploiement Vercel suit.
- [ ] **Après déploiement** : rejouer T1 contre le domaine de production en
      remplaçant `http://localhost:3000` par `https://westbourse.com` dans
      `embed-check.html` (les en-têtes servis par Vercel peuvent différer de ceux
      du dev — c'est ce qui compte réellement pour les médias).
