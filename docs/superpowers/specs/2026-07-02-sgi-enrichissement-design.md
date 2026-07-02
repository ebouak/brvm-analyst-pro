# Enrichissement SGI — migration Supabase, scraper RichBourse, import PDF tarifs

**Date :** 2026-07-02
**Statut :** approuvé (« go dev »)

## 1. Contexte & objectif

La section SGI de WESTBOURSE (`/comparateur-sgi`) comprend un annuaire (35 SGI)
et un calculateur de coût réel. Les données vivent **en dur** dans des fichiers
TypeScript (`frontend/lib/sgi-frais/directory.ts`, `seed-data.ts`). Objectif :
pouvoir enrichir ces données **sans redéploiement de code**, en réutilisant
l'infrastructure existante plutôt qu'en la réinventant.

Trois briques, à construire dans cet ordre (la 1 est le socle des 2 autres).

## 2. Inventaire de l'existant (réutilisé, pas réinventé)

- **`supabase/migrations/0062_sgi_frais.sql`** — table `sgi_frais` déjà définie
  (mêmes champs que le type `SgiFrais`), RLS public read, écriture service_role.
  Manque : la colonne `droits_garde_minimum` (ajoutée au type le 2026-07-02) et
  toute table d'annuaire. **Non lue par le frontend aujourd'hui.**
- **Playwright déjà dépendance du scraper** (`scraper/package.json`), utilisé
  dans `src/publications/runPublicationsBrowser.ts` et `src/notations/runNotations.ts`
  (pattern `chromium` → `Page` → `getSupabase()` → upsert). Ce n'est PAS une
  nouvelle dépendance lourde.
- **`scraper/src/scrapers/richbourse-details.ts`** — scraper RichBourse existant
  (axios, path `/common/mouvements/`, pour les cours) — modèle de parsing, mais
  la liste SGI est sur un autre path protégé par anti-bot → voie Playwright.
- **Pipeline `frontend/lib/import/`** — extraction PDF par cascade LLM
  (`llmProviders.ts` : DeepSeek→Mistral→Grok texte, Mistral/Grok vision),
  `pdfClient.ts` (pdf.js → texte natif ou images de pages côté navigateur),
  `ocr.ts` (repli Mistral OCR), guardrails (`fullGuardrails.ts`), page admin
  `app/admin/import-fondamentaux/` + route `app/api/import-batch/`, composant
  `components/import/PdfDropzone.tsx`. **Réutilisé tel quel** pour les tarifs SGI,
  avec un prompt + un schéma + des guardrails spécifiques au domaine tarifaire.

## 3. Brique 1 — Migration Supabase + bascule des lectures

### 3.1 Migration `0063_sgi_directory_and_frais_extend.sql`
- `alter table public.sgi_frais add column if not exists droits_garde_minimum numeric(12,2);`
  (colonne du plancher de garde ; la table peut déjà être appliquée en prod).
- Nouvelle table `public.sgi_directory` :
  `nom text unique not null`, `pays text` (code ISO2 UEMOA), `type text check in
  ('Banque','Indépendante','Non déterminé')`, `groupe text`, `logo text`,
  `depot_min text`, `depot_min_source text check in ('indicatif','relevé','inconnu')`,
  `site_web text`, `fiche_brvm text`, `telephone text`, `email text`,
  `source text` (ex. 'manuel','richbourse'), `verifie_le date`,
  `updated_at timestamptz default now()`. RLS : public SELECT `using (true)` ;
  écriture service_role uniquement (pas de policy insert/update pour anon).
- **Application** : le fichier SQL est écrit ; l'utilisateur l'applique via
  l'éditeur SQL Supabase (Claude ne peut pas appliquer les migrations DDL).

### 3.2 Seed initial
- Script one-off `scraper/src/sgi/seedSgiFromCode.ts` (commande `seed-sgi`) qui
  **lit les tableaux TS actuels** (`SGI_DIRECTORY`, `SGI_FRAIS_SEED`) et upsert
  dans les deux tables (idempotent, conflit sur `nom`/`sgi_nom`). Aucune donnée
  inventée : reprise exacte de ce qui est en code aujourd'hui.

### 3.3 Bascule des lectures frontend
- `frontend/lib/sgi-frais/queries.ts` (nouveau) : `getSgiDirectory()` et
  `getSgiFrais()` via `createPublicClient()` (clé anon, comme les autres lectures
  publiques). Fallback sur les tableaux TS si la table est vide (jamais d'écran
  vide — règle produit).
- `SgiComparator.tsx` (annuaire) et `CalculateurCout.tsx` (calculateur) passent
  server-side : la page `/comparateur-sgi` charge les données en RSC et les
  passe en props aux composants clients. Les fichiers TS restent comme fallback
  et source du seed.

## 4. Brique 2 — Scraper RichBourse (Playwright)

- `scraper/src/scrapers/sgiRichbourse.ts` : fonctions pures de parsing
  (`parseSgiListRows`, `parseSgiContactFiche`) testables sur fixtures HTML, +
  navigation Playwright (`chromium.launch`, real browser → passe l'anti-bot JS).
  Collecte : nom, pays, téléphone, email, site web, dépôt minimum, lien fiche.
- `scraper/src/sgi/runSgiRichbourse.ts` : orchestration I/O — parcourt les 9
  pages liste + chaque fiche détail, upsert `sgi_directory` (conflit `nom`,
  `source='richbourse'`). **N'écrit jamais dans `sgi_frais`.**
- **Best-effort PDF tarifs** : tente le clic « Consulter les tarifs » et
  sauvegarde le PDF/onglet obtenu dans `scraper/output/sgi-tarifs/{slug}.pdf`
  (jamais auto-persisté ; le rapport utilisateur signale une interstitielle pub
  → si l'automatisation échoue, log d'avertissement, on continue). Ces PDF
  serviront à la brique 3 (dépôt manuel dans l'admin).
- Commande CLI `scrape-sgi` (nouveau `case` dans `src/index.ts`), **manuelle**
  (pas de cron — la liste change rarement, site anti-bot). Instrumentée
  monitoring comme les autres commandes (`withMonitoring`).

## 5. Brique 3 — Import PDF tarifs (réutilise `lib/import/`)

- **Réutilisés tels quels** : `pdfClient.readPdf()` (texte/vision), la cascade
  `llmProviders` + `parseLlmJson`, `ocr.ts`, le composant `PdfDropzone`.
- **Nouveaux (spécifiques tarifs SGI)** :
  - `frontend/lib/import/sgiTarifPrompt.ts` : prompt système « extraire le barème
    SGI » (courtage %, minimum de perception, droits de garde % + fréquence +
    plancher, tenue de compte, virement, gestion sous mandat, dépôt minimum) →
    JSON au schéma `SgiFrais`.
  - `frontend/lib/import/sgiTarifValidate.ts` + `sgiTarifGuardrails.ts` : bornes
    de plausibilité (courtage 0–3 %, garde 0–1 %/période, plancher ≥ 0, montants
    positifs). Hors bornes → statut « à valider » (jamais d'écriture auto).
  - `frontend/lib/import/sgiTarifPersist.ts` : upsert `sgi_frais` avec
    `confiance='homologue_crepmf'`, `source_label` = référence de la décision,
    `verifie_le` = date d'import. Champs absents laissés `null` (jamais 0
    silencieux).
  - Route `frontend/app/api/import-sgi-tarifs/route.ts` (mode text|vision, clés
    LLM lues via `resolveApiKey`, jamais exposées).
  - Page `frontend/app/admin/import-sgi-tarifs/page.tsx` : dépôt PDF, choix de la
    SGI cible (liste `sgi_directory`), aperçu de l'extraction, badge de confiance,
    bouton d'import après revue humaine. Réservée admin (RBAC `content.write`).

## 6. Honnêteté des données (invariant)

- Jamais de valeur inventée : champ inconnu = `null` / « Non renseigné » / badge.
- Le badge de confiance à 3 niveaux (`homologue_crepmf > agrege_public >
  saisie_utilisateur`) est porté partout, jamais un chiffre sans son niveau.
- Le scraper tague `source='richbourse'` (annuaire) ; l'import PDF tague
  `homologue_crepmf` seulement quand le barème vient d'une décision officielle
  lue. Pas de « type/dépôt » deviné à partir du nom.
- Croisement obligatoire des nouvelles SGI avec le registre officiel
  `brvm.org/fr/intervenants/sgi/tous` avant ajout (fait manuellement pour les 13
  ajoutées le 2026-07-02 ; le scraper marquera les non-confirmées).

## 7. Tests

- `sgiRichbourse.ts` : tests vitest des parseurs purs sur fixtures HTML.
- `sgiTarifValidate/guardrails` : tests vitest des bornes (mêmes conventions que
  `fullGuardrails.test.mjs`).
- `calculateur.ts` : déjà couvert (18 tests, dont le plancher de garde).
- Après chaque brique : `tsc --noEmit` + `npm run build` (frontend), vitest
  (scraper + lib/sgi-frais), vérif de l'état vide des pages.

## 8. RGPD

- `sgi_directory.telephone` / `email` = coordonnées **professionnelles publiques**
  d'établissements agréés (pas des personnes physiques) — donnée d'annuaire, base
  légale intérêt légitime, publiée sur sources publiques. Pas de donnée perso
  utilisateur ajoutée. RLS public read (annuaire public), écriture service_role.

## 9. Séquencement d'implémentation

1. Migration `0063` (SQL) + seed script + bascule lectures frontend (socle).
2. Scraper RichBourse (indépendant après 1).
3. Import PDF tarifs (indépendant après 1).

Chaque brique : commit + push après build/tests verts.
