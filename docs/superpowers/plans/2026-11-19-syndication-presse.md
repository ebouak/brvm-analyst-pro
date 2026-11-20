# Syndication Presse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan inline. Steps use checkbox syntax for tracking.

**Goal:** Publier les articles WESTBOURSE dans un flux RSS et un Google News
sitemap publics, automatiques et sûrs.

**Architecture:** Un module serveur charge les articles publics et ajoute
l'analyse Coris comme entrée éditoriale statique. Deux route handlers rendent
des documents XML sans HTML ; des helpers purs assurent filtrage, tri, dates,
échappement et tests. Le middleware et `robots.txt` exposent les deux routes.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase anon, Vitest.

## Global Constraints

- Aucune clé `service_role`.
- News sitemap limité aux 48 dernières heures et à 1 000 entrées.
- Langue `fr`, publication `WESTBOURSE`.
- Aucun article brouillon ; RLS + filtre public uniquement.
- Routes sans paramètre.
- Les erreurs de lecture Supabase ne deviennent pas un faux contenu vide.

---

### Task 1: Build pure feed helpers

**Files:**
- Create: `frontend/lib/syndication/types.ts`
- Create: `frontend/lib/syndication/articles.ts`
- Create: `frontend/lib/syndication/xml.ts`
- Test: `frontend/lib/syndication/articles.test.ts`

**Interfaces:**
- Produces: `SyndicationArticle`, `CORIS_ARTICLE`, `loadSyndicationArticles`,
  `newsArticlesSince`, `escapeXml`, `toRfc822`.

- [ ] **Step 1: Write failing tests**

Add tests for XML escaping, RFC-822 dates, 48-hour filtering, and stable ordering.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --run lib/syndication/articles.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement helpers**

Create a narrow immutable `SyndicationArticle` type, a static Coris entry, an
anon-Supabase loader, and pure XML/date/filter helpers. Throw on Supabase errors.

- [ ] **Step 4: Verify tests**

Run: `npm test -- --run lib/syndication/articles.test.ts`

Expected: all focused tests pass.

### Task 2: Expose RSS endpoint

**Files:**
- Create: `frontend/app/rss.xml/route.ts`
- Test: `frontend/lib/syndication/rss.test.ts`

**Interfaces:**
- Consumes: `SyndicationArticle`, `escapeXml`, `toRfc822`,
  `loadSyndicationArticles`.
- Produces: `buildRssXml`, GET route returning RSS 2.0 XML.

- [ ] **Step 1: Write failing RSS tests**

Test channel metadata, permanent links, enclosure image, XML escaping, and
empty-feed validity.

- [ ] **Step 2: Run RSS tests to verify failure**

Run: `npm test -- --run lib/syndication/rss.test.ts`

- [ ] **Step 3: Implement renderer and route**

Put the renderer in a pure module, then call it from the GET route. Return
`application/rss+xml; charset=utf-8` and 5-minute public caching.

- [ ] **Step 4: Verify RSS tests**

Run: `npm test -- --run lib/syndication/rss.test.ts`

### Task 3: Expose Google News sitemap

**Files:**
- Create: `frontend/app/news-sitemap.xml/route.ts`
- Test: `frontend/lib/syndication/newsSitemap.test.ts`

**Interfaces:**
- Consumes: `SyndicationArticle`, `newsArticlesSince`, `escapeXml`,
  `loadSyndicationArticles`.
- Produces: `buildNewsSitemapXml`, GET route returning Google News XML.

- [ ] **Step 1: Write failing sitemap tests**

Test namespace, 48-hour cutoff, Coris inclusion, title escaping, language and
publication name.

- [ ] **Step 2: Run sitemap tests to verify failure**

Run: `npm test -- --run lib/syndication/newsSitemap.test.ts`

- [ ] **Step 3: Implement renderer and route**

Render only recent items, max 1 000, with ISO publication dates. Return
`application/xml; charset=utf-8` and 5-minute public caching.

- [ ] **Step 4: Verify sitemap tests**

Run: `npm test -- --run lib/syndication/newsSitemap.test.ts`

### Task 4: Open and announce endpoints

**Files:**
- Modify: `frontend/lib/auth/cheminsPublics.ts`
- Modify: `frontend/app/robots.ts`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/page.tsx`
- Test: existing public-path tests plus new assertions.

- [ ] **Step 1: Add failing public-path assertions**

Assert `/rss.xml` and `/news-sitemap.xml` are public, while `/rss.xml/private`
is not.

- [ ] **Step 2: Run public-path test**

Run the exact existing Vitest command for `cheminsPublics`.

- [ ] **Step 3: Update public paths and robots**

Add both exact paths, declare the news sitemap in `robots.ts`, and expose RSS
through the root and homepage metadata's feed auto-discovery.

- [ ] **Step 4: Verify public-path behavior**

Run the same focused test and inspect `robots` output.

### Task 5: Verify and deploy

**Files:**
- Modify only as needed by validation failures.

- [ ] **Step 1: Run all focused syndication tests**

Run: `npm test -- --run lib/syndication`

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Build**

Run: `npm run build`

- [ ] **Step 4: Commit signed if a local signing key is available**

Do not skip signing. If unavailable, stop at verified uncommitted work and
report the exact blocker.

- [ ] **Step 5: Deploy through the repository's production workflow**

Open a PR, merge only after checks pass, then verify `/rss.xml`,
`/news-sitemap.xml`, the Coris URL and `robots.txt` return `200`.

### Task 6: Register external syndication

**Files:**
- No code files.

- [ ] **Step 1: Submit Google Search Console sitemaps**

Using the authenticated browser, add `/sitemap.xml` and `/news-sitemap.xml`.
Record acceptance or the required account action.

- [ ] **Step 2: Submit Flipboard feed**

Create/upgrade the publisher account and submit `/rss.xml`; record review
status.

- [ ] **Step 3: Request MSN Partner Hub onboarding**

Submit the WESTBOURSE site and RSS URL, then record the application status.

- [ ] **Step 4: Verify submissions**

Capture each platform's explicit confirmation. Do not claim approval when a
submission only entered review.
