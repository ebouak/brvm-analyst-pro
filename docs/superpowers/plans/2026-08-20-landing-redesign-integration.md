# Landing Redesign Production Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan runs on branch `landing-redesign-integration`, NEVER on `main` directly.

**Goal:** Merge the proven, reviewed content of `/landing-preview` (built and hardened across `docs/superpowers/plans/2026-08-19-landing-redesign-preview.md`) into the real production landing (`frontend/app/page.tsx`), then retire the now-redundant preview route — completing Phase 13 of the user's redesign mandate.

**Architecture:** `frontend/app/page.tsx` is edited in place (this is now explicitly authorized — we are on a dedicated branch, not `main`). Every new section (`HeroDeviceMockup`, `ToolsGrid`, `RatingSpotlight`, `DiagnosticSpotlight`, `PremiumCompare`) already exists as a reviewed component under `frontend/components/landing/` — this plan wires them into production `getData()`/`Landing()` rather than recreating anything. Two known, reviewer-flagged performance issues (sequential Supabase fetches, uncached `getSgiDirectory()`) are fixed here since this is the point where the page becomes real production traffic, not a low-stakes preview.

**Tech Stack:** Next.js 14 App Router (Server Components), Supabase, TypeScript, TailwindCSS — no new dependencies.

---

### Task 1 : Hero — remplacer `HeroSpotlight` par `HeroDeviceMockup`

**Files:**
- Modify: `frontend/app/page.tsx`
- Read only (for comparison): `frontend/components/landing/HeroSpotlight.tsx`, `frontend/components/landing/HeroDeviceMockup.tsx`

**Context:** `HeroDeviceMockup` (déjà construit et review Task 2 de la preview) prend `dateLabel`, `ticks`, `brvmC`, `topMover` — tous déjà calculés par `getData()` de production (`ticks` existe déjà ; `brvmC` et `topMover` sont à dériver de `indices`/`hausses`/`baisses`, déjà présents dans `getData()`). `HeroPulseCTA` (CTA actuel du Hero) n'est PAS repris par `HeroDeviceMockup` — son propre CTA (`/signup`, `/societes`) suffit ; `HeroPulseCTA` devient orphelin si plus rien d'autre ne l'utilise (à vérifier avant suppression, voir Étape 3).

- [ ] **Étape 1 : Remplacer l'import et l'usage dans `page.tsx`**

Remplacer `import { HeroPulseCTA } from '@/components/landing/HeroPulseCTA';` et `import { HeroSpotlight } from '@/components/landing/HeroSpotlight';` par `import { HeroDeviceMockup } from '@/components/landing/HeroDeviceMockup';`.

Remplacer le rendu `<HeroSpotlight dateLabel={dateLabel} ticks={ticks} />` par :
```tsx
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
```

- [ ] **Étape 2 : Vérifier que `hausses`/`baisses` ont bien `score`/`confiance` dans production**

`getData()` de production calcule déjà `hausses`/`baisses` en `MoverRow` avec `score`/`confiance` (voir la fonction `toRow` existante) — confirme que les types correspondent avant de committer, sinon adapte l'appel (jamais le composant).

- [ ] **Étape 3 : Vérifier si `HeroSpotlight.tsx` et `HeroPulseCTA.tsx` deviennent orphelins**

Lance `grep -rn "HeroSpotlight\|HeroPulseCTA" frontend/ --include=*.tsx --include=*.ts` en excluant leurs propres fichiers de définition. Si aucune autre référence n'existe après ce changement, NE LES SUPPRIME PAS dans cette tâche — laisse-les en l'état (code mort inoffensif) et signale-le dans ton rapport ; la suppression éventuelle est une décision de nettoyage à valider séparément par l'utilisateur, hors périmètre de cette tâche d'intégration.

- [ ] **Étape 4 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit` — attendu : aucune erreur.

- [ ] **Étape 5 : Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(landing): intègre le hero mockup d'interface en production (Phase 13 Task 1)"
```

---

### Task 2 : Restructurer "Marché en direct" en grille de 4 cartes

**Files:**
- Modify: `frontend/app/page.tsx`

**Context:** Remplace la disposition actuelle 2-colonnes (texte + carte "séance en direct") par la grille 4 cartes déjà construite et review sur `/landing-preview` (Top hausses / BRVM-C+stats / Top baisses / Indices BRVM). Réutilise `MoverLine` déjà défini dans `page.tsx` (ne pas dupliquer). Copie fidèlement la structure JSX de `frontend/app/landing-preview/page.tsx` (section équivalente), en l'adaptant aux noms de variables déjà présents dans `page.tsx` de production (`nbActions`, `volumeTotal`, `indices`, `hausses`, `baisses`, `heatmapRows`).

- [ ] **Étape 1 : Lire la section équivalente sur `/landing-preview`**

Lis `frontend/app/landing-preview/page.tsx`, section "Marché en direct" (la grille 4 cartes), pour copier fidèlement sa structure JSX et ses classes Tailwind.

- [ ] **Étape 2 : Remplacer le bloc 2-colonnes actuel de `page.tsx`**

Remplace le `<div className="mt-6 grid ... lg:grid-cols-[...]">` actuel (stats + carte "La séance, en direct") par la grille 4 cartes équivalente. Conserve le paragraphe d'intro texte ("Cours actualisés toutes les 15 minutes...") — ce texte n'a pas d'équivalent dans la grille 4 cartes de la preview, décide où le placer (au-dessus de la grille, en intro de section) pour ne perdre aucun contenu éditorial existant.

- [ ] **Étape 3 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit` — attendu : aucune erreur.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(landing): restructure Marché en direct en grille 4 cartes (Phase 13 Task 2)"
```

---

### Task 3 : Insérer ToolsGrid, RatingSpotlight, DiagnosticSpotlight, PremiumCompare

**Files:**
- Modify: `frontend/app/page.tsx`

**Context:** Ajoute les 4 nouveaux fetches à `getData()` (signal spotlight, diagnostic report, plans/features — copie fidèle des blocs déjà construits et review sur `/landing-preview`, voir `frontend/app/landing-preview/page.tsx` lignes correspondantes), et insère les 4 composants après la grille "Marché en direct"/heatmap et avant la section "3 étapes" existante.

**Décision explicite pour la section "3 cartes" existante (Analyse exclusive / Premium / Actualités)** : la nouvelle section `PremiumCompare` rend la carte "Premium" de ce bloc redondante (un comparatif complet 3 formules remplace avantageusement un simple lien vers `/pricing`). Retire la carte "Premium" de ce bloc de 3 cartes (elle devient un bloc de 2 cartes : "Analyse exclusive" + "Actualités du Marché") — ne duplique pas le même message deux fois sur la même page, conformément à la consigne "éviter les duplications" du mandat. Les cartes "Analyse exclusive" et "Actualités du Marché" restent inchangées (contenu distinct, pas redondant avec les nouvelles sections).

- [ ] **Étape 1 : Porter les 3 fetches manquants dans `getData()`**

Copie fidèlement depuis `frontend/app/landing-preview/page.tsx` : le fetch `signals_daily` pour `spotlightSignal` (à l'intérieur du bloc `if (asOf)`, après le calcul des movers), le fetch `diagnostic_reports` pour `latestDiagnosticReport`, et les fetches `subscription_plans`/`plan_features` pour `plans`. Ajoute ces 3 valeurs à l'objet retourné par `getData()`.

- [ ] **Étape 2 : Ajouter les imports et insérer les composants**

```tsx
import { ToolsGrid } from '@/components/landing/ToolsGrid';
import { RatingSpotlight } from '@/components/landing/RatingSpotlight';
import { DiagnosticSpotlight } from '@/components/landing/DiagnosticSpotlight';
import { PremiumCompare } from '@/components/landing/PremiumCompare';
```

Insère `<ToolsGrid />`, `<RatingSpotlight signal={spotlightSignal} />`, `<DiagnosticSpotlight report={latestDiagnosticReport} />` juste après la section heatmap et avant la section "3 étapes" existante. Insère `<PremiumCompare plans={plans} />` à la place de l'ancienne carte "Premium" retirée du bloc de 3 cartes (voir décision ci-dessus) — donc après le bloc 2-cartes restant (Analyse exclusive / Actualités), à peu près à l'endroit où vivait l'ancienne grille de 3 cartes.

- [ ] **Étape 3 : Retirer la carte "Premium" du bloc de 3 cartes**

Repère le bloc `<section className="mt-10 grid ... md:grid-cols-3">` contenant les 3 `<article>` (Analyse exclusive / Premium / Actualités). Retire l'`<article>` "Premium" et son contenu. Ajuste la classe de grille (`md:grid-cols-3` → `md:grid-cols-2`) pour les 2 cartes restantes.

- [ ] **Étape 4 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit` — attendu : aucune erreur.

- [ ] **Étape 5 : Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(landing): intègre outils, note A-F, diagnostic IA et comparatif premium (Phase 13 Task 3)"
```

---

### Task 4 : Corriger `ProofBand` (données réelles au lieu de constantes en dur)

**Files:**
- Modify: `frontend/components/landing/ProofBand.tsx`
- Modify: `frontend/app/page.tsx` (passer les vraies props)

**Context:** Risque documenté depuis l'audit (`docs/LANDING_REDESIGN_AUDIT.md` §8.5, §9) : `ProofBand` prétend afficher des "métriques vraies et vérifiables" mais 2 de ses 4 chiffres sont codés en dur (`'48'`, `'100%'`) sans requête Supabase. `page.tsx` calcule déjà `nbActions` — à transmettre en prop plutôt que dupliquer `'48'` une troisième fois sur la même page (déjà dupliqué dans `AppPreview` et dans le repli du bloc "Marché en direct").

- [ ] **Étape 1 : Lire `ProofBand.tsx` actuel**

Identifie précisément quelles props existent déjà (s'il y en a) et quelles valeurs sont codées en dur.

- [ ] **Étape 2 : Ajouter une prop `nbActions` (ou équivalent) à `ProofBand`**

Modifie la signature du composant pour accepter `nbActions: number` (et tout autre chiffre réellement calculable côté `page.tsx` parmi les 4 métriques affichées — n'invente pas de nouvelle requête pour les métriques qui n'ont vraiment pas d'équivalent réel, par exemple si une des 4 métriques est structurellement une constante éditoriale légitime comme "A–F" ou "Sources", laisse-la telle quelle). Utilise cette prop à la place de la constante en dur correspondante.

- [ ] **Étape 3 : Passer la prop depuis `page.tsx`**

`<ProofBand nbActions={nbActions} />` (ou signature équivalente selon ce que Étape 2 a produit).

- [ ] **Étape 4 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit` — attendu : aucune erreur.

- [ ] **Étape 5 : Commit**

```bash
git add frontend/components/landing/ProofBand.tsx frontend/app/page.tsx
git commit -m "fix(landing): ProofBand utilise les vraies métriques déjà calculées (Phase 13 Task 4)"
```

---

### Task 5 : Optimiser les requêtes — parallélisation + cache `getSgiDirectory()`

**Files:**
- Modify: `frontend/app/page.tsx`

**Context:** Deux dettes de performance signalées par les reviewers pendant la construction de la preview (non bloquantes en preview privée, à corriger maintenant que la page devient production réelle) : (1) plusieurs fetches indépendants dans `getData()` s'enchaînent en série alors qu'ils pourraient rejoindre un `Promise.all` ; (2) `getSgiDirectory()` est appelé hors cache à chaque rendu.

- [ ] **Étape 1 : Identifier les fetches réellement indépendants**

Dans `getData()` (après intégration des Tasks 1-4), liste les requêtes qui ne dépendent d'aucune valeur calculée par une requête précédente (typiquement : `brief`, la paire `[snts, divs]` du simulateur, `news`, `spotlightSignal` une fois `asOf` connu, `diagnostic_reports`, `subscription_plans`+`plan_features`). Regroupe-les dans un seul `Promise.all` supplémentaire plutôt que des `await` séquentiels, en conservant la dépendance réelle sur `asOf` (les requêtes qui en ont besoin restent après sa résolution, mais entre elles en parallèle).

- [ ] **Étape 2 : Envelopper `getSgiDirectory()` dans le cache existant**

Option la plus simple sans changer la signature de `getSgiDirectory()` : l'appeler DANS `getData()` (donc DANS `unstable_cache`) plutôt que séparément dans le composant `Landing()`. Vérifie que `getSgiDirectory()` n'utilise que le client public (aucun cookie, aucune donnée utilisateur) avant de le déplacer dans le cache partagé — sinon (si elle dépendait d'une session), NE LA DÉPLACE PAS et signale le blocage plutôt que de risquer une fuite de cache entre visiteurs (règle déjà documentée dans `page.tsx` : "Sûr : getData n'utilise que le client public").

- [ ] **Étape 3 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit` — attendu : aucune erreur.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/app/page.tsx
git commit -m "perf(landing): parallélise les requêtes indépendantes et cache getSgiDirectory (Phase 13 Task 5)"
```

---

### Task 6 : Retirer la route `/landing-preview` (nettoyage post-intégration)

**Files:**
- Delete: `frontend/app/landing-preview/page.tsx`
- Modify: `frontend/lib/supabase/middleware.ts` (retirer l'entrée `/landing-preview` de `PUBLIC_EXACT`)
- Modify: `frontend/components/ConditionalShell.tsx` (retirer l'entrée `/landing-preview` de `BARE_ROUTES`)

**Context:** Une fois son contenu intégré en production, la route de preview devient un doublon exact — la conserver violerait la consigne "éviter les duplications" du mandat. Les composants `HeroDeviceMockup`/`ToolsGrid`/`RatingSpotlight`/`DiagnosticSpotlight`/`PremiumCompare` restent (utilisés par production), seule la route de preview et son fichier `page.tsx` dédié disparaissent. `frontend/lib/landing/excerpt.ts`/`.test.mjs` restent (utilisé par `DiagnosticSpotlight`, toujours en production).

- [ ] **Étape 1 : Supprimer le fichier de route**

```bash
git rm frontend/app/landing-preview/page.tsx
```

- [ ] **Étape 2 : Retirer les entrées des deux registres**

Dans `frontend/lib/supabase/middleware.ts` : retire la ligne `'/landing-preview', // aperçu de refonte, non indexé (noindex) — Phase 10` de `PUBLIC_EXACT`.
Dans `frontend/components/ConditionalShell.tsx` : retire `'/landing-preview'` de `BARE_ROUTES` (et son commentaire explicatif devenu obsolète).

- [ ] **Étape 3 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit` — attendu : aucune erreur.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/lib/supabase/middleware.ts frontend/components/ConditionalShell.tsx
git commit -m "chore(landing): retire la route /landing-preview, intégrée en production (Phase 13 Task 6)"
```

---

### Task 7 : Suite de tests complète + checklist Phase 13

**Files:** aucun fichier modifié — vérification uniquement.

- [ ] **Étape 1 : Typecheck complet**

`cd frontend && npx tsc --noEmit` — aucune erreur.

- [ ] **Étape 2 : Suite de tests frontend existante**

`cd frontend && npx tsx --test lib/landing/excerpt.test.mjs` (et tout autre `.test.mjs` pertinent touché par cette intégration) — tous verts.

- [ ] **Étape 3 : Suite de tests scraper (non-régression)**

`cd scraper && npm test` — confirme qu'aucun test scraper n'est cassé (cette intégration ne touche que `frontend/`, donc régression improbable, mais à vérifier par discipline).

- [ ] **Étape 4 : Vérification manuelle par section (checklist Phase 13 du mandat)**

Lance `cd frontend && npm run dev`, visite `/` :
- Chaque section rend sans erreur (hero, marché en direct, heatmap, outils, note A-F, diagnostic IA, simulateur, SGI, communauté, premium, brief, 2 cartes restantes, FAQ, newsletter, CTA final, footer).
- Thème clair ET sombre (toggle `TasteTopbar`) — aucune section cassée dans les deux modes.
- Responsive : redimensionne à largeur mobile (< 768px) — pas de débordement horizontal, CTA accessibles.
- Navigation : chaque lien de `ToolsGrid` (16 liens) résout vers une vraie page.
- CTA : `/signup`, `/pricing`, `/comparateur-sgi`, `/simulateur`, `/brief` tous fonctionnels.
- Données dynamiques : `nbActions`/`volumeTotal`/`sgiCount` affichent de vraies valeurs (pas de placeholder figé).
- Footer : présent, disclaimer visible, liens fonctionnels (hormis le bug préexistant `SocialLinks.tsx` déjà documenté, hors scope).

- [ ] **Étape 5 : SEO**

Confirme que `export const metadata` de `page.tsx` n'a pas été modifié par erreur, que le JSON-LD `FAQPage` de `layout.tsx` reste cohérent avec `LandingFaq` (non touché par cette intégration), et que `sitemap.ts`/`robots.ts` n'ont pas besoin de changement (la route `/landing-preview` retirée en Task 6 n'y était de toute façon jamais listée puisqu'elle était `noindex`).

- [ ] **Étape 6 : Rapport final**

Rédige un résumé (dans ta réponse, pas un fichier) : ce qui a été intégré, tout écart par rapport au plan, résultat de chaque étape de checklist ci-dessus, et statut final (prêt pour revue humaine avant merge/déploiement — ne merge PAS la branche, ne déploie PAS).

---

## Auto-révision (discipline writing-plans)

- **Couverture** : les 16 sections déjà prouvées sur `/landing-preview` sont toutes portées (Tasks 1-3). `ProofBand` (section 04, non portée dans la preview) est corrigée séparément (Task 4) puisqu'elle existe déjà en production et n'avait besoin que d'un branchement de données, pas d'une reconstruction. Le CTA final (section 17) n'a besoin d'aucun changement (texte déjà identique au mandat, confirmé dans l'audit).
- **Dette de performance** : traitée explicitement (Task 5) plutôt que reportée indéfiniment, puisque c'est le moment où la page devient du vrai trafic public.
- **Pas de duplication finale** : Task 6 retire le doublon `/landing-preview` une fois son contenu absorbé par production.
- **Aucune tâche ne touche `frontend/app/layout.tsx`, `frontend/app/sitemap.ts`, `frontend/app/robots.ts`, ni aucune migration SQL** — hors périmètre de cette intégration.
