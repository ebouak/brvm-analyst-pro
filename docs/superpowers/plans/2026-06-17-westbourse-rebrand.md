# WESTBOURSE Rebrand & Animated Logo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the product "BRVM Analyst Pro" → **WESTBOURSE** across the runtime frontend, ship the new logo (white W monogram + rising teal arrow), and add a reusable CSS-only stroke-draw `<AnimatedLogo>` used in a splash screen, the landing hero, and inline loaders/favicon.

**Architecture:** A single CSS-only `AnimatedLogo` React component (no framer-motion, Server-Component-safe) renders the frozen SVG mark and animates it via `stroke-dasharray`/`stroke-dashoffset` keyframes. A client `SplashScreen` mounts it once per session in the root layout. The static `BrandLogo` and the PWA assets (`icon.svg`, `favicon.svg`, `manifest.json`, `sw.js`) are reskinned. Finally, the product name string is replaced file-by-file in ~58 runtime files, never touching "BRVM" used as the name of the stock exchange.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript (strict), TailwindCSS, CSS keyframes. Verification gate: `npx tsc --noEmit` + `npm run build` (no frontend test runner exists; vitest is scraper-only).

**Frozen identity (use verbatim everywhere):**
- viewBox `0 0 130 105`
- White W (stroke `#ffffff`, width 12, round caps/joins): `M16 24 L40 82 L58 48 L76 82`
- Teal shaft (stroke `#16b6a4`, width 12, round): `M76 82 L100 33`
- Teal arrowhead (filled triangle, fill `#16b6a4`): polygon points `110,12 117,40 86,28`
- Night-blue background (optional): rounded rect `#0c1d2e`
- Wordmark: `WESTBOURSE`, font-weight 700, letter-spacing `.42em`, color `#f4f6f8`

**Run all commands from `frontend/`** unless stated otherwise. On this machine the shell is PowerShell and the tool may reset the working directory between calls — always `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend"` first.

---

## File Structure

- Create: `frontend/components/brand/AnimatedLogo.tsx` — the reusable SVG + CSS animation (mark/lockup, animate/loop/background props).
- Create: `frontend/components/brand/SplashScreen.tsx` — client overlay, once-per-session, reduced-motion aware.
- Modify: `frontend/components/landing/taste/BrandLogo.tsx` — reskin to new static mark + "WESTBOURSE".
- Modify: `frontend/public/icon.svg`, `frontend/public/favicon.svg`, `frontend/public/manifest.json`, `frontend/public/sw.js` — new mark + product name.
- Modify: `frontend/app/layout.tsx` — metadata strings + mount `<SplashScreen/>`.
- Modify: ~57 other runtime files — product-name string replacement (Tasks 7–11).

---

## Task 1: AnimatedLogo — static render

**Files:**
- Create: `frontend/components/brand/AnimatedLogo.tsx`

- [ ] **Step 1: Create the component (static, no animation yet)**

```tsx
// frontend/components/brand/AnimatedLogo.tsx
import { type CSSProperties } from 'react';

export interface AnimatedLogoProps {
  /** px of the square mark (defaults 48) */
  size?: number;
  /** mark only, or mark + WESTBOURSE wordmark */
  variant?: 'mark' | 'lockup';
  /** play the stroke-draw animation (default true) */
  animate?: boolean;
  /** loop the animation (loaders/splash) vs play once (default false) */
  loop?: boolean;
  /** render the rounded night-blue box behind the mark (default true) */
  background?: boolean;
  className?: string;
}

const NAVY = '#0c1d2e';
const WHITE = '#ffffff';
const TEAL = '#16b6a4';

export function AnimatedLogo({
  size = 48,
  variant = 'mark',
  animate = true,
  loop = false,
  background = true,
  className,
}: AnimatedLogoProps) {
  const animClass = animate ? (loop ? 'wslogo-anim wslogo-loop' : 'wslogo-anim') : '';
  const markStyle: CSSProperties = { width: size, height: (size * 105) / 130 };

  return (
    <span
      className={['wslogo', className].filter(Boolean).join(' ')}
      role="img"
      aria-label="WESTBOURSE"
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28 }}
    >
      <svg className={animClass} viewBox="0 0 130 105" style={markStyle} aria-hidden="true">
        {background && <rect x="2" y="2" width="126" height="101" rx="22" fill={NAVY} />}
        <path className="wslogo-w" d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke={WHITE} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
        <path className="wslogo-shaft" d="M76 82 L100 33" fill="none" stroke={TEAL} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
        <polygon className="wslogo-head" points="110,12 117,40 86,28" fill={TEAL} />
      </svg>
      {variant === 'lockup' && (
        <span
          style={{ fontWeight: 700, letterSpacing: '.42em', color: '#f4f6f8', fontSize: size * 0.42, paddingLeft: '.42em', whiteSpace: 'nowrap' }}
        >
          WESTBOURSE
        </span>
      )}
    </span>
  );
}

export default AnimatedLogo;
```

- [ ] **Step 2: Typecheck**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npx tsc --noEmit`
Expected: PASS (no errors referencing AnimatedLogo.tsx).

- [ ] **Step 3: Commit**

```bash
git add frontend/components/brand/AnimatedLogo.tsx
git commit -m "feat(brand): AnimatedLogo component (static WESTBOURSE mark/lockup)"
```

---

## Task 2: AnimatedLogo — stroke-draw animation + reduced-motion

**Files:**
- Modify: `frontend/app/globals.css` (append a `wslogo` animation block at the end)

- [ ] **Step 1: Append the CSS animation block to the end of `frontend/app/globals.css`**

```css
/* ----- WESTBOURSE animated logo (stroke-draw) ----- */
.wslogo-anim .wslogo-w { stroke-dasharray: 220; stroke-dashoffset: 220; animation: wslogo-draw 1.8s ease-in-out forwards; }
.wslogo-anim .wslogo-shaft { stroke-dasharray: 60; stroke-dashoffset: 60; animation: wslogo-draw 1.8s ease-in-out forwards; animation-delay: .55s; }
.wslogo-anim .wslogo-head { opacity: 0; transform-box: fill-box; transform-origin: 50% 100%; animation: wslogo-pop 1.8s ease-in-out forwards; animation-delay: .85s; }

.wslogo-loop .wslogo-w,
.wslogo-loop .wslogo-shaft,
.wslogo-loop .wslogo-head { animation-iteration-count: infinite; }

@keyframes wslogo-draw {
  0% { stroke-dashoffset: var(--ws-len, 220); }
  50% { stroke-dashoffset: 0; }
  88% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 0; }
}
@keyframes wslogo-pop {
  0%, 18% { opacity: 0; transform: scale(.2) translateY(6px); }
  40%, 88% { opacity: 1; transform: scale(1) translateY(0); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .wslogo-anim .wslogo-w,
  .wslogo-anim .wslogo-shaft { stroke-dashoffset: 0; animation: none; }
  .wslogo-anim .wslogo-head { opacity: 1; transform: none; animation: none; }
}
```

- [ ] **Step 2: Typecheck (CSS doesn't affect tsc, but confirm nothing else broke)**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Visual check**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npm run dev` then open a scratch page or temporarily drop `<AnimatedLogo variant="lockup" loop />` into `app/page.tsx`. Confirm: W draws, shaft draws, arrowhead pops, loop repeats. Toggle OS "reduce motion" → renders static. Remove the scratch usage before committing.
Expected: animation plays as described.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/globals.css
git commit -m "feat(brand): stroke-draw animation + reduced-motion for AnimatedLogo"
```

---

## Task 3: Reskin BrandLogo to the new static mark

**Files:**
- Modify: `frontend/components/landing/taste/BrandLogo.tsx`

Current file renders a 52x52 cyan checkmark with `aria-label="BRVM Analyst Pro"`. It is consumed by `components/landing/taste/TasteTopbar.tsx`. Replace its body with the frozen mark; keep the `size` prop and default so callers are unaffected.

- [ ] **Step 1: Replace the entire file contents**

```tsx
// frontend/components/landing/taste/BrandLogo.tsx
export function BrandLogo({ size = 44 }: { size?: number }) {
  const h = (size * 105) / 130;
  return (
    <svg width={size} height={h} viewBox="0 0 130 105" fill="none" aria-label="WESTBOURSE" className="shrink-0">
      <rect x="2" y="2" width="126" height="101" rx="22" fill="#0c1d2e" />
      <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M76 82 L100 33" fill="none" stroke="#16b6a4" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="110,12 117,40 86,28" fill="#16b6a4" />
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/landing/taste/BrandLogo.tsx
git commit -m "feat(brand): reskin BrandLogo to WESTBOURSE mark"
```

---

## Task 4: PWA assets — icon.svg, favicon.svg

**Files:**
- Modify: `frontend/public/icon.svg`
- Modify: `frontend/public/favicon.svg`

Both currently render the text "BRVM". Replace with the mark on the night-blue box, scaled into a 512×512 canvas (the mark's 130×105 box is centered/scaled).

- [ ] **Step 1: Overwrite `frontend/public/icon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#0c1d2e"/>
  <g transform="translate(76 146) scale(2.77)">
    <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M76 82 L100 33" fill="none" stroke="#16b6a4" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="110,12 117,40 86,28" fill="#16b6a4"/>
  </g>
</svg>
```

- [ ] **Step 2: Overwrite `frontend/public/favicon.svg`** (identical artwork)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#0c1d2e"/>
  <g transform="translate(76 146) scale(2.77)">
    <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M76 82 L100 33" fill="none" stroke="#16b6a4" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="110,12 117,40 86,28" fill="#16b6a4"/>
  </g>
</svg>
```

- [ ] **Step 3: Visual check**

Open both files in a browser (e.g. `start public/icon.svg`). Confirm the W + teal arrow render centered on the navy rounded square, no clipping.
Expected: mark fully visible, padded.

- [ ] **Step 4: Commit**

```bash
git add frontend/public/icon.svg frontend/public/favicon.svg
git commit -m "feat(brand): WESTBOURSE mark for icon.svg + favicon.svg"
```

---

## Task 5: manifest.json + sw.js strings

**Files:**
- Modify: `frontend/public/manifest.json`
- Modify: `frontend/public/sw.js:1` and `frontend/public/sw.js:85`

- [ ] **Step 1: Edit `frontend/public/manifest.json`** — set `"name": "WESTBOURSE"`, `"short_name": "WESTBOURSE"`. Keep `description` (it mentions "la BRVM" the exchange — leave that word). Result:

```json
{
  "name": "WESTBOURSE",
  "short_name": "WESTBOURSE",
  "description": "Plateforme d'analyse et d'aide à la décision sur la BRVM",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f1117",
  "theme_color": "#0f1117",
  "icons": [
    { "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }
  ],
  "categories": ["finance", "business"]
}
```

- [ ] **Step 2: Edit `frontend/public/sw.js`** — replace the two product-name occurrences:
  - Line 1 comment: `/* Service Worker — WESTBOURSE`
  - Line ~85: `self.registration.showNotification(data.title || 'WESTBOURSE', {`

- [ ] **Step 3: Verify no stray product-name left in public/**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && grep -rn "BRVM Analyst" public/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/public/manifest.json frontend/public/sw.js
git commit -m "feat(brand): WESTBOURSE in manifest + service worker"
```

---

## Task 6: SplashScreen + layout metadata + mount

**Files:**
- Create: `frontend/components/brand/SplashScreen.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create `frontend/components/brand/SplashScreen.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { AnimatedLogo } from './AnimatedLogo';

const KEY = 'ws_splash_seen';

export default function SplashScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(KEY)) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sessionStorage.setItem(KEY, '1');
    if (reduce) return; // no splash for reduced-motion users
    setShow(true);
    const t = setTimeout(() => setShow(false), 2200);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#0c1d2e', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        animation: 'wslogo-splash-out .4s ease 1.8s forwards',
      }}
    >
      <AnimatedLogo size={104} variant="lockup" animate loop={false} background={false} />
    </div>
  );
}
```

- [ ] **Step 2: Append the splash fade-out keyframe to `frontend/app/globals.css`**

```css
@keyframes wslogo-splash-out { to { opacity: 0; visibility: hidden; } }
```

- [ ] **Step 3: Edit `frontend/app/layout.tsx` metadata** — replace the title block and appleWebApp title (keep the description, which references the BRVM exchange):

```tsx
  title: { default: 'WESTBOURSE', template: '%s | WESTBOURSE' },
  description: "Plateforme d'analyse et d'aide à la décision d'investissement sur la BRVM (UEMOA).",
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WESTBOURSE',
  },
```

- [ ] **Step 4: Mount `<SplashScreen/>` in `frontend/app/layout.tsx`** — add the import and render it just inside `<body>`:

Add import near the other component imports:
```tsx
import SplashScreen from '@/components/brand/SplashScreen';
```
Render as the first child inside `<body className="text-white antialiased font-sans">`:
```tsx
      <body className="text-white antialiased font-sans">
        <SplashScreen />
        <ConsentProvider>
```

- [ ] **Step 5: Typecheck**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Visual check**

Run dev server, load `/` in a fresh tab (or clear sessionStorage). Splash overlay plays the lockup animation once then fades; reload in same tab → no splash. With OS reduce-motion on → no splash.
Expected: behaves as described.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/brand/SplashScreen.tsx frontend/app/globals.css frontend/app/layout.tsx
git commit -m "feat(brand): WESTBOURSE splash screen + layout metadata"
```

---

## Task 7: Landing hero — use the animated lockup

**Files:**
- Modify: `frontend/components/landing/taste/TasteTopbar.tsx` (already uses `BrandLogo`, now WESTBOURSE — verify any adjacent "BRVM Analyst Pro" text label)
- Modify: `frontend/app/page.tsx` (hero — swap the brand visual for `<AnimatedLogo variant="lockup" animate loop={false} background={false} />`)

- [ ] **Step 1: Inspect both files for the brand visual + text**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && grep -n "BRVM Analyst Pro\|BrandLogo" app/page.tsx components/landing/taste/TasteTopbar.tsx`
Expected: shows the exact lines to change.

- [ ] **Step 2: In `app/page.tsx`**, import and place the animated lockup in the hero where the product name/logo currently appears:

```tsx
import { AnimatedLogo } from '@/components/brand/AnimatedLogo';
// ...in the hero JSX, replacing the existing static brand title/logo:
<AnimatedLogo size={72} variant="lockup" animate loop={false} background={false} />
```
Replace any literal `BRVM Analyst Pro` hero heading text with `WESTBOURSE` (or remove it if the lockup now carries the wordmark — avoid duplicate wordmarks).

- [ ] **Step 3: In `TasteTopbar.tsx`**, replace any `BRVM Analyst Pro` text label next to `<BrandLogo/>` with `WESTBOURSE`.

- [ ] **Step 4: Typecheck**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Visual check** — load `/`, confirm hero shows the animated lockup once, topbar shows the new mark + WESTBOURSE, no duplicated wordmark.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/page.tsx frontend/components/landing/taste/TasteTopbar.tsx
git commit -m "feat(brand): animated WESTBOURSE lockup in landing hero + topbar"
```

---

## Task 8: Product-name rebrand — metadata & SEO pages

**Files (modify; replace product name only, keep "BRVM" = exchange):**
- `frontend/app/{heatmap,simulateur-budget,comparateur-sgi,backtest,assistant,scanner,signaux,calendrier,methodologie,dividendes,secteurs}/page.tsx`
- `frontend/app/societes/page.tsx`, `frontend/app/societes/[code]/page.tsx`
- `frontend/app/simulateur/page.tsx`, `frontend/app/simulateur/[code]/page.tsx`
- `frontend/app/brief/page.tsx`, `frontend/app/brief/[date]/page.tsx`
- `frontend/app/dividendes/calendrier/page.tsx`
- `frontend/app/premium/{reports/page.tsx,reports/[month]/page.tsx,valorisation/page.tsx,comparateur/page.tsx}`
- `frontend/app/actions/[code]/rapport/page.tsx`
- `frontend/app/api/og/{societe,brief,simulateur}/route.tsx`

- [ ] **Step 1: List every offending line**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && grep -rn "BRVM Analyst Pro" app/ | grep -v "node_modules"`
Expected: a concrete list of `file:line` to edit.

- [ ] **Step 2: For each line, replace the literal `BRVM Analyst Pro` → `WESTBOURSE`.** Do NOT touch any standalone `BRVM`. These are inside `title`, `description`, `openGraph.siteName`, OG image text. When the string is `… | BRVM Analyst Pro` or `BRVM Analyst Pro —`, only the product-name part changes.

- [ ] **Step 3: Typecheck**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/app
git commit -m "chore(brand): WESTBOURSE in page metadata + OG routes"
```

---

## Task 9: Product-name rebrand — emails, exports, push

**Files:**
- `frontend/lib/email/templates.ts`
- `frontend/app/api/newsletter/{subscribe,unsubscribe}/route.ts`
- `frontend/lib/export/{xlsx.ts,pdfTemplate.tsx,docxTemplate.ts}`
- `frontend/app/reports/export/ReportPDF.tsx`
- `frontend/app/actions/[code]/print/page.tsx`
- `frontend/components/MonthlyReportViewer.tsx`
- `frontend/app/api/push/test/route.ts`

- [ ] **Step 1: List offending lines**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && grep -rn "BRVM Analyst Pro" lib/email lib/export app/api/newsletter app/reports/export "app/actions/[code]/print" components/MonthlyReportViewer.tsx app/api/push/test`
Expected: concrete list.

- [ ] **Step 2: Replace each `BRVM Analyst Pro` → `WESTBOURSE`** (email headers/footers/sender display name, PDF/XLSX/DOCX document titles & footers, push notification title). Keep any standalone `BRVM`.

- [ ] **Step 3: Typecheck**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib frontend/app
git commit -m "chore(brand): WESTBOURSE in emails, exports, push"
```

---

## Task 10: Product-name rebrand — legal pages (CAREFUL)

**Files:**
- `frontend/app/cgu/page.tsx`
- `frontend/app/mentions-legales/page.tsx`
- `frontend/lib/legal/disclaimer.ts`

⚠️ Legal text may use "BRVM Analyst Pro" as the **commercial name of the operating entity**. There is no registered company entity defined in this codebase, so treat occurrences as the **commercial/brand name** and rebrand to WESTBOURSE — UNLESS an occurrence is clearly a registered legal entity (e.g. followed by "SARL", "SAS", an RCCM number, or a capital amount). In that case, leave the legal entity name unchanged and only rebrand standalone brand mentions. The user confirmed (2026-06-17) there is no separate legal entity, so default to full replacement.

- [ ] **Step 1: Read each file and locate the product-name occurrences**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && grep -n "BRVM Analyst Pro" app/cgu/page.tsx app/mentions-legales/page.tsx lib/legal/disclaimer.ts`

- [ ] **Step 2: Replace `BRVM Analyst Pro` → `WESTBOURSE`** in each, after confirming none is adjacent to a legal-form token (`SARL`/`SAS`/`RCCM`/`SA`). Keep standalone `BRVM` (the exchange).

- [ ] **Step 3: Typecheck**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/cgu frontend/app/mentions-legales frontend/lib/legal/disclaimer.ts
git commit -m "chore(brand): WESTBOURSE in legal pages + disclaimer"
```

---

## Task 11: Product-name rebrand — remaining UI + package.json + sweep

**Files:**
- `frontend/components/Footer.tsx`
- `frontend/components/admin/AdminShell.tsx`
- `frontend/app/login/SignInClient.tsx`
- `frontend/components/public/SimulatorClient.tsx`
- `frontend/components/backtest/share-button.tsx`
- `frontend/app/{dashboard,pricing,debutant,signaux,backtest,assistant,scanner,calendrier}/page.tsx` (any leftover not caught in Task 8)
- `frontend/app/api/cron/intraday-replay/route.ts`
- `frontend/tailwind.config.ts` (comment only — safe to update)
- `frontend/package.json` (field `"name"` → `"westbourse"`)
- `frontend/README.md`

- [ ] **Step 1: Edit `frontend/package.json`** — set `"name": "westbourse"` (slug; does not affect Vercel deploy which uses Root Directory, not package name).

- [ ] **Step 2: Replace remaining product-name occurrences in the UI/components/README/tailwind comment** — for each, `BRVM Analyst Pro` → `WESTBOURSE`, keep standalone `BRVM`.

Run to find them: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && grep -rn "BRVM Analyst Pro" components app/login app/api/cron tailwind.config.ts README.md package.json`

- [ ] **Step 3: Full sweep — confirm only intentional residue remains**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && grep -rn "BRVM Analyst Pro" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.md" | grep -v node_modules | grep -v package-lock.json`
Expected: empty, OR only entries explicitly kept (a documented legal entity). `package-lock.json` is allowed to keep the old name until the next `npm install` regenerates it; if it appears, run `npm install --package-lock-only` and stage it.

- [ ] **Step 4: Typecheck + build**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npx tsc --noEmit && npm run build`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "chore(brand): WESTBOURSE in remaining UI, package.json, README"
```

---

## Task 12: Final verification

- [ ] **Step 1: Build is green**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 2: No product-name leak in runtime code**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && grep -rn "BRVM Analyst Pro" app components lib public --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json"`
Expected: empty (or documented legal-entity exceptions only).

- [ ] **Step 3: "BRVM" exchange mentions are preserved**

Run: `cd "c:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend" && grep -rln "BRVM" app components lib | head`
Expected: still many results — these are the exchange name, correctly preserved.

- [ ] **Step 4: Visual smoke** — `npm run dev`: splash once/session, hero animated lockup, topbar + footer show WESTBOURSE + new mark, favicon updated, reduced-motion renders static.

- [ ] **Step 5: Push (only if the user asks to deploy)**

```bash
git push origin main
```
Vercel auto-deploys the frontend.

---

## Notes for the implementer

- The frozen SVG identity in the header is the single source of truth. Copy paths verbatim; do not "improve" coordinates.
- Never replace a standalone `BRVM` — it is the stock exchange the product analyzes. Only `BRVM Analyst Pro` (the product) becomes `WESTBOURSE`.
- Do NOT edit `supabase/migrations/*`, `docs/superpowers/specs/*`, or `docs/superpowers/plans/*` — historical/immutable.
- No new npm dependency: the animation is CSS-only.
- Verification gate is `npx tsc --noEmit` + `npm run build` + visual check (no frontend test runner exists).
