# Articles de presse — lot 1 (dividendes, opérations sur titres, séances hors norme)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Détecter chaque jour en base les faits BRVM du lot 1, en faire des articles chiffrés vérifiés, illustrés par une image tirée de la donnée, publiés sur `/actualites/[slug]` et diffusés sur la Chaîne WhatsApp et le canal Telegram.

**Architecture:** Un module scraper `src/articles/` fait de fonctions pures (détecteurs → rédaction → verrous → plan de diffusion) et d'un runner qui lit la base, écrit `articles` (migration 0167) et diffuse. Le frontend lit `articles` (RLS : publiés seulement), rend la page, l'image Edge (`next/og`) et l'admin de validation.

**Tech Stack:** TypeScript ESM + vitest (scraper), Next.js 14 App Router + next/og Edge (frontend), Supabase PostgREST, WAHA, Telegram Bot API, GitHub Actions.

Spec : `docs/superpowers/specs/2026-10-28-articles-presse-design.md`.

Le code complet de chaque tâche est celui des fichiers créés sur la branche
`feat/articles-presse` ; ce plan en fixe l'ordre, les interfaces et les
vérifications.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0167_articles.sql` | table `articles`, RLS (lecture des publiés) |
| `scraper/src/articles/types.ts` | `TypeArticle`, `Fait`, `Contexte`, lignes lues, `cleFait` |
| `scraper/src/articles/calendrier.ts` | `estOuvre`, `ajouterJoursOuvres`, `joursOuvresEntre`, `ecartJours` |
| `scraper/src/articles/detecteurs.ts` | `detecter(ctx, dividendes, operations): Fait[]` |
| `scraper/src/articles/redaction.ts` | `rediger(fait, noms): Brouillon`, `assembler(sections, sources)`, `AVERTISSEMENT` |
| `scraper/src/articles/verrous.ts` | `verifier(article, fait, ctx): {ok, manquants}` |
| `scraper/src/articles/diffusion.ts` | `planDiffusion`, `legende`, `legendeGroupe`, `PLAFOND_POSTS_JOUR` |
| `scraper/src/articles/runArticles.ts` | I/O : lecture paginée, écriture idempotente, diffusion |
| `scraper/src/index.ts`, `scraper/package.json` | commande `articles` (+ `:mock`) |
| `scraper/tests/articles.test.ts` | tests des modules purs |
| `.github/workflows/articles.yml` | cron 17:00 UTC lun-ven |
| `frontend/lib/articles/types.ts` | `Article`, `LIBELLE_TYPE`, `COLONNES_ARTICLE` |
| `frontend/lib/articles/image.tsx` | `imageArticle(article, format, logo)` |
| `frontend/app/api/articles/[slug]/image/route.tsx` | route Edge de l'image |
| `frontend/app/actualites/[slug]/page.tsx` | page article + JSON-LD `NewsArticle` |
| `frontend/app/actualites/page.tsx` | section « Nos articles » |
| `frontend/lib/supabase/middleware.ts` | préfixe public `/actualites` |
| `frontend/app/sitemap.ts` | articles publiés |
| `frontend/app/admin/articles/page.tsx` | file de validation |
| `frontend/app/api/admin/articles/[id]/route.ts` | changement de statut (`content.publish`) |
| `frontend/components/admin/ArticleStatutBoutons.tsx` | Publier / Rejeter / Dépublier |
| `frontend/lib/admin-nav.ts` | entrée de menu |

---

### Task 1: Migration `articles`
- [ ] Écrire `0167_articles.sql` : colonnes de la spec, `fait` unique, `slug` unique, `statut` contraint, index partiel sur `publie_le` des publiés, RLS `select using (statut = 'publie')`, `revoke insert, update, delete … from anon, authenticated`.
- [ ] Commit.

### Task 2: Types et jours ouvrés
- [ ] Test : `joursOuvresEntre('2026-10-23','2026-10-26') = 1`, `('2026-10-26','2026-10-29') = 3`, inverse = 0 ; `ajouterJoursOuvres('2026-10-23',1) = '2026-10-26'` ; `ecartJours('2026-10-26','2026-10-28') = 2`.
- [ ] Le voir échouer, écrire `types.ts` et `calendrier.ts`, le voir passer, commit.

### Task 3: Détecteurs
- [ ] Tests (fixtures réelles) : dividende SNTS 2025 inscrit la veille → `dividende_annonce`, rendement 3,93 % à 4 425 F ; dividende ancien ou source `sikafinance` → rien ; SDSC ex 26/10 lu le 23/10 → `detachement_rappel`, lu le 26/10 → `paiement_rappel` ; fractionnement SNTS → `operation_titres` ; séances : CIEC/BOAM retenues, SDSC écartée (volume < 2×), au plus 2, `ratio_volume` 9 ; détachement juxtaposé (`dividende_detache` 92).
- [ ] Échec, implémentation, succès, commit.

### Task 4: Rédaction
- [ ] Tests : pour chacun des 5 types, `assertNoForeignNumber(texte, chiffres)` vrai, slug `[a-z0-9-]+`, au moins une source ; titre exact du dividende SNTS ; chapô avec « 3,93 % » et « 3 novembre 2026 » ; juxtaposition du détachement sans « à cause / en raison / suite à ».
- [ ] Tout nombre écrit passe par `Plume` (`n`, `pct`, `date`, `nom`) qui l'inscrit dans la liste blanche.
- [ ] Échec, implémentation, succès, commit.

### Task 5: Verrous
- [ ] Tests : article conforme → ok ; séance du 20/10 lue le 28/10 → `fraicheur` ; variation −89,28 → `plausible` ; « 9999 F » ajouté → `chiffres_verifies` ; sans source ni avertissement → `source_citee`, `avertissement`.
- [ ] Échec, implémentation (réutilise `SEUIL_VARIATION_ABERRANTE` et `assertNoForeignNumber`), succès, commit.

### Task 6: Plan de diffusion
- [ ] Tests : 2 articles, 0 post → 2 individuels ; 4 articles → 2 individuels + 1 groupe ; plafond atteint → ignorés ; légendes avec `/actualites/<slug>` et « Les faits du jour ».
- [ ] Échec, implémentation, succès, commit.

### Task 7: Runner + CLI
- [ ] `runArticles` : dernière séance, cours de la séance, 60 jours d'historique **paginés**, dividendes récents ou à venir, opérations ±6 jours, désignations ; `detecter` ; écarter les faits déjà en base ; `rediger` → `polishNarrative` (repli squelette) → `assembler` → `verifier` ; série 1 an pour l'image ; statut `publie` / `a_valider` / `brouillon` + raison ; `upsert(onConflict: 'fait', ignoreDuplicates)` ; `DRY_RUN` n'écrit ni ne diffuse.
- [ ] Diffusion : articles publiés du jour sans `diffuse`, plan plafonné, image carrée lue sur la route publique, WhatsApp (`envoyerImageWaha` / `envoyerTexteWaha`) + Telegram (`sendPhoto` / `sendMessage`, seule la `description` est relayée) ; `diffuse = {jour, mode, whatsapp, telegram}`.
- [ ] `case 'articles'` dans `index.ts` via `monitored`, scripts npm `articles` / `articles:mock`.
- [ ] `npm run typecheck && npm test`, commit.

### Task 8: Workflow
- [ ] `articles.yml` : cron `0 17 * * 1-5` + `workflow_dispatch`, secrets Supabase, Telegram, WAHA ; variables `TELEGRAM_CANAL`, `WHATSAPP_CHAINE_ID`. Commit.

### Task 9: Frontend — type et image Edge
- [ ] `types.ts`, `image.tsx` (logo PNG/JPEG sinon initiales, chiffre clé, légende, courbe 1 an, source), route Edge 404 si non publié. Typecheck, commit.

### Task 10: Pages publiques
- [ ] `/actualites/[slug]` (ISR 300 s, `notFound()`, métadonnées OG/Twitter, JSON-LD `NewsArticle`, sources), section « Nos articles » sur `/actualites`, préfixe public `/actualites`, sitemap. **Aucun `loading.tsx`** ajouté. Typecheck, commit.

### Task 11: Administration
- [ ] Route `PATCH` (`content.publish`, statuts `publie` / `rejete` / `brouillon`), boutons, page triée (à valider → brouillons → publiés → rejetés) avec raison de blocage, entrée de menu. Typecheck, commit.

### Task 12: Vérification et mise en service
- [ ] Tests et typecheck verts, PR, CI verte.
- [ ] Après fusion : appliquer 0167, vérifier à la clé anon (`[]`), essai `DRY_RUN=true` en local, puis `workflow_dispatch` réel.
- [ ] Vérifier une page publiée et son image, et qu'un slug inconnu rend **404** (statut).
- [ ] Section CLAUDE.md §8.
