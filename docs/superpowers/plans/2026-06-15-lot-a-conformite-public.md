# Lot A — Conformité & habillage public — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre BRVM Analyst Pro en conformité SaaS : consentement cookies RGPD extensible, pages légales complètes (droit ivoirien/OHADA + premium), footer global public, et renommage du bouton « Terminal » en « Connexion ».

**Architecture:** Tout est dans `frontend/` (Next.js 14 App Router). Le consentement est une couche cliente sans dépendance (registre déclaratif + logique pure testée + context React monté dans `app/layout.tsx`). Les pages légales partagent deux composants de présentation (`LegalPage`, `Placeholder`). Le footer est rendu pour les routes publiques via `ConditionalShell`. Aucune donnée légale n'est inventée : les valeurs manquantes sont des `<Placeholder>`.

**Tech Stack:** Next.js 14, React 18, TypeScript strict, TailwindCSS (thème dark cyan), vitest (tests unitaires `frontend`), Playwright (smoke).

**Spec:** `docs/superpowers/specs/2026-06-15-lot-a-conformite-public-design.md`

**Conventions repo :** commandes depuis `frontend/`. Après chaque tâche : `npx tsc --noEmit` doit passer. Tests : `npx vitest run <path>`. Commits fréquents, messages FR, finir par la ligne `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Ne jamais committer de secret.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `lib/consent/registry.ts` | Catégories de cookies déclaratives (source de vérité) |
| `lib/consent/state.ts` | Logique pure : (dé)sérialisation, defaults, `has()` |
| `lib/consent/state.test.ts` | Tests unitaires de la logique pure |
| `components/consent/ConsentProvider.tsx` | Context React (lit/écrit localStorage) |
| `components/consent/CookieBanner.tsx` | Bandeau bas d'écran |
| `components/consent/CookiePreferences.tsx` | Modal « Personnaliser » |
| `lib/legal/disclaimer.ts` | Disclaimer financier centralisé |
| `components/legal/Placeholder.tsx` | Rendu « [À COMPLÉTER : …] » |
| `components/legal/LegalPage.tsx` | Gabarit de page légale (titre + prose) |
| `components/Footer.tsx` | Footer global public |
| `components/FooterCookieLink.tsx` | Lien client « Gérer mes cookies » |
| `app/cgu/page.tsx` | Page CGU (nouvelle) |
| `app/mentions-legales/page.tsx` | Réécrite |
| `app/confidentialite/page.tsx` | Réécrite |
| `app/layout.tsx` | Monte `ConsentProvider` + `CookieBanner` |
| `components/ConditionalShell.tsx` | Rend le footer sur routes publiques + légales |
| `components/landing/taste/TasteTopbar.tsx` | « Terminal » → « Connexion » |
| `e2e/consent.spec.ts` | Smoke Playwright bandeau |

---

## Task 1 : Logique pure du consentement (registre + state)

**Files:**
- Create: `frontend/lib/consent/registry.ts`
- Create: `frontend/lib/consent/state.ts`
- Test: `frontend/lib/consent/state.test.ts`

- [ ] **Step 1 : Écrire le registre**

Create `frontend/lib/consent/registry.ts` :

```ts
// Source de vérité des catégories de cookies (RGPD/ePrivacy).
// Aujourd'hui : seuls des cookies essentiels (session Supabase) sont posés.
// Pour activer un futur analytics : rendre son script conditionnel à
// `has(choice, 'analytics')` (voir lib/consent/state.ts).

export type ConsentCategoryId = 'essential' | 'analytics' | 'marketing';

export interface ConsentCookie {
  name: string;
  purpose: string;
  duration: string;
}

export interface ConsentCategory {
  id: ConsentCategoryId;
  label: string;
  description: string;
  /** Catégorie toujours active, non désactivable (essentiels). */
  required: boolean;
  cookies: ConsentCookie[];
}

/** Incrémenter pour forcer un re-consentement (changement de finalités). */
export const CONSENT_VERSION = 1;
export const CONSENT_STORAGE_KEY = 'brvm-consent-v1';

export const CONSENT_CATEGORIES: ConsentCategory[] = [
  {
    id: 'essential',
    label: 'Strictement nécessaires',
    description:
      "Indispensables au fonctionnement du site (session de connexion sécurisée). Ils ne peuvent pas être désactivés.",
    required: true,
    cookies: [
      { name: 'sb-access-token', purpose: 'Session authentifiée', duration: 'Session' },
      { name: 'sb-refresh-token', purpose: 'Renouvellement de session', duration: '~1 an' },
    ],
  },
  {
    id: 'analytics',
    label: 'Mesure d’audience',
    description:
      "Statistiques de fréquentation anonymisées pour améliorer le service. Aucun outil de ce type n’est actif aujourd’hui.",
    required: false,
    cookies: [],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description:
      "Personnalisation et campagnes. Aucun outil de ce type n’est actif aujourd’hui.",
    required: false,
    cookies: [],
  },
];
```

- [ ] **Step 2 : Écrire le test (échoue d'abord)**

Create `frontend/lib/consent/state.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import {
  defaultDenied,
  acceptAll,
  serialize,
  parse,
  has,
} from './state';
import { CONSENT_VERSION } from './registry';

describe('consent state', () => {
  it('defaultDenied garde essential ON et le reste OFF', () => {
    const c = defaultDenied();
    expect(c.granted.essential).toBe(true);
    expect(c.granted.analytics).toBe(false);
    expect(c.granted.marketing).toBe(false);
    expect(c.version).toBe(CONSENT_VERSION);
  });

  it('acceptAll active toutes les catégories', () => {
    const c = acceptAll();
    expect(c.granted.analytics).toBe(true);
    expect(c.granted.marketing).toBe(true);
  });

  it('serialize puis parse redonne le même choix', () => {
    const c = acceptAll();
    expect(parse(serialize(c))).toEqual(c);
  });

  it('parse renvoie null si version périmée', () => {
    const stale = JSON.stringify({ version: 0, timestamp: 'x', granted: {} });
    expect(parse(stale)).toBeNull();
  });

  it('parse renvoie null sur entrée invalide', () => {
    expect(parse(null)).toBeNull();
    expect(parse('pas du json')).toBeNull();
  });

  it('has renvoie false quand choice est null, true pour essential', () => {
    expect(has(null, 'analytics')).toBe(false);
    expect(has(defaultDenied(), 'essential')).toBe(true);
    expect(has(defaultDenied(), 'analytics')).toBe(false);
    expect(has(acceptAll(), 'analytics')).toBe(true);
  });
});
```

- [ ] **Step 3 : Lancer le test → échec attendu**

Run: `cd frontend && npx vitest run lib/consent/state.test.ts`
Expected: FAIL (`Cannot find module './state'`).

- [ ] **Step 4 : Implémenter la logique pure**

Create `frontend/lib/consent/state.ts` :

```ts
import {
  CONSENT_VERSION,
  CONSENT_CATEGORIES,
  type ConsentCategoryId,
} from './registry';

export interface ConsentChoice {
  version: number;
  timestamp: string;
  granted: Record<ConsentCategoryId, boolean>;
}

function build(allNonEssential: boolean): ConsentChoice {
  const granted = {} as Record<ConsentCategoryId, boolean>;
  for (const cat of CONSENT_CATEGORIES) {
    granted[cat.id] = cat.required ? true : allNonEssential;
  }
  return { version: CONSENT_VERSION, timestamp: new Date().toISOString(), granted };
}

export function defaultDenied(): ConsentChoice {
  return build(false);
}

export function acceptAll(): ConsentChoice {
  return build(true);
}

export function serialize(choice: ConsentChoice): string {
  return JSON.stringify(choice);
}

export function parse(raw: string | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<ConsentChoice>;
    if (obj.version !== CONSENT_VERSION || typeof obj.granted !== 'object' || !obj.granted) {
      return null;
    }
    return obj as ConsentChoice;
  } catch {
    return null;
  }
}

export function has(choice: ConsentChoice | null, id: ConsentCategoryId): boolean {
  if (!choice) return false;
  return choice.granted[id] === true;
}
```

- [ ] **Step 5 : Lancer le test → succès attendu**

Run: `cd frontend && npx vitest run lib/consent/state.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6 : Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd .. && git add frontend/lib/consent
git commit -m "feat(consent): registre de cookies + logique pure de consentement (testée)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 : Provider de consentement + bandeau + modal

**Files:**
- Create: `frontend/components/consent/ConsentProvider.tsx`
- Create: `frontend/components/consent/CookiePreferences.tsx`
- Create: `frontend/components/consent/CookieBanner.tsx`

- [ ] **Step 1 : Le provider (context + localStorage)**

Create `frontend/components/consent/ConsentProvider.tsx` :

```tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CONSENT_STORAGE_KEY, type ConsentCategoryId } from '@/lib/consent/registry';
import {
  type ConsentChoice,
  parse,
  serialize,
  has as hasCategory,
} from '@/lib/consent/state';

interface ConsentContextValue {
  /** null = aucun choix valide encore enregistré. */
  choice: ConsentChoice | null;
  /** true tant que l'utilisateur n'a pas tranché (bandeau visible). */
  needsChoice: boolean;
  /** Ouvre la modal de préférences. */
  open: () => void;
  /** Ferme la modal. */
  close: () => void;
  isPrefsOpen: boolean;
  /** Enregistre un choix (localStorage + state). */
  save: (choice: ConsentChoice) => void;
  has: (id: ConsentCategoryId) => boolean;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isPrefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    try {
      setChoice(parse(localStorage.getItem(CONSENT_STORAGE_KEY)));
    } catch {
      setChoice(null);
    }
    setHydrated(true);
  }, []);

  const save = useCallback((next: ConsentChoice) => {
    setChoice(next);
    setPrefsOpen(false);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, serialize(next));
    } catch {
      // localStorage indisponible (navigation privée stricte) : on ignore.
    }
  }, []);

  const value: ConsentContextValue = {
    choice,
    // Tant que non hydraté on ne montre rien (évite un flash SSR).
    needsChoice: hydrated && choice === null,
    open: () => setPrefsOpen(true),
    close: () => setPrefsOpen(false),
    isPrefsOpen,
    save,
    has: (id) => hasCategory(choice, id),
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent doit être utilisé dans <ConsentProvider>');
  return ctx;
}
```

- [ ] **Step 2 : La modal de préférences**

Create `frontend/components/consent/CookiePreferences.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { CONSENT_CATEGORIES, CONSENT_VERSION, type ConsentCategoryId } from '@/lib/consent/registry';
import { useConsent } from './ConsentProvider';

export function CookiePreferences() {
  const { isPrefsOpen, close, save, choice } = useConsent();
  const [granted, setGranted] = useState<Record<ConsentCategoryId, boolean>>(() => {
    const base = {} as Record<ConsentCategoryId, boolean>;
    for (const c of CONSENT_CATEGORIES) base[c.id] = c.required ? true : choice?.granted[c.id] ?? false;
    return base;
  });

  if (!isPrefsOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Préférences cookies">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a1417] p-6 shadow-2xl">
        <h2 className="font-display text-xl font-semibold text-white">Préférences cookies</h2>
        <p className="mt-1 text-sm text-white/60">Choisissez les catégories que vous autorisez. Les cookies strictement nécessaires restent toujours actifs.</p>

        <div className="mt-5 space-y-3">
          {CONSENT_CATEGORIES.map((cat) => (
            <div key={cat.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{cat.label}</p>
                  <p className="mt-0.5 text-xs text-white/55">{cat.description}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={granted[cat.id]}
                    disabled={cat.required}
                    onChange={(e) => setGranted((g) => ({ ...g, [cat.id]: e.target.checked }))}
                  />
                  <span className="h-5 w-9 rounded-full bg-white/15 transition-colors peer-checked:bg-[#56d7fd] peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={close} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white">Annuler</button>
          <button
            type="button"
            onClick={() => save({ version: CONSENT_VERSION, timestamp: new Date().toISOString(), granted })}
            className="rounded-full bg-[#56d7fd] px-5 py-2 text-sm font-semibold text-[#03222b] hover:bg-[#8fe6ff]"
          >
            Enregistrer mes choix
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Le bandeau**

Create `frontend/components/consent/CookieBanner.tsx` :

```tsx
'use client';

import Link from 'next/link';
import { useConsent } from './ConsentProvider';
import { CookiePreferences } from './CookiePreferences';
import { defaultDenied, acceptAll } from '@/lib/consent/state';

export function CookieBanner() {
  const { needsChoice, open, save } = useConsent();

  return (
    <>
      <CookiePreferences />
      {needsChoice && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0a1417]/95 px-4 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/70">
              Nous utilisons des cookies strictement nécessaires au fonctionnement du site.
              Vous pouvez accepter la mesure d’audience pour nous aider à l’améliorer.{' '}
              <Link href="/confidentialite" className="underline hover:text-white">En savoir plus</Link>.
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => save(defaultDenied())} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white">Refuser</button>
              <button type="button" onClick={open} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white">Personnaliser</button>
              <button type="button" onClick={() => save(acceptAll())} className="rounded-full bg-[#56d7fd] px-5 py-2 text-sm font-semibold text-[#03222b] hover:bg-[#8fe6ff]">Tout accepter</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4 : Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd .. && git add frontend/components/consent
git commit -m "feat(consent): provider context + bandeau + modal de préférences cookies

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 : Monter le consentement dans le layout

**Files:**
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1 : Importer provider + bandeau**

Dans `frontend/app/layout.tsx`, ajouter aux imports (après la ligne `import { BeginnerModeProvider } from '@/lib/beginner-mode';`) :

```tsx
import { ConsentProvider } from '@/components/consent/ConsentProvider';
import { CookieBanner } from '@/components/consent/CookieBanner';
```

- [ ] **Step 2 : Envelopper le body**

Toujours dans `frontend/app/layout.tsx`, remplacer le bloc :

```tsx
        <BeginnerModeProvider initial={initialBeginner}>
          <ConditionalShell isPremium={isPremium} isAdmin={isAdmin}>{children}</ConditionalShell>
          <CommandPaletteProvider />
          <ServiceWorkerRegister />
          {user && !onboardingDone && <OnboardingModal />}
        </BeginnerModeProvider>
```

par :

```tsx
        <ConsentProvider>
          <BeginnerModeProvider initial={initialBeginner}>
            <ConditionalShell isPremium={isPremium} isAdmin={isAdmin}>{children}</ConditionalShell>
            <CommandPaletteProvider />
            <ServiceWorkerRegister />
            {user && !onboardingDone && <OnboardingModal />}
            <CookieBanner />
          </BeginnerModeProvider>
        </ConsentProvider>
```

- [ ] **Step 3 : Typecheck + build rapide + commit**

```bash
cd frontend && npx tsc --noEmit
cd .. && git add frontend/app/layout.tsx
git commit -m "feat(consent): monte ConsentProvider + CookieBanner dans le layout racine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 : Disclaimer centralisé + Footer + lien cookies

**Files:**
- Create: `frontend/lib/legal/disclaimer.ts`
- Create: `frontend/components/FooterCookieLink.tsx`
- Create: `frontend/components/Footer.tsx`

- [ ] **Step 1 : Disclaimer centralisé**

Create `frontend/lib/legal/disclaimer.ts` :

```ts
// Avertissement financier réutilisé (footer, CGU). Une seule source.
export const FINANCIAL_DISCLAIMER =
  "Les analyses, notes, signaux et simulations présentés sur BRVM Analyst Pro sont fournis à titre informatif et pédagogique. Ils ne constituent pas un conseil en investissement, une recommandation personnalisée, ni une incitation à acheter ou vendre. Tout investissement comporte un risque de perte en capital.";
```

- [ ] **Step 2 : Lien client « Gérer mes cookies »**

Create `frontend/components/FooterCookieLink.tsx` :

```tsx
'use client';

import { useConsent } from '@/components/consent/ConsentProvider';

export function FooterCookieLink() {
  const { open } = useConsent();
  return (
    <button type="button" onClick={open} className="text-left text-white/55 transition-colors hover:text-white">
      Gérer mes cookies
    </button>
  );
}
```

- [ ] **Step 3 : Le footer**

Create `frontend/components/Footer.tsx` :

```tsx
import Link from 'next/link';
import { FooterCookieLink } from '@/components/FooterCookieLink';
import { FINANCIAL_DISCLAIMER } from '@/lib/legal/disclaimer';

const PRODUIT = [
  { href: '/societes', label: 'Sociétés' },
  { href: '/simulateur', label: 'Simulateur' },
  { href: '/brief', label: 'Brief du jour' },
];

const LEGAL = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgu', label: "Conditions d'utilisation" },
  { href: '/confidentialite', label: 'Confidentialité' },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-[#06090b] px-6 py-12 text-sm">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#56d7fd]/40 bg-[#56d7fd]/10 font-display text-lg font-bold text-[#56d7fd]">B</span>
            <span className="font-display font-semibold text-white">BRVM Analyst Pro</span>
          </div>
          <p className="mt-3 max-w-xs text-xs text-white/45">Analyse et aide à la décision d'investissement sur la BRVM (UEMOA).</p>
        </div>

        <nav aria-label="Produit">
          <p className="text-xs uppercase tracking-wider text-white/35">Produit</p>
          <ul className="mt-3 space-y-2">
            {PRODUIT.map((l) => (
              <li key={l.href}><Link href={l.href} className="text-white/55 transition-colors hover:text-white">{l.label}</Link></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Légal">
          <p className="text-xs uppercase tracking-wider text-white/35">Légal</p>
          <ul className="mt-3 space-y-2">
            {LEGAL.map((l) => (
              <li key={l.href}><Link href={l.href} className="text-white/55 transition-colors hover:text-white">{l.label}</Link></li>
            ))}
            <li><FooterCookieLink /></li>
          </ul>
        </nav>

        <nav aria-label="Compte">
          <p className="text-xs uppercase tracking-wider text-white/35">Compte</p>
          <ul className="mt-3 space-y-2">
            <li><Link href="/login" className="text-white/55 transition-colors hover:text-white">Connexion</Link></li>
            <li><Link href="/signup" className="text-white/55 transition-colors hover:text-white">Créer un compte</Link></li>
          </ul>
        </nav>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-white/5 pt-6">
        <p className="text-[11px] leading-relaxed text-white/35">{FINANCIAL_DISCLAIMER}</p>
        <p className="mt-3 text-[11px] text-white/30">© {year} BRVM Analyst Pro. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4 : Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd .. && git add frontend/lib/legal frontend/components/Footer.tsx frontend/components/FooterCookieLink.tsx
git commit -m "feat(legal): footer global public + disclaimer financier centralisé

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 : Rendre le footer sur les routes publiques

**Files:**
- Modify: `frontend/components/ConditionalShell.tsx`

- [ ] **Step 1 : Ajouter les routes légales en plein écran + footer**

Remplacer **tout** le contenu de `frontend/components/ConditionalShell.tsx` par :

```tsx
'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import Footer from '@/components/Footer';

/** Routes affichées en plein écran, sans la sidebar (landing + auth). */
const BARE_ROUTES = new Set<string>(['/', '/login', '/signup']);

/** Sections publiques SEO : plein écran avec leur propre header (PublicShell). */
const BARE_PREFIXES = ['/societes', '/simulateur', '/brief'];

/** Pages légales : publiques, plein écran, AVEC footer. */
const LEGAL_PREFIXES = ['/mentions-legales', '/cgu', '/confidentialite'];

/** Routes publiques qui doivent afficher le footer global. */
function showsFooter(pathname: string): boolean {
  if (pathname === '/login' || pathname === '/signup') return false;
  if (pathname === '/') return true;
  return [...BARE_PREFIXES, ...LEGAL_PREFIXES].some((p) => pathname.startsWith(p));
}

/**
 * Décide d'envelopper ou non les pages dans le shell applicatif (sidebar + main).
 * La landing (`/`), les pages publiques et les pages légales sont rendues plein
 * écran ; toutes les autres pages gardent le shell. Le footer global s'affiche
 * sur les routes publiques (jamais dans l'app authentifiée, ni sur /login·/signup).
 */
export default function ConditionalShell({
  isPremium,
  isAdmin = false,
  children,
}: {
  isPremium: boolean;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const bare =
    BARE_ROUTES.has(pathname) ||
    BARE_PREFIXES.some((p) => pathname.startsWith(p)) ||
    LEGAL_PREFIXES.some((p) => pathname.startsWith(p));

  if (bare) {
    return (
      <>
        {children}
        {showsFooter(pathname) && <Footer />}
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar isPremium={isPremium} isAdmin={isAdmin} />
      <div className="flex-1 min-w-0">
        <MobileNav isPremium={isPremium} isAdmin={isAdmin} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Retirer le footer inline de la landing (évite le doublon)**

Ouvrir `frontend/app/page.tsx`, localiser l'élément `<footer ...>...</footer>` existant et le **supprimer** (le footer global le remplace). Vérifier qu'aucune variable ne devient inutilisée (sinon retirer son import). Si la landing n'avait pas de balise `<footer>` mais un bloc de liens légaux en bas, le supprimer également.

Run pour localiser : `cd frontend && grep -n "<footer\|mentions-legales\|confidentialite" app/page.tsx`

- [ ] **Step 3 : Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd .. && git add frontend/components/ConditionalShell.tsx frontend/app/page.tsx
git commit -m "feat(legal): footer global sur routes publiques + pages légales plein écran

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6 : Composants partagés des pages légales

**Files:**
- Create: `frontend/components/legal/Placeholder.tsx`
- Create: `frontend/components/legal/LegalPage.tsx`

- [ ] **Step 1 : Placeholder « À COMPLÉTER »**

Create `frontend/components/legal/Placeholder.tsx` :

```tsx
/**
 * Marque une valeur légale manquante, à fournir avant le lancement public.
 * Visuellement repérable — ne JAMAIS inventer la donnée à la place.
 */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-amber-400/20 px-1 text-amber-300" title="À compléter avant publication">
      [À COMPLÉTER : {children}]
    </mark>
  );
}
```

- [ ] **Step 2 : Gabarit de page légale**

Create `frontend/components/legal/LegalPage.tsx` :

```tsx
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg px-6 py-16">
      <article className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-xs text-white/40">Dernière mise à jour : {updatedAt}</p>
        <div className="legal-prose mt-8 space-y-6 text-sm leading-relaxed text-white/70">
          {children}
        </div>
      </article>
    </main>
  );
}
```

- [ ] **Step 3 : Style de prose légale**

Dans `frontend/app/globals.css`, ajouter à la fin :

```css
/* Prose des pages légales */
.legal-prose h2 { @apply font-display text-lg font-semibold text-white mt-8 mb-2; }
.legal-prose h3 { @apply font-semibold text-white/90 mt-4 mb-1; }
.legal-prose p { @apply text-white/70; }
.legal-prose ul { @apply list-disc space-y-1 pl-5 text-white/70; }
.legal-prose a { @apply text-[#56d7fd] underline; }
.legal-prose strong { @apply text-white/90; }
```

- [ ] **Step 4 : Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd .. && git add frontend/components/legal frontend/app/globals.css
git commit -m "feat(legal): composants partagés LegalPage + Placeholder + style prose

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7 : Réécrire les Mentions légales

**Files:**
- Modify (réécriture complète): `frontend/app/mentions-legales/page.tsx`

- [ ] **Step 1 : Réécrire la page**

Remplacer **tout** le contenu de `frontend/app/mentions-legales/page.tsx` par :

```tsx
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { Placeholder } from '@/components/legal/Placeholder';

export const metadata: Metadata = { title: 'Mentions légales' };

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updatedAt="2026-06-15">
      <section>
        <h2>Éditeur du service</h2>
        <p>
          Le service <strong>BRVM Analyst Pro</strong> est édité par{' '}
          <Placeholder>raison sociale</Placeholder>, société{' '}
          <Placeholder>forme juridique (SARL, SAS…)</Placeholder> au capital de{' '}
          <Placeholder>montant du capital</Placeholder>, immatriculée au RCCM sous le numéro{' '}
          <Placeholder>numéro RCCM</Placeholder>, dont le siège social est situé{' '}
          <Placeholder>adresse du siège</Placeholder>.
        </p>
        <p>
          Numéro de contribuable / identifiant fiscal : <Placeholder>NCC / IFU</Placeholder>.<br />
          Adresse e-mail : <Placeholder>email de contact</Placeholder> — Téléphone :{' '}
          <Placeholder>téléphone</Placeholder>.
        </p>
      </section>

      <section>
        <h2>Directeur de la publication</h2>
        <p><Placeholder>nom du directeur de la publication</Placeholder>.</p>
      </section>

      <section>
        <h2>Hébergement</h2>
        <p>
          Application hébergée par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133,
          Walnut, CA 91789, États-Unis (<a href="https://vercel.com">vercel.com</a>).
        </p>
        <p>
          Base de données et authentification hébergées par <strong>Supabase Inc.</strong>
          (<a href="https://supabase.com">supabase.com</a>).
        </p>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          L'ensemble des éléments du site (textes, analyses, interface, logos, code) est
          protégé par le droit de la propriété intellectuelle. Toute reproduction ou
          réutilisation non autorisée est interdite.
        </p>
      </section>

      <section>
        <h2>Sources de données</h2>
        <p>
          Les données de marché proviennent de la BRVM et du portail BDFIN. BRVM Analyst Pro
          n'est ni affilié ni endossé par la BRVM. Les données sont fournies sans garantie
          d'exhaustivité ni d'exactitude.
        </p>
      </section>
    </LegalPage>
  );
}
```

- [ ] **Step 2 : Vérifier le rendu**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS. (Optionnel : `npm run dev` et ouvrir `/mentions-legales`.)

- [ ] **Step 3 : Commit**

```bash
cd .. && git add frontend/app/mentions-legales/page.tsx
git commit -m "feat(legal): réécriture des mentions légales (éditeur, hébergeur, placeholders)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8 : Créer les CGU (droit OHADA + premium)

**Files:**
- Create: `frontend/app/cgu/page.tsx`

- [ ] **Step 1 : Créer la page**

Create `frontend/app/cgu/page.tsx` :

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { Placeholder } from '@/components/legal/Placeholder';
import { FINANCIAL_DISCLAIMER } from '@/lib/legal/disclaimer';

export const metadata: Metadata = { title: "Conditions générales d'utilisation" };

export default function CguPage() {
  return (
    <LegalPage title="Conditions générales d'utilisation" updatedAt="2026-06-15">
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
        <p className="text-amber-200">
          <strong>Avertissement important.</strong> {FINANCIAL_DISCLAIMER}
        </p>
      </div>

      <section>
        <h2>1. Objet</h2>
        <p>
          Les présentes conditions générales d'utilisation (« CGU ») régissent l'accès et
          l'utilisation du service BRVM Analyst Pro (« le Service »), édité par{' '}
          <Placeholder>raison sociale</Placeholder>. En utilisant le Service, l'utilisateur
          accepte sans réserve les présentes CGU.
        </p>
      </section>

      <section>
        <h2>2. Accès au Service et inscription</h2>
        <p>
          Le Service est accessible en partie gratuitement. Certaines fonctionnalités
          nécessitent la création d'un compte via une adresse e-mail (connexion par code à
          usage unique ou via un fournisseur d'identité tiers). L'utilisateur s'engage à
          fournir des informations exactes.
        </p>
      </section>

      <section>
        <h2>3. Compte utilisateur</h2>
        <p>
          L'utilisateur est responsable de la confidentialité de l'accès à son compte et de
          toute activité réalisée depuis celui-ci. Il peut demander la suppression de son
          compte à tout moment.
        </p>
      </section>

      <section>
        <h2>4. Abonnement premium</h2>
        <p>
          Le Service propose une offre payante « Premium » donnant accès à des
          fonctionnalités avancées. Le prix applicable est de{' '}
          <Placeholder>prix de l'abonnement</Placeholder>, payable selon la périodicité
          indiquée lors de la souscription.
        </p>
        <ul>
          <li>Le paiement s'effectue via le prestataire <Placeholder>prestataire de paiement</Placeholder>.</li>
          <li>L'abonnement est reconduit automatiquement, sauf résiliation avant l'échéance.</li>
          <li>La résiliation s'effectue depuis l'espace compte ; elle prend effet à la fin de la période en cours.</li>
          <li>Les conditions de remboursement sont précisées au moment de l'achat : <Placeholder>politique de remboursement</Placeholder>.</li>
        </ul>
      </section>

      <section>
        <h2>5. Disponibilité et maintenance</h2>
        <p>
          L'éditeur s'efforce d'assurer la disponibilité du Service sans pouvoir la garantir
          de manière continue. Des interruptions pour maintenance ou cas de force majeure
          peuvent survenir.
        </p>
      </section>

      <section>
        <h2>6. Avertissement sur les risques d'investissement</h2>
        <p>
          Les analyses, notes (A–F), signaux, scores, simulations et contenus du Service sont
          fournis à titre purement informatif et pédagogique. <strong>Ils ne constituent en
          aucun cas un conseil en investissement, une recommandation personnalisée, une
          sollicitation ou une offre d'achat ou de vente d'instruments financiers.</strong>{' '}
          Les performances passées ne préjugent pas des performances futures. Tout
          investissement comporte un risque de perte en capital. L'utilisateur reste seul
          responsable de ses décisions et est invité à consulter un conseiller agréé.
        </p>
      </section>

      <section>
        <h2>7. Responsabilité</h2>
        <p>
          L'éditeur ne saurait être tenu responsable des pertes ou dommages résultant de
          l'utilisation du Service, de l'inexactitude ou de l'indisponibilité des données, ni
          des décisions prises sur la base des contenus fournis.
        </p>
      </section>

      <section>
        <h2>8. Données personnelles</h2>
        <p>
          Le traitement des données personnelles est décrit dans notre{' '}
          <Link href="/confidentialite">Politique de confidentialité</Link>.
        </p>
      </section>

      <section>
        <h2>9. Propriété intellectuelle</h2>
        <p>
          Tous les éléments du Service sont protégés. Toute reproduction non autorisée est
          interdite.
        </p>
      </section>

      <section>
        <h2>10. Droit applicable et juridiction</h2>
        <p>
          Les présentes CGU sont régies par le droit en vigueur en{' '}
          <strong>République de Côte d'Ivoire</strong> et par les actes uniformes de l'OHADA.
          En cas de litige, et à défaut de résolution amiable préalable, compétence est
          attribuée aux <strong>tribunaux compétents d'Abidjan</strong>.
        </p>
      </section>
    </LegalPage>
  );
}
```

- [ ] **Step 2 : Vérifier**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3 : Commit**

```bash
cd .. && git add frontend/app/cgu/page.tsx
git commit -m "feat(legal): CGU (droit OHADA/Côte d'Ivoire, abonnement premium, avertissement risque)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9 : Réécrire la Politique de confidentialité

**Files:**
- Modify (réécriture complète): `frontend/app/confidentialite/page.tsx`

- [ ] **Step 1 : Réécrire la page**

Remplacer **tout** le contenu de `frontend/app/confidentialite/page.tsx` par :

```tsx
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { Placeholder } from '@/components/legal/Placeholder';
import { CONSENT_CATEGORIES } from '@/lib/consent/registry';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedAt="2026-06-15">
      <section>
        <h2>Responsable de traitement</h2>
        <p>
          Le responsable du traitement des données est <Placeholder>raison sociale</Placeholder>,
          joignable à l'adresse <Placeholder>email de contact</Placeholder>.
        </p>
      </section>

      <section>
        <h2>Données collectées</h2>
        <ul>
          <li><strong>Compte</strong> : adresse e-mail, identifiant de session.</li>
          <li><strong>Usage</strong> : watchlist, portefeuille, simulations de paper-trading, préférences.</li>
          <li><strong>Newsletter</strong> : adresse e-mail, si vous y consentez.</li>
        </ul>
      </section>

      <section>
        <h2>Finalités et base légale</h2>
        <ul>
          <li>Fourniture du service et gestion du compte — exécution du contrat.</li>
          <li>Envoi de la newsletter — consentement.</li>
          <li>Sécurité et prévention de la fraude — intérêt légitime.</li>
        </ul>
      </section>

      <section>
        <h2>Durées de conservation</h2>
        <p>
          Les données de compte sont conservées tant que le compte est actif, puis supprimées
          ou anonymisées dans un délai raisonnable après sa fermeture. Les données de
          newsletter sont conservées jusqu'au désabonnement.
        </p>
      </section>

      <section>
        <h2>Destinataires et sous-traitants</h2>
        <ul>
          <li><strong>Supabase</strong> — hébergement base de données et authentification.</li>
          <li><strong>Vercel</strong> — hébergement de l'application.</li>
          <li><strong>Resend</strong> — envoi des e-mails transactionnels et newsletter.</li>
        </ul>
        <p>Certains prestataires peuvent traiter des données hors UEMOA, avec les garanties appropriées.</p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Conformément à la réglementation applicable, vous disposez d'un droit d'accès, de
          rectification, d'effacement, d'opposition, de limitation et de portabilité. Pour les
          exercer, écrivez à <Placeholder>email de contact</Placeholder>.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>Le site utilise les catégories de cookies suivantes :</p>
        <ul>
          {CONSENT_CATEGORIES.map((cat) => (
            <li key={cat.id}>
              <strong>{cat.label}</strong> — {cat.description}
              {cat.cookies.length > 0 && (
                <> {' '}({cat.cookies.map((c) => c.name).join(', ')})</>
              )}
            </li>
          ))}
        </ul>
        <p>Vous pouvez modifier vos choix à tout moment via le lien « Gérer mes cookies » en pied de page.</p>
      </section>
    </LegalPage>
  );
}
```

- [ ] **Step 2 : Vérifier**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3 : Commit**

```bash
cd .. && git add frontend/app/confidentialite/page.tsx
git commit -m "feat(legal): réécriture de la politique de confidentialité (RGPD, sous-traitants, registre cookies)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10 : Bouton « Terminal » → « Connexion »

**Files:**
- Modify: `frontend/components/landing/taste/TasteTopbar.tsx:42`

- [ ] **Step 1 : Renommer le libellé**

Dans `frontend/components/landing/taste/TasteTopbar.tsx`, remplacer la ligne :

```tsx
        <BeamButton href="/login" className="hidden sm:inline-flex">Terminal</BeamButton>
```

par :

```tsx
        <BeamButton href="/login" className="hidden sm:inline-flex">Connexion</BeamButton>
```

- [ ] **Step 2 : Vérifier qu'aucun autre CTA public ne court-circuite l'inscription**

Run: `cd frontend && grep -rn 'href="/dashboard"' components/landing app/page.tsx`
Expected: aucun résultat (le CTA d'acquisition de la landing doit viser `/signup`, pas `/dashboard`). S'il y en a un, le remplacer par `href="/signup"`.

- [ ] **Step 3 : Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd .. && git add frontend/components/landing/taste/TasteTopbar.tsx
git commit -m "feat(landing): bouton « Terminal » renommé « Connexion »

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11 : Smoke Playwright du consentement + build final

**Files:**
- Create: `frontend/e2e/consent.spec.ts`

- [ ] **Step 1 : Vérifier l'emplacement des tests e2e**

Run: `cd frontend && cat playwright.config.ts 2>/dev/null | grep -i "testDir\|baseURL" ; ls e2e 2>/dev/null`
But si `playwright.config.ts` est absent, **sauter cette tâche** (noter dans le commit final) et passer au build. Sinon, utiliser le `testDir` indiqué (par défaut `e2e/`).

- [ ] **Step 2 : Écrire le smoke**

Create `frontend/e2e/consent.spec.ts` :

```ts
import { test, expect } from '@playwright/test';

test('le bandeau cookies apparaît puis persiste le choix', async ({ page }) => {
  await page.goto('/login');
  const banner = page.getByText('cookies strictement nécessaires');
  await expect(banner).toBeVisible();

  await page.getByRole('button', { name: 'Tout accepter' }).click();
  await expect(banner).toBeHidden();

  await page.reload();
  await expect(page.getByText('cookies strictement nécessaires')).toBeHidden();
});
```

- [ ] **Step 3 : Lancer le smoke (si Playwright configuré)**

Run: `cd frontend && npx playwright test e2e/consent.spec.ts`
Expected: 1 passed. (Si l'environnement n'a pas de navigateur, lancer `npx playwright install` d'abord.)

- [ ] **Step 4 : Build final + vitest complet**

```bash
cd frontend
npx vitest run lib/consent/state.test.ts
npx tsc --noEmit
npx next build
```
Expected: tests verts, build « Compiled successfully ».

- [ ] **Step 5 : Commit + push**

```bash
cd .. && git add frontend/e2e/consent.spec.ts
git commit -m "test(consent): smoke Playwright bandeau cookies (apparition + persistance)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Notes de finalisation

- Après merge, **remplacer tous les `<Placeholder>`** (raison sociale, RCCM, capital, siège, prix premium, prestataire de paiement, e-mail de contact, directeur de publication) par les valeurs réelles avant le lancement public. Tant qu'ils restent, ils sont visuellement marqués en jaune.
- Le registre `lib/consent/registry.ts` est prêt : pour brancher un analytics futur, ajouter ses cookies dans la catégorie `analytics` et conditionner le `<Script>` à `useConsent().has('analytics')`.
- Lot B (tableau de bord admin) fera l'objet d'une spec + plan séparés.
