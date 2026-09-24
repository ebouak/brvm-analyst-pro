# CLAUDE.md — BRVM Analyst Pro

Guide destiné à Claude Code pour travailler efficacement sur ce dépôt.
À lire en premier. Voir aussi `HANDOFF.md` pour la reprise et `docs/` pour le détail.

## 1. Résumé produit

Plateforme web d'analyse et d'aide à la décision d'investissement sur la
**BRVM** (Bourse Régionale des Valeurs Mobilières, UEMOA). Couvre actions,
obligations, indices, signaux d'opportunité, watchlist/portefeuille, et un
module de rapports & événements. Trois usages : suivi quotidien du marché,
analyse technique/comparative, génération de signaux assistés.

Deux applications distinctes et **découplées** :
- **scraper/** : worker Node.js (TypeScript) qui collecte les données depuis le
  portail BDFIN BRVM (ASP.NET WebForms), calcule les signaux, ingère événements
  et dividendes, évalue les alertes — et écrit dans Supabase.
- **frontend/** : application Next.js 14 (App Router) qui lit **uniquement**
  Supabase (jamais le site BRVM directement).

## 2. Stack technique

| Couche | Techno |
|---|---|
| Scraper | Node ≥ 20, TypeScript (ESM), axios + tough-cookie (cookie jar), cheerio, zod, pino, @supabase/supabase-js |
| Base | Supabase PostgreSQL + Auth + RLS |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, @supabase/ssr, Recharts |
| Tests | vitest (scraper) |

## 3. Structure des dossiers

```
brvm-analyst-pro/
├── CLAUDE.md, HANDOFF.md, README.md
├── docs/                       SCRAPER, SCORING, REPORTS, DEPLOYMENT, RECOVERY
├── supabase/migrations/        0001_init → 0006_dividends (SQL ordonné)
├── scraper/
│   ├── src/
│   │   ├── index.ts            CLI : daily | date | score | events | dividends | alerts
│   │   ├── config.ts           config zod (env), assertions de secrets
│   │   ├── logger.ts           pino (secrets masqués)
│   │   ├── client/             http (cookie jar), aspnet (VIEWSTATE), auth (login Forms)
│   │   ├── parsers/            table (mapping par en-tête), actions, obligations, indices
│   │   ├── scrapers/           activitesMarche (séance / date)
│   │   ├── scoring/            indicators, score (§9), runScoring
│   │   ├── events/             parser, classify, resolve, repository, mock, runEvents
│   │   ├── dividends/          extract, runDividends
│   │   ├── alerts/             evaluate (pur), channels (email/telegram/console), runAlerts
│   │   ├── persistence/        supabase (service_role), repository (upsert idempotent)
│   │   └── utils/              parseNumber, dates, retry, hash, validators
│   └── tests/                  parsers, scoring, alerts (+ fixture HTML)
└── frontend/
    ├── app/                    pages App Router + route handlers /api
    ├── components/             tables, charts (Recharts), cartes
    ├── lib/                    supabase/, indicators, eventStudy, narrative, reports, bonds, format, types
    └── middleware.ts           refresh session Supabase
```

## 4. Commandes dev / build

**Scraper** (`cd scraper`)
```bash
npm install
cp .env.example .env.local        # renseigner les secrets
npm run scrape:daily[:mock]        # collecte séance (mock = sans BDFIN)
npm run scrape:date -- 2025-05-20  # reprise d'une date
npm run score[:mock]               # signaux -> signals_daily
npm run events[:mock]              # ingestion événements
npm run dividends[:mock]           # ingestion dividendes
npm run alerts[:mock]              # évaluation alertes + notifications
npm test                           # vitest (32 tests)
npm run typecheck                  # tsc --noEmit
```

**Frontend** (`cd frontend`)
```bash
npm install
cp .env.example .env.local         # NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
npm run dev                        # http://localhost:3000
npm run build && npm start
npm run typecheck
```

**Base** : appliquer `supabase/migrations/*.sql` dans l'ordre (Supabase CLI
`supabase db push` ou éditeur SQL).

## 5. Conventions de code

- **TypeScript strict** partout. ESM (imports avec extension `.js` côté scraper
  car `"type":"module"` + `moduleResolution: bundler`).
- **Logique pure et testable** isolée des I/O : indicateurs, scoring,
  event-study, bonds, évaluation d'alerte sont des fonctions pures avec tests.
- **Parsers robustes** : mapping des colonnes par **libellé d'en-tête normalisé**
  (deux passes : exact puis inclusion), jamais par index fixe.
- **Idempotence** : tous les upsert se font sur une clé naturelle
  (`code,date_marche` ; `dedupe_hash` pour events/dividends).
- **Nombres FR** : `utils/parseNumber.ts` gère espaces insécables, virgule
  décimale, %, FCFA. Toujours passer par lui.
- **UI** : thème dark finance (voir `tailwind.config.ts`), chiffres en classe
  `.tabular` (JetBrains Mono). Prose française. Pas de texte analytique inventé
  (toujours dérivé des métriques — voir `lib/narrative.ts`).
- **Sécurité** : la clé `service_role` n'est utilisée que par le scraper
  (backend). Le frontend utilise la clé **anon** soumise à la RLS.

## 6. Dépendances importantes

- `axios-cookiejar-support` + `tough-cookie` : indispensables pour conserver la
  session ASP.NET de BDFIN entre requêtes.
- `cheerio` : parsing HTML (scraper + parsers d'événements).
- `@supabase/ssr` : auth SSR côté frontend (client navigateur / serveur /
  middleware). Ne pas remplacer par l'ancien `auth-helpers`.
- `recharts` : tous les graphiques frontend.
- `zod` : validation de la config scraper.

## 7. Variables d'environnement

**scraper/.env.local** (voir `scraper/.env.example`)
- `BDFIN_BASE_URL`, `BDFIN_LOGIN_PATH`, `BDFIN_MARKET_PATH`
- `BDFIN_USERNAME`, `BDFIN_PASSWORD` (secrets)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret serveur)
- `HTTP_*` (timeout, retries), `QUALITY_*`, `LOG_LEVEL`, `DRY_RUN`, `USE_MOCK`
- Notifications (optionnel) : `RESEND_API_KEY`, `ALERTS_EMAIL_FROM`,
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — sans config, fallback console.

**frontend/.env.local** (voir `frontend/.env.example`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé anon **only**)

## 8. État actuel (au dernier passage)

Implémenté et vérifié (32 tests scraper verts ; tous les fichiers frontend
passent un contrôle syntaxique esbuild) :
- Scraper BDFIN (auth Forms, VIEWSTATE, retry, mock, scrape_runs, reprise par date).
- Migrations 0001→0006 (tables marché, référentiel, signaux, watchlist,
  portefeuille, alerts, events + pivot, report_snapshots, dividends,
  notifications_log) + vues matérialisées + RLS + cron.
- Scoring §9 explicable (sous-scores, confiance, neutralisation).
- Frontend : auth (login/signup + middleware), dashboard, marché actions
  (tableau, fiche instrument avec RSI/MACD/MA + détection, comparaison),
  signaux (explicabilité), watchlist/portefeuille (PRU, P&L latent, alertes),
  marché obligataire (YTM, duration, courbe des taux, comparatif dividendes),
  module rapports & événements (instrument/secteur/événement/marché journalier,
  event-study, texte analytique, export PDF via impression, rapports sauvegardés).
- Dividendes (ingestion mock + dérivation des communiqués, rendement dividende).
- Alertes (évaluation + notifications email/telegram/console + journal).

### Ajouts (passage 2026-06) — vérifiés (build Next + tsc verts, tests scraper)

- **Refonte UI complète « DeFi cyan »** : design system global (`tailwind.config.ts`
  + `app/globals.css`), tokens revalués (mêmes noms) — `bg`#030303, `surface`#0a1417,
  `accent`/`gold`/`info`=cyan #56D7FD, `up`#3fe18b, `down`#ff6b6b, texte #FCFCFC.
  Fonts via @import : Bespoke Serif (`font-display`) + Supreme (`font-sans`) +
  JetBrains Mono (`.tabular`). Kit réutilisable `@/components/ui/premium`
  (SectionHeader, PremiumPanel, MetricCard, SignalBadge, EmptyStatePremium, etc.).
  ~30 pages + shell refondus. (Historique des thèmes dans `docs/superpowers/specs/`.)
- **Routing** : `/` = **landing page publique** (`app/page.tsx`, composants
  `components/landing/taste/`), **`/dashboard`** = tableau de bord. Shell conditionnel
  (`components/ConditionalShell.tsx`) : `/`, `/login`, `/signup` en plein écran.
  Nav unique `lib/nav.ts` (sidebar desktop + `MobileNav` tiroir mobile).
- **Cours quasi temps réel (intraday)** : parser **brvm.org public**
  (`scraper/src/scrapers/brvmPublic.ts`, mapping par libellé) → upsert
  `brvm_actions_daily` **+ brvm_indices_daily** (indices BRVM-C/BRVM-30, veille
  dérivée de la variation). Commande `npm run intraday[:mock]` + workflow
  `.github/workflows/intraday.yml` (cron 15 min en séance). **Secrets repo requis :
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.**
- **Fondamentaux par famille comptable** (migration `0025`) : `famille_comptable`
  (banque/assurance/general) + `lignes_specifiques jsonb` sur income/balance.
  Extraction LLM (DeepSeek→Mistral) depuis les PDF de `publications` (pipeline
  `frontend/lib/import/full*`, route `/api/import-batch`, OCR Mistral en repli
  pour PDF scannés via `lib/import/ocr.ts`). Garde-fous stricts (magnitude, bilan
  équilibré, cohérence résultat/BPA). **Couverture : 44/48 sociétés** (4 sans
  publication source). PALC = `pdf-verified` (référence, jamais écrasé).
- **Diagnostic IA Premium** (migration `0024` `diagnostic_reports`, TTL 7j) :
  route streaming `/api/diagnostic/[code]` (cascade DeepSeek/Mistral/Grok via
  `lib/server/apiKeys`), métriques `lib/diagnostic/`, page `/premium/diagnostic/[code]`.
  Vérifié bout-en-bout (PALC). Réservé premium + super-admin `ebouak@gmail.com`.
- **Dashboard enrichi** : ticker permanent (actions+obligations), État du marché,
  graphiques hebdo indices (vraies bougies open=veille/close + tendance + RSI/MACD
  + sélecteur 1W/3W), Brief labellisé, composition portefeuille, signaux.
- **Export** : XLS (ExcelJS) + PDF (page `/print` + `window.print`) sur la fiche
  financials. Clés LLM stockées en table `api_keys` (lues via `resolveApiKey`).

### Ajouts (passage 2026-06-16) — Console admin, RBAC, billing, monitoring

Voir `docs/ADMIN_BILLING.md` pour le détail. Build Next vert, tsc vert, 244 tests
scraper verts.

- **Lot 1 — Admin & RBAC** (migration `0041_admin_billing_rbac.sql`, appliquée prod) :
  15 tables (plans/features, organizations, subscriptions, billing_transactions,
  admin_roles/permissions/role_permissions/user_roles, admin_audit_logs,
  scraper_sources/runs/run_steps/errors) + RLS + seed (3 plans, 5 rôles, 16
  permissions, `ebouak@gmail.com`=super_admin). RBAC serveur dans
  `lib/server/rbac.ts` (`requireAdmin`, `requirePermission(code)`, super_admin
  bypass). Console admin sous `/admin/*` avec layout dédié (`components/admin/AdminShell`).
- **Lot 2 — Pages admin données réelles** : `/admin/users` (profiles + KPIs),
  `/admin/subscriptions` (plan joint + email enrichi), `/admin/payments`
  (transactions + KPIs encaissement). Couche données isolée dans `lib/admin/`.
- **Lot 3 — Monitoring scraping** : module `scraper/src/monitoring/`
  (`buildRunRecord` pur + `withMonitoring` wrapper injectable + adaptateur
  Supabase). 6 commandes cron instrumentées (`intraday/daily/score/events/
  dividends/obligations`) → écrivent dans `scraper_runs`/`scraper_errors`
  (neutralisé en `--mock`, tolérant aux pannes, flag `--trigger=`). Dashboards
  `/admin/scraping` (KPIs 24h + runs + incidents) et `/admin/audit-logs`.
- **Lot 4 — Checkout + billing (provider-agnostic)** : abstraction
  `lib/billing/PaymentProvider` + provider `manual` (défaut, intention `pending`
  + confirmation admin). Pages `/account/plan` (souscription self-service) et
  `/account/billing` (historique, service-role filtré par user). Boutons
  Confirmer/Rejeter sur `/admin/payments` (`subscriptions.write`) →
  `activateSubscription` (txn `paid`, sub `active`, premium). Branchable
  CinetPay/PayDunya via `lib/billing/provider.ts` (env `PAYMENT_PROVIDER`).
- **Pricing** : page publique `/pricing` (3 plans, comparatif, FAQ) lue depuis
  `subscription_plans`.
- **Prérequis prod** : le projet **frontend Vercel** doit avoir
  `SUPABASE_SERVICE_ROLE_KEY` (présente — admin + billing l'utilisent server-side).

### Ajouts (passage 2026-07-20) — Liquidité v2

Spec `docs/superpowers/specs/2026-07-19-liquidite-v2-design.md`, plan
`docs/superpowers/plans/2026-07-19-liquidite-v2.md`. 397 tests scraper verts,
tsc + build frontend verts.

- **Moteur unique** `scraper/src/liquidity/` : `compute.ts` (score 0-100 en 4
  parts égales — présence, activité en valeur, impact prix **Amihud**, spread
  implicite **Roll**) et `flow.ts` (flux acheteur/vendeur par **tick rule** sur
  `brvm_intraday_snapshots`). Fonctions pures testées. `runLiquidity.ts` upsert
  `liquidity_daily` (migration `0111`, PK `code,date_marche`, RLS lecture
  publique). CLI `liquidity[:mock]`, job cron dans `.github/workflows/score.yml`.
- **Honnêteté** : score `null` sous 10 séances ; flux `null` sans snapshots ;
  fourchette `null` quand aucune source ne la donne → composante neutre.
  ⚠️ **CORRIGÉ le 2026-09-23** : cette ligne affirmait que « le carnet d'ordres
  n'étant pas publié par la BRVM, profondeur et coût d'exécution sont estimés ».
  **C'était faux.** La BRVM publie chaque séance un **Bulletin Officiel de la
  Cote** (PDF) dont une page donne, par valeur, les quantités résiduelles et les
  cours des DEUX côtés — voir la section « Carnet d'ordres » plus bas. L'impact
  prix (Amihud) reste, lui, calculé sur les échanges.
- **Unification** : la pénalité de liquidité du scoring §9 dérive désormais du
  score v2 (classe C/D uniquement) avec **fallback sur l'ancienne règle volume
  30 j** si `liquidity_daily` est absente — le scoring n'échoue jamais.
- **Frontend** : `lib/liquidity.ts` gagne `fromDailyRow` (+ types `LiquidityDailyRow`,
  `LiquidityScoreV2`) ; fiche action, conseiller et screener lisent la table avec
  fallback legacy ; `LiquidityCard` v2 (barre flux achat/vente, spread marché
  estimé, Amihud) ; page **`/liquidite`** (classement + méthodologie).

### Ajouts (passage 2026-07-21) — Academy P2 : examens & certificats

Spec `docs/superpowers/specs/2026-07-21-academy-examens-certificats-design.md`,
plan `docs/superpowers/plans/2026-07-21-academy-examens-certificats.md`. Build
frontend vert, exam.test.mjs vert.

- **Examen par niveau** (migration `0112`) : banque `academy_exam_questions`
  **jamais lisible** (RLS sans policy de lecture, assemblée serveur-only via
  service_role) ; `academy_exam_attempts` RLS owner ; `academy_certificates`
  exposé publiquement via la **vue `academy_certificates_public`** (colonnes
  `user_id`/`consent_at` masquées par grants de colonnes + policy `revoked=false`).
- **Moteur pur** `lib/academy/exam.ts` (`assembleExam`/`gradeExam`, PRNG seedé) :
  les bonnes réponses ne quittent jamais la base ; correction par **valeur**
  (le client renvoie l'ordre d'options vu). Seuil 70 %, tentatives illimitées,
  tirage aléatoire. Banque seedée par `scraper/scripts/seed-exam-bank.mjs`
  (qcm des leçons + inédits ; QCM historiques dans git `b7c3d9d`).
- **Routes** : `/api/academy/exam/[niveau]/start|submit` (gate `canAccess('formations')`
  + déblocage après leçons complétées), `/api/academy/certificate` (POST, exige
  consentement + examen réussi, écriture **service_role**), `PATCH .../[id]`
  (révocation service_role bornée à `user_id`).
- **Frontend** : page examen `/formations/academy/examen/[niveau]`, écran de
  génération (nom `profiles.display_name` + case de consentement), page publique
  `/certificat/[id]` (+ `opengraph-image` dynamique) ouverte dans le middleware,
  bouton « Ajouter à LinkedIn », entrée « Passer l'examen » sur le hub (100 %).
- **RGPD** : consentement horodaté (`consent_at`) ; export + delete couvrent
  désormais `academy_progress/notes/exam_attempts/certificates` (comble aussi un
  écart préexistant sur progress/notes). Certificat révocable.
- **P4 (hors scope)** : codes d'accès B2B.

### Ajouts (passage 2026-07-22) — Analyse hebdo des valeurs en vogue

Spec `docs/superpowers/specs/2026-07-22-analyse-hebdo-valeurs-design.md`, plan
`docs/superpowers/plans/2026-07-22-analyse-hebdo-valeurs.md`. 14 tests purs verts,
tsc + build frontend verts, 397 tests scraper sans régression.

- **Honnêteté** : tout dérive du réel (clôtures `brvm_actions_daily`, RSI/MACD
  calculés, niveaux via `computeLevels`). Aucun niveau ni chiffre saisi à la main.
- **Modules purs** `frontend/lib/hebdo/` : `levels.ts` (support/résistance/objectifs
  sur le canal 20 séances), `select.ts` (3-5 valeurs notables — variation, volume
  ≥ 2×, cassure, RSI — avec **au moins une baisse garantie**), `narrative.ts`
  (squelette déterministe + `assertNoForeignNumber`).
- **Garde-fou LLM** : `scraper/src/hebdo/polish.ts` reformule les liaisons via
  DeepSeek→Mistral mais **rejette toute sortie contenant un chiffre absent** de la
  whitelist → fallback squelette. Aucun chemin ne publie un texte non vérifié.
- **Worker** `scraper/src/hebdo/runHebdo.ts` (CLI `hebdo[:mock]`) : pagine
  PostgREST (plafond 1000 lignes), fige un **snapshot** `metrics` par valeur,
  **auto-publie** puis envoie une **alerte** (email/telegram) avec le lien.
  Cron `.github/workflows/hebdo.yml` samedi 06:00 UTC. Migration `0113`.
- **Duplication assumée** : `scraper/src/hebdo/pure/` copie les modules purs du
  frontend (deux paquets TS distincts, pas de module partagé). Toute correction
  est à reporter des deux côtés — commentaire en tête de chaque copie.
- **Frontend** : `/analyses/hebdo` (index) et `/analyses/hebdo/[date]` (graphe
  Recharts cours + RSI annoté des niveaux, narratif, lexique, disclaimer),
  `opengraph-image` + PNG haute-rés `/api/hebdo/[date]/image?code=`,
  admin `/admin/hebdo` (dépublier, `content.publish`). Nav : « Valeurs de la
  semaine » (à ne pas confondre avec `/weekly`, matières premières).

### Ajouts (passage 2026-09-03) — Vidéo de séance quotidienne

Voir `video/README.md`. Vérifié bout-en-bout en local sur la séance du 2026-09-02
(47 valeurs, 18/22/7, 2,55 Md) : génération, refus de publication, et absence de
secrets tous exercés.

- **Troisième worker `video/`** (paquet ESM distinct, playwright seul) —
  `genere.mjs` lit `brvm_actions_daily` + `brvm_indices_daily`, compose 7 scènes
  1080×1920 dans Chromium, synthétise la voix (`edge-tts`, `fr-FR-DeniseNeural`)
  et monte avec ffmpeg. **À ne pas confondre avec `remotion/`**, qui rend la
  vidéo décorative de fond de la landing.
- **Une seule lecture pour tout** : images, texte lu et légende publiée sont
  composés des **mêmes variables**. Régression à l'origine de cette règle : une
  version gardait l'audio figé pendant que les images suivaient la base, et la
  voix a annoncé 31 hausses quand l'écran en montrait 18.
- **Verrou de publiabilité** : `seance.json` porte 5 contrôles (`seance_recente`,
  `assez_de_valeurs`, `composite_present`, `capitaux_non_nuls`,
  `variations_non_plates`). `publie.mjs` **n'envoie rien** si l'un échoue — un
  cron publie sans relecture, mieux vaut un jour sans vidéo qu'un post faux.
- **Publication** `publie.mjs` : Facebook Graph `POST /{page}/videos` et TikTok
  Content Posting API. Le **jeton TikTok expire en 24 h** → échange du
  `refresh_token` à chaque exécution (et avertissement s'il est renouvelé).
  Défaut TikTok = `inbox` (brouillon), seul mode qui marche sans audit de l'app.
  Une plateforme non configurée est ignorée, jamais en échec.
- **Cron** `.github/workflows/video-seance.yml` — 18:00 UTC, lundi-vendredi.
  Artefact conservé 14 j **même si la publication échoue**. Secrets à créer :
  `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `TIKTOK_CLIENT_KEY`,
  `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`.
- **Landing** : `publie.mjs` héberge d'abord la vidéo dans le **bucket public
  `seance-video`** (`seance/<date>.mp4` + `.jpg` d'affiche + `derniere.json`),
  avant les réseaux — le site est servi même sans identifiants sociaux. L'URL
  **porte la date** : aucun cache ne peut montrer la vidéo d'hier sous les
  chiffres du jour. Côté site : `lib/landing/videoSeance.ts` (lecture anonyme,
  revalidation 300 s) + `components/landing/VideoSeance.tsx`, section placée
  après la cartographie. Elle **disparaît** sans vidéo publiée et affiche
  **« séance précédente »** si la vidéo n'est pas la dernière séance connue.
  Fichier servi depuis notre stockage : aucun lecteur tiers, la promesse
  « aucun traceur » tient. Transcription dépliable (la vidéo n'ayant pas de
  sous-titres, c'est le seul accès sans le son et le seul texte indexable).
- **Sans sous-titres** (demande explicite). À rouvrir si l'audience TikTok le
  justifie : la plupart des vues y démarrent sans son.

### Ajouts (passage 2026-09-08) — Telegram : canal public, alertes perso, agent

Migration `0129_telegram_alerts.sql` **à appliquer**. tsc frontend vert,
typecheck + **412 tests scraper verts**, `pairing.test.mjs` (6) vert après
extraction du module partagé.

- **Canal public** `@westbourse7` : `video/publie.mjs` y poste la vidéo en
  pièce jointe (`TELEGRAM_CANAL`). **Trois destinations Telegram distinctes, à
  ne jamais confondre** : `TELEGRAM_CHAT_ID` = conversation privée
  d'exploitation, `TELEGRAM_CANAL` = canal public,
  `notification_prefs.telegram_chat_id` = conversation d'un utilisateur.
- **DÉFAUT CORRIGÉ** : `scraper/src/alerts/channels.ts` envoyait TOUTE alerte
  Telegram vers l'unique `TELEGRAM_CHAT_ID` — celui de l'exploitant — alors que
  `/parametres/alertes` promettait « et Telegram si configuré ». `Notification`
  porte désormais `telegramChatId` ; **aucun repli** vers la conversation de
  l'exploitant (un repli silencieux reproduirait le défaut). Les messages
  d'exploitation posent `operateur: true` explicitement.
- **Preuve de possession, contrairement à WhatsApp** : `telegram_chat_id` n'est
  jamais saisi ; il vient de Telegram et n'est écrit que par le webhook après un
  code d'appairage valide. Là où `whatsapp_phone` reste déclaratif (0127),
  celui-ci est prouvé. Le composant `TelegramPrefs` ne l'écrit jamais.
- **Module partagé** `lib/pairingCodes.ts` : extrait de
  `whatsappAgent/pairing.ts` (qui le réexporte, appelants inchangés) — il n'a
  jamais rien eu de spécifique à un canal.
- **Agent** `lib/telegramAgent/` : réutilise **tels quels** `systemPrompt`
  (garde-fou « pas de conseil en investissement »), `watchlistContext` et
  `callAgentLlm` de whatsappAgent. Les dupliquer aurait créé deux garde-fous
  destinés à diverger. Consentement commun `agent_optin` — même agent, deux
  canaux. Quota : code `whatsapp_agent` conservé (mal nommé, mais en semer un
  autre refuserait tout le monde en silence).
- **Webhook** `/api/telegram/webhook` : secret partagé par en-tête
  (`TELEGRAM_WEBHOOK_SECRET`), comparé à **temps constant** — pas de HMAC comme
  Meta. Déduplication par `update_id`. **Ne traite que `chat.type === 'private'`** :
  sans ce filtre, le bot prendrait ses propres publications de canal pour des
  questions et répondrait devant tout le monde.
- ⚠️ **Telegram : long-polling OU webhook, jamais les deux.** Poser le webhook
  (`node telegram-init.mjs --webhook <url>`) désactive `getUpdates`, donc la
  découverte de `chat_id`. Les envois sortants n'en dépendent pas.
- **RGPD** : export et suppression couvrent `telegram_conversations` et
  `telegram_pairing_codes` ; purge 90 j / 1 j dans `purge_rgpd_retention()`. Le
  déliement efface le `chat_id`, pas seulement l'opt-in.
- **Reste à faire** : appliquer 0129, poser `TELEGRAM_WEBHOOK_SECRET` (Vercel
  `frontend` + `video/.env.local`) et `NEXT_PUBLIC_TELEGRAM_BOT`, déclarer le
  webhook, puis **tester la RLS des deux tables à la clé anon**.

### Ajouts (passage 2026-09-08) — Agent à outils, et audit des dividendes

417 tests scraper verts, tsc frontend vert, 17 tests purs frontend verts.

- **Agent outillé** (`lib/agent/outils.ts`) : 8 fonctions en **lecture seule** —
  `mon_portefeuille`, `mes_alertes`, `cours_valeur`, `historique_valeur`,
  `dividendes_valeur`, `actualites_valeur`, `liquidite_valeur`,
  `palmares_seance`. Le contexte n'est plus empilé dans le prompt avant de
  connaître la question. **Cela RENFORCE l'honnêteté** : chaque chiffre vient
  d'un retour de fonction, une donnée absente devient un `null` explicite.
  Élargir ce que l'agent voit n'élargit JAMAIS ce qu'il peut faire.
- `callAgentLlm(messages, outils?)` et `buildSystemPrompt({canal, outils})` :
  paramètres **facultatifs**, WhatsApp reste sur l'ancien comportement (non
  éprouvable ici). Les trois garde-fous sont une source unique, paramétrée par
  canal et non dupliquée. `MAX_TOURS = 3` borne la boucle d'outils.
- **AUDIT DIVIDENDES (2026-09-08) contre Sika Finance** — 123 points comparés,
  93 % concordants. Alignement établi : `exercice` = année Sika.
  **Sur 353 lignes, 179 étaient inexploitables** :
  + 90 avec `montant = exercice` (source `bdfin`, 28 codes, 1999-2015) ;
  + 68 à zéro (`sikafinance-societe`) ; 21 sans exercice ;
  + **8 mal attribuées** : TTLC portait les dividendes de TOTAL SENEGAL et
    BOABF ceux de BOA SENEGAL, 4 années sur 4 exactes.
- **Cause** : sikafinance **tronque ses libellés à 20 caractères**
  (« BANK OF AFRICA SENEG »), les alias curés attendaient les noms complets, et
  le repli flou tranchait au lieu de renoncer. Corrigé : motifs valides sur
  20 caractères, `TTLS` ajouté avant `TTLC`, et le flou **refuse désormais
  l'ambiguïté** (score ≥ 0,72 ET écart ≥ 0,12 avec le second) — un trou déclaré
  dans `unmatched` vaut mieux qu'une ligne fausse. Test de régression
  `tests/sikafinanceMatcher.test.ts`.
- **L'agent écarte à la lecture** les lignes non fiables : sans elles il
  annonçait « rendement 0 % » pour 13 actions sur 48.
- **Richbourse** (`richbourse.com/common/dividende/index`) : source plus propre
  — **codes BRVM natifs dans les liens** (pas de correspondance par nom, donc
  pas le bug ci-dessus) et **date de paiement**, absente à 100 % de la base.
  Année courante seulement. `src/dividends/richbourse.ts` (`parseRichbourse`
  pur + `fetchRichbourseDividends`), branché en **dernier** dans
  `runDividends` : le dédoublonnage intra-lot garde la dernière occurrence,
  donc Richbourse l'emporte sur la campagne en cours. Une ligne sans code
  exploitable est **ignorée, jamais devinée** (TRACTAFRIC, BOLLORE-AGL).
- **FAIT (2026-09-08)** : purge des 98 lignes fausses (353 → 263, exploitables
  49 % → 66 %, plus aucune ligne `montant = exercice`) ; import Richbourse
  exécuté en production — **18 premières dates de paiement** de la table, et
  15 montants arrondis par sikafinance remplacés par leur valeur exacte
  (écart maximal 0,48 FCFA, tous dans le même sens). ABJC ex.2025 tranché :
  **201,52 au 2026-09-30**, l'entier 202 était l'arrondi de sikafinance.
  Conséquence visible : `/calendrier` et `/dividendes/calendrier` affichent
  enfin des événements de paiement (5 dans les 90 jours), vérifiés à la clé
  anon. Cron `dividends.yml` (samedi 09:00 UTC) rafraîchit sans intervention.
- **Reste ouvert, délibérément** : 68 lignes à montant nul et 21 sans exercice
  ne sont **pas** supprimées — leur fausseté n'est pas prouvée, et elles sont
  déjà écartées à la lecture par `lib/agent/outils.ts`. Les supprimer sur une
  présomption détruirait de la donnée peut-être bonne.

### Ajouts (passage 2026-09-08) — Plage 52 semaines

- **Colonnes tenues, enfin.** `cours_haut_52s` / `cours_bas_52s` de
  `brvm_actions_daily` (migration `0018`) étaient lues par une douzaine de
  fichiers frontend et **jamais alimentées** : 0 ligne sur 48 640. La donnée
  n'est pas à collecter, elle se **calcule** depuis les clôtures déjà en base.
- **Module** `scraper/src/scrapers/range52.ts` : `calculerBornes()` pur (testé,
  7 cas) + `runRange52()`. Min/max des `cours_jour` sur 365 jours glissants,
  **écriture sur la seule dernière séance** (c'est `latestDaily` que le
  frontend lit). CLI `range52[:mock]`, job dans `.github/workflows/score.yml`
  (après `score`, 16:00 UTC — la clôture du jour doit être incluse).
- **Seuil `MIN_SEANCES = 20`** : sous 20 séances cotées, **aucune borne**. Sur
  un marché étroit, annoncer un « plus-bas 52 semaines » tiré de trois points
  serait une affirmation sans fondement. Zéros et nuls écartés — un zéro en
  base est un trou de collecte, pas un cours.
- **Pagination obligatoire** (~12 000 lignes) : PostgREST tronque à 1000 **en
  silence**, ce qui aurait produit des bornes fausses et plausibles.
- **Frontend** : `components/financials/WeekRange52.tsx` refondu en **tube
  gradué** (rail, dégradé bas→haut ancré au rail, repère de niveau, `role="meter"`,
  `motion-reduce`). Le dégradé encode la **position**, pas un verdict : un titre
  au plus-haut peut être une dynamique comme une survalorisation. Jetons du
  design system (les `bg-gray-700` / `bg-green-400` bruts ont disparu).
- **Vérifié en production** : 47/47 valeurs, cours du jour toujours dans
  `[bas ; haut]`, 0 incohérence.

### Ajouts (passage 2026-09-14) — Dossier valeur : rapport A4, prose polie, PDF par lot

tsc frontend vert, 33 tests purs verts (`lib/dossier/*.test.mjs` +
`lib/fundamentals.analyse.test.mjs`), 47/47 PDF imprimés en local à 7 pages
chacun, mur vérifié dans les quatre cas (sans en-tête 307, bon secret 200,
mauvais secret 307, autre route avec le bon secret 307).

- **Page `/rapports/dossier/[code]`** : 12 panneaux sur 7 feuilles A4, rendu
  serveur, SVG pur (Recharts est client-only et peut sortir vide à
  l'impression). Feuille CSS propre `.dv`, claire d'origine : le bloc
  `@media print` global blanchit des pages sombres, celle-ci n'a rien à
  défaire. Entrées : ligne de portefeuille (📄 page, ⬇ PDF) et fiche action.
- **PILOTÉ PAR LA DONNÉE, PAS PAR LA PROSE.** `lib/dossier/build.ts` lit ou
  calcule chaque chiffre ; `narratif.ts` dérive forces et vigilances
  (déterministe, chaque ligne porte son chiffre ET un `fait` sans chiffre) ;
  `prose.ts` assemble un squelette **sans aucun nombre par construction**
  (sauf l'année d'exercice et les renvois de panneaux). Les lacunes sont
  déclarées au panneau 12, jamais laissées en blanc.
- **Prose polie** (`/api/cron/dossier-polish?code=`, bearer `CRON_SECRET`,
  jamais en query string) : DeepSeek→Mistral reformule le squelette ;
  `validerProse` rejette tout chiffre hors liste blanche, toute causalité,
  tout titre modifié. Rangée dans `dossier_narratifs` (migration `0131`,
  lecture publique, écriture service_role) avec l'**empreinte** du squelette.
  À la lecture, la page revalide ET compare l'empreinte : une prose issue d'un
  squelette qui a changé (une force apparue, un risque disparu) est écartée.
  **Pourquoi sans chiffre** : une prose chiffrée le samedi serait contredite
  dès lundi par les panneaux vivants, et le garde-fou l'écarterait à raison —
  visible un jour sur sept. Les chiffres vivent dans les panneaux.
- **PDF par lot** (`video/dossiers.mjs`, cron `dossier.yml` samedi 11:00 UTC
  après `dividends.yml`) : Chromium imprime la page VIVANTE — une seule source
  de mise en page. Un dossier ne dépend que du code : **≤ 48 PDF par passage,
  jamais utilisateurs × lignes**. Bucket privé `dossiers` (`<CODE>/<date>.pdf`
  + `<CODE>/dernier.pdf`), servi par `/api/dossier/[code]/pdf` après contrôle
  de session, en URL signée 10 min.
- **Le worker n'a pas de session** : il présente `DOSSIER_RENDER_SECRET` dans
  l'en-tête `x-dossier-render`, que `lib/supabase/middleware.ts` accepte pour
  le SEUL préfixe `/rapports/dossier/` (comparaison à temps constant écrite à
  la main — `node:crypto` n'existe pas en Edge ; secret < 32 caractères refusé).
  Rayon d'exposition si le secret fuit : un rapport de données de marché,
  aucune donnée utilisateur.
- **Verrous du worker** : 7 feuilles exactement, PDF > 30 ko, et sous média
  print `scrollHeight ≤ clientHeight` sur chaque feuille — les feuilles ont une
  **hauteur fixe** de 297 mm à l'impression (297 mm = 1122,5 px ; une feuille
  mesurée à 1123 débordait d'un demi-pixel et ouvrait une page fantôme : NEIC
  sortait en 9 pages). Un débordement fait échouer le code, jamais un rognage
  silencieux. Le splash d'intro (`fixed`, 1 s) recouvrait chaque page :
  `[data-splash]` masqué en print + drapeau `ws_splash_seen` posé par le worker.
- **Corrections vues en chemin** : `litNotation` comptait deux fois la
  notation courante (`history[0]` la contient déjà) ; `fmtFcfa` laissait un
  point décimal sur la branche « M » ; `CookieBanner` sans `print:hidden`
  s'imprimait sur chaque page de tous les exports.
- **FAIT (2026-09-14)** : `0131` appliquée, `DOSSIER_RENDER_SECRET` posé sur
  Vercel et GitHub, `CRON_SECRET` réaligné (il avait divergé), lot complet
  exécuté — **47 proses polies et 47 PDF rangés**, avis de sécurité : aucun
  nouveau. Le cron tourne seul depuis.

### Ajouts (passage 2026-09-15) — Envoi hebdomadaire des dossiers aux porteurs

Spec `docs/superpowers/specs/2026-09-15-envoi-dossiers-design.md`, plan
`docs/superpowers/plans/2026-09-15-envoi-dossiers.md`. 3e étape de
`dossier.yml`, après l'impression.

- **Consentement distinct** (migration `0132`, **à appliquer**) :
  `notification_prefs.dossiers_email` / `dossiers_telegram` /
  `dossiers_optin_at`, cases décochées par défaut, UI `DossiersPrefs` dans
  `/parametres/alertes`. La case Telegram reste inerte tant que la
  conversation n'est pas appairée. Le composant n'écrit JAMAIS
  `telegram_chat_id` — seul le webhook le pose. WhatsApp EXCLU (numéro
  déclaratif, voir la précondition d'appairage plus bas).
- **Journal idempotent** `dossier_envois` (PK `user_id, semaine, canal`, RLS
  lecture owner, écriture service_role, rétention 90 j dans
  `purge_rgpd_retention`). Un couple déjà `envoye` cette semaine est sauté :
  **relancer le workflow à la main ne renvoie rien à personne.**
- **Modules purs testés** `scraper/src/dossiers/` : `selection.ts` (7 tests —
  fraîcheur 3 j, tri par valorisation, plafond 12 pièces jointes) et
  `message.ts` (7 tests). **AUCUN CHIFFRE dans le corps du message**, hors
  dates : les chiffres vivent dans les PDF où ils ont été vérifiés ; en
  remettre créerait une seconde source à tenir juste. Un test échoue à la
  moindre valeur numérique réintroduite.
- **Verrou de fraîcheur** : un PDF de plus de 3 jours n'est pas envoyé, il est
  **écarté ET NOMMÉ** dans le message. Un dossier périmé livré en silence est
  pire qu'un dossier absent.
- **Canaux** (`alerts/channels.ts`, 8 tests) : `Notification.attachments`
  (base64 encodé côté canal) et `sendTelegramDocument` en multipart. Même
  règle que `sendTelegram` : destinataire explicite, **aucun repli** vers la
  conversation de l'exploitant. L'URL portant le jeton du bot, seule la
  `description` de Telegram est relayée en cas d'échec.
- **Portefeuille vide → AUCUN message**, seulement une trace `vide`. Un canal
  demandé mais inutilisable (pas d'adresse, pas d'appairage) est ignoré : ce
  n'est pas un échec d'envoi.
- **Un lancement manuel ciblé (`inputs.codes`) réimprime sans envoyer** : on
  n'écrit pas à un client parce qu'on a relancé un PDF.
- **RGPD** : `dossier_envois` ajoutée à `/api/account/export` ; suppression
  couverte par la cascade `auth.users`.
- **FAIT (2026-09-17)** : `0132` appliquée ; RLS vérifiée (lecture anonyme `[]`,
  écriture `42501`, `purge_rgpd_retention` en anonyme `permission denied`,
  0 avis de sécurité) ; **premier envoi réel réussi** vers `ebouak@gmail.com`
  — `comptes 1 · envoyés 1 · échecs 0`, 4 PDF en pièces jointes, **réception
  confirmée**. L'idempotence est armée : relancer ne renvoie rien
  (`sautés` passerait à 1).

### Ajouts (passage 2026-09-16/17) — Landing : mouvement, récit, preuve

Audit complet en 12 axes. Trois commits en production, chacun vérifié dans le
HTML servi (et non déduit — voir la leçon en §9).

- **Hero animé** (`heroTerminal.css`) : le terminal s'initialise au chargement,
  **CSS pur, zéro JavaScript**. Un composant client posant une classe au
  montage aurait fait clignoter (visible → masqué → fondu), le HTML étant déjà
  rendu à l'état final. La colonne de discours n'est PAS animée : le `H1` est
  l'élément LCP (mesuré). `pathLength="1"` évite de mesurer la courbe en JS, et
  l'état de repos vaut `dashoffset: 0` — tracé entier si rien ne s'anime.
  **Coût LCP mesuré : −84 ms** (7 exécutions, Pixel 7, 4G bridée, CPU ×4, en
  n'éteignant QUE les classes `.ht-*`), c'est-à-dire rien. CLS 0,0001.
- **Récit remonté** : « De la donnée à la décision » passe de la 16ᵉ à la 5ᵉ
  place. Placé AVANT le tarif sans le déplacer — la décision documentée de
  montrer le prix tôt reste intacte.
- **Preuve de la donnée** (`PreuveDonnee.tsx`) : source → chiffre → horodatage
  sur un chiffre RÉEL. Réutilise `v_fraicheur_cours` (migration 0122), déjà
  employée par `/dashboard` et la fiche action mais absente de la landing.
  `computeFreshness` est calculé AU RENDU, pas dans `getData` (caché 5 min) :
  un âge figé serait faux dès la seconde visite.
- **Légendes A–F et BUY/HOLD/SELL** au point de contact — ils étaient affichés
  partout, définis nulle part.
- **Révélation au défilement** (`revelation.css`) : `animation-timeline: view()`
  sous `@supports`, donc aucun IntersectionObserver. Là où le support manque
  (Safari, Firefox), la règle n'existe pas et l'élément reste PLEINEMENT
  VISIBLE — jamais de contenu garé à `opacity: 0`.
- **FUSION ANNULÉE, et pourquoi** : `RatingSpotlight` avait été fusionné dans
  « Comprendre une action ». **C'était faux.** `featured`/`fundamentals`
  viennent de `candidat` (la plus ÉCHANGÉE) ; `spotlightSignal` de
  `order('score_total' desc)` (la mieux NOTÉE) — en production SNTS contre
  SHEC. Sous un titre annonçant une société, le sous-bloc en montrait une
  autre. Et les trois composants rendent `null` sur des conditions
  INDÉPENDANTES : sans cotation échangée, RatingSpotlight restait seul, `h3`
  orphelin. **Ne pas refusionner** sans lui passer le signal de `featured`, ce
  qui suppose de charger ses sous-scores (`inputs`), absents du select de
  `sigByCode`.

### Ajouts (passage 2026-09-17/18) — Remédiation de l'audit : soft-404, sécurité, dépendances

Audit complet en 5 phases (`AUDIT_REPORT.md`, plan `PLAN_REMEDIATION.md`).

- **SOFT-404, cause prouvée dans les deux sens.** Toute route publique absente
  (`/societes/ZZZZ`…) répondait **200**. Cause : `app/loading.tsx` à la RACINE.
  Une frontière Suspense fait diffuser la réponse en flux, donc le statut 200
  part avant que la page n'appelle `notFound()`. Retirer ce fichier rend le 404 ;
  en ajouter un à une app Next 14.2.35 VIERGE casse le sien. Vingt autres pistes
  ont été mesurées et écartées, dont **le middleware, innocent**.
  ⚠️ **RÈGLE : aucun `loading.tsx` au-dessus d'une route pouvant appeler
  `notFound()`.** Le squelette vit dans `components/ui/LoadingSkeleton.tsx` et
  n'est posé que segment par segment (`e2e/not-found.spec.ts` protège la règle
  en testant le STATUT, pas l'apparence). PR #16, `4fc8caa`, validée en
  production 8/8.
- **Mesurer le rendu, pas le HTML brut.** Le texte de `not-found.tsx` figure
  dans la charge RSC de TOUTES les pages : un grep sur le HTML signale une 404
  partout. Vérifier `innerText` dans un navigateur.
- **INCIDENT DU 2026-09-18 — la clé `service_role` de l'historique était
  VALIDE.** Présente dans l'historique PUBLIC depuis le commit initial (émise
  le 25/05), retirée des fichiers en `78c27ab`/`73455cc`. Ce dernier commit
  affirmait « déjà rotée côté Supabase » : **c'était faux**, et l'audit du
  17/09 l'avait repris sans test. Mesuré le 18/09 : la clé exposée lisait
  `profiles` sans RLS, et c'était **celle de production**. Accès complet à la
  base ouvert au public pendant environ 4 mois ; aucune trace d'altération dans
  les tables d'administration et de facturation, mais **une lecture ne laisse
  aucune trace** — l'extraction ne peut pas être exclue (point RGPD à trancher
  par le responsable de traitement).
  **Résolu le jour même, sans interruption** : passage aux nouvelles clés
  `sb_publishable_` / `sb_secret_` (GitHub, Vercel Production + Preview,
  `.env.local`), vérification de chaque consommateur, puis **désactivation des
  clés héritées** dans Supabase. La clé exposée renvoie désormais 401
  « Legacy API keys are disabled » (10 essais sur 10). Alerte GitHub #1 close
  en « revoked » avec la preuve. La clé Resend, elle, était bien morte (401).
  ⚠️ **Leçon : une clé n'est révoquée que si un TEST le prouve** — jamais sur
  la foi d'un message de commit, d'une doc ou d'un rapport.
- **Deux pièges des nouvelles clés, mesurés pendant la bascule :**
  + en-têtes INCOMPATIBLES entre familles : clé héritée = `apikey` +
    `Authorization: Bearer` (apikey seul retombe au rôle anonyme) ; clé
    `sb_` = `apikey` SEUL (en Bearer : « Invalid JWT »). Tout `fetch` brut
    passe par `video/supabaseEntetes.mjs` ; supabase-js gère les deux ;
  + une clé `sb_secret_` est REFUSÉE (401 « Forbidden use of secret API key
    in browser ») si le User-Agent ressemble à un navigateur — dont celui de
    PowerShell 5.1 (`Mozilla/5.0…`). Toujours fixer un User-Agent explicite.
- **Historique git : pas de réécriture.** La clé qu'il contient est désormais
  inerte ; réécrire casserait clones et forks pour un gain nul.
- **Détection de secrets et blocage au push ACTIVÉS le 2026-09-18.** Ils
  étaient désactivés au niveau du dépôt, contrairement à ce que laissait
  croire `73455cc` (l'alerte venait du réglage du compte utilisateur).
- **NEXT 14 NE REÇOIT PLUS DE CORRECTIFS.** 14.2.35 est la dernière 14.x ; les
  correctifs de sécurité sont reportés sur la **15.5** (≥ 15.5.24) et la 16.
  Deux avis CRITIQUES d'exécution de code à distance la visent :
  + CVE-2026-75604 — serveurs hébergés sous **Windows**. Vercel tourne sous
    Linux : production non concernée. **Le serveur de dev local l'est** : `next
    dev` écoute par défaut sur `0.0.0.0`, donc sur le réseau local.
  + GHSA-2xp9-vwfh-vxw4 — `libheif` via `sharp`, quand l'optimiseur traite un
    **AVIF**. Non exploitable aujourd'hui : aucun AVIF dans `public/`, aucun
    `images.remotePatterns`. ⚠️ **Ne PAS ajouter d'image AVIF, de
    `remotePatterns` ni de `formats: ['image/avif']` tant que Next n'est pas
    ≥ 15.5.24** — chacun de ces gestes rouvre la faille.
  Plusieurs avis HAUTS de déni de service (Server Components, Server Actions)
  s'appliquent, eux, et n'ont aucun correctif en 14.x : la montée en 15.5 est
  à planifier comme un chantier à part entière.
- **`postcss` embarqué par Next (8.4.31) : override NON appliqué.** Il ne
  traite que notre propre CSS au build ; les avis exigent un CSS fourni par un
  attaquant. Risque de casser le build > gain.
- **`npm audit fix` passé au lockfile seul** (`--package-lock-only`, pour ne
  pas tenter d'installer `canvas` sur Windows). Gain réel : `sanitize-html`
  2.17.5 → 2.17.7 — 17 charges XSS testées, aucune ne survit, sortie
  identique à l'ancienne version. `tar` (via `canvas`, optionnel, tiré par
  `pdfjs-dist`) reste vulnérable : n'intervient qu'à l'installation.
- **`scraper/` : 9 avis hauts, lot séparé.** `xlsx` 0.18.5 n'a **aucun
  correctif sur npm** (SheetJS publie désormais sur son CDN) ; il ne lit que la
  Pink Sheet de la Banque mondiale, mais dans un job qui porte la clé
  `service_role`. `axios`, `undici`, `ip-address`, `js-yaml` se corrigent sans
  rupture ; la chaîne `puppeteer` exige une majeure. ⚠️ Le scraper tourne
  avec **`NODE_TLS_REJECT_UNAUTHORIZED=0`** (script npm) : AUCUNE vérification
  de certificat, y compris vers Supabase avec la clé secrète. Priorité du lot.

### Agent WhatsApp — PRÉCONDITION avant de lui donner les outils (2026-09-08)

L'agent WhatsApp appelle encore `callAgentLlm(messages)` sans outils, là où
Telegram passe `{definitions: OUTILS, executer}`. **Ce n'est pas un oubli à
corriger d'un paramètre.**

`lib/whatsappAgent/handleMessage.ts` identifie l'utilisateur par le numéro
**déclaré** dans les paramètres : aucun OTP ne prouve la possession (le code le
dit lui-même). Si un compte saisit — par faute de frappe ou volontairement — le
numéro d'un tiers, c'est ce tiers qui, en écrivant au bot, reçoit les données de
l'autre. Aujourd'hui cela expose une watchlist ; **avec les outils, ce serait le
portefeuille, les positions et les alertes**. Telegram n'a pas ce problème : son
`chat_id` vient de Telegram et n'est écrit qu'après un code d'appairage.

Ordre imposé : **appairage d'abord, outils ensuite.** Le module de codes est
déjà partagé (`lib/pairingCodes.ts`, extrait précisément parce qu'il n'a rien
de spécifique à un canal).

Rien ne presse : au 2026-09-08 le canal est **dormant** — `whatsapp_conversations`
est vide et aucun identifiant Meta n'est configuré.

### Ajouts (passage 2026-09-08) — Flottant et volume moyen 30 j

- **`flottant` et `vol_moyen_30j` (0/335 depuis la migration `0020`) sont
  remplis** : 47 actions sur 48 (SVOC n'a pas de page richbourse — même trou
  que ses fondamentaux). Le module `runDetails` existait et écrivait déjà ces
  colonnes ; il prenait **403 sur chaque appel** (chaîne d'agent périmée) et
  n'était **planifié dans aucun workflow**.
- **Ce que cela change, honnêtement.** `flottant` est affiché sur la fiche
  action (« Titres flottant ») : gain réel. `vol_moyen_30j` **n'a aucun
  consommateur** — la fiche action calcule déjà sa propre moyenne sur nos
  20 dernières séances, et le repli de liquidité du scoring lit
  `avg_volume_30d` de `mv_signal_inputs`, une autre colonne. La remplir l'a
  rendue juste plutôt que vide ; **ne pas l'afficher à côté de la moyenne 20 j
  calculée** — deux moyennes de volume voisines, dont une tierce et en retard
  d'une séance, tromperaient plus qu'elles n'informeraient.
- **`src/client/richbourseAgent.ts`** : la chaîne d'agent et sa justification
  déontologique (robots.txt de richbourse, `/common/mouvements/` et
  `/common/dividende/` hors Disallow) vivaient en double, et une seule copie
  était juste. Constante partagée désormais.
- **PREUVE DE SÉANCE plutôt que date devinée.** La page ne porte aucune date de
  séance exploitable ; l'ancien code se rabattait **silencieusement** sur
  « aujourd'hui » — un dimanche, l'update ne visait aucune ligne et le journal
  annonçait un succès. `runDetails` s'ancre maintenant sur la dernière séance
  **de notre base**, et n'écrit `ouverture`/`plus_haut`/`plus_bas` que si la
  clôture de richbourse **égale notre `cours_jour`**.
- **Ce garde-fou a servi immédiatement** : au 2026-09-08, richbourse avait une
  séance de retard sur **39 valeurs sur 47** (SNTS 38 700 contre 39 200, NTLC
  18 000 contre 16 900). Sans lui, les extrêmes d'hier auraient été collés sous
  la clôture d'aujourd'hui — et auraient **écrasé** les valeurs correctes que
  `cotations` (daily.yml, sikafinance) écrit déjà. Ces colonnes n'étaient donc
  pas vides, contrairement à `flottant`/`vol_moyen_30j`.
- **Tests** (`tests/richbourseDetails.test.ts`, 7) sur le balisage réel, dont le
  piège de la cellule de libellé « Volume moyen » qui contient une infobulle
  entière : une égalité stricte la manquerait sans rien faire échouer.
- **Cron** : job `details` ajouté à `dividends.yml` (samedi 09:00 UTC) — même
  source, même jour, pour ne pas multiplier les visites chez un tiers.
  Hebdomadaire car le flottant ne bouge qu'aux opérations sur titres.

### Ajouts (passage 2026-09-23) — Carnet d'ordres : la BRVM le publie

Migrations `0138` (carnet) et `0139` (source de la fourchette), appliquées.
14 tests de parsing + 17 tests de liquidité, 505 tests scraper sans régression.

- **LA BRVM PUBLIE SON CARNET D'ORDRES.** Le **Bulletin Officiel de la Cote**
  (`brvm.org/fr/bulletins-officiels-de-la-cote/0`, un PDF par séance) porte une
  page « MARCHE DES ACTIONS » donnant, par valeur : quantité résiduelle à
  l'achat, cours achat / vente, quantité résiduelle à la vente, cours de
  référence. Le spike de juillet 2026 avait conclu l'inverse **en n'interrogeant
  que des pages HTML de cotation** (Richbourse, brvm.org/cours-actions,
  sikafinance) — jamais les publications de l'institution. ⚠️ **Leçon
  générale** : avant de conclure qu'une donnée n'existe pas, regarder ce que le
  PRODUCTEUR de la donnée publie en propre.
- **Collecte** : `scraper/src/carnet/` — `parse.ts` (pur, testé sur une fixture
  du bulletin réel), `fetch.ts`, `runCarnet.ts`. CLI `carnet [AAAA-MM-JJ]`,
  cron `.github/workflows/carnet.yml` (19:00 UTC et 07:30 UTC le lendemain :
  le bulletin paraît parfois seulement le jour suivant). Idempotent : une séance
  déjà en base est sautée. Le workflow **relit la base** et échoue si le carnet
  est vide — un run vert ne prouve rien.
- **Deux pièges du PDF, tous deux capables de passer inaperçus.** (1) Les
  colonnes ne se lisent PAS par index : le séparateur « / » tombe tantôt dans la
  ligne, tantôt sur une ligne à lui seul, et une valeur sans acheteur décale
  tout le reste — d'où un découpage par POSITION horizontale. (2) Deux
  conventions de nombres cohabitent dans le même tableau : « 12 790 » (espaces)
  et « 3,955 » qui vaut **3 955 francs**. Lire cette virgule comme un décimal
  diviserait le cours par mille, sans que rien ne le signale à l'écran.
- **Un ordre « au marché » n'a pas de cours.** Le spread vaut alors `null`, et
  une fourchette croisée est refusée aussi : elle trahirait une lecture fautive.
- **La fourchette réelle remplace l'estimateur de Roll** dans
  `liquidity/compute.ts` (paramètre optionnel ; Roll reste en repli et reste
  stocké à côté, pour pouvoir comparer l'estimation au fait). `liquidity_daily`
  gagne `spread_pct` et `spread_source` (`carnet` | `roll`) : l'interface
  n'affiche le « ≈ » que sur une estimation.
- **Effet mesuré, avant/après sur 48 valeurs** : fourchette renseignée **26 → 47**,
  médiane des scores 58,0 → 58,5 (donc pas d'inflation générale), un seul
  changement de classe (ONTBF B→C). Roll **surestimait** le coût (SNTS 1,41 %
  estimé contre 0,01 % réel ; STBC 3,37 contre 0,23) mais le **sous-estimait**
  ailleurs (FTSC 42→37, fourchette réelle 6,08 % ; BOAS 83→78). Seule SVOC
  reste sans fourchette. Bornes SPREAD_GOOD/BAD inchangées : les déplacer en
  même temps qu'on change de source aurait rendu l'avant/après illisible.
- **Profondeur : 11 séances seulement.** Le site n'expose qu'une dizaine de
  bulletins ; les URL anciennes existent mais leur suffixe varie (`_2` marche en
  juin, échoue en mars), donc une reprise profonde exigerait des milliers de
  requêtes dont beaucoup en 404 sur le serveur d'une institution publique —
  disproportionné. Le cron accumule à partir de maintenant.
- **Affichage** : `components/CarnetOrdres.tsx` sur la fiche société. La date de
  séance est écrite en toutes lettres (le bulletin paraît APRÈS la clôture : ces
  quantités ne sont pas l'état du marché à cet instant), le texte précise que
  seule la meilleure limite de chaque côté est publiée — ce n'est donc **pas la
  profondeur complète** — et la barre encode le rapport entre les deux côtés
  sans porter de verdict : un déséquilibre n'est pas un signal d'achat.

### Ajouts (passage 2026-09-24) — BBGC : une admission à la cote fait tomber la séance

Migration `0140_bbgc_bridge_bank.sql` **à appliquer**. tsc scraper + frontend verts,
**528 tests scraper verts** (14 nouveaux), build frontend inchangé.

- **LA PANNE.** `brvm_actions_daily.code` référence `brvm_instruments(code)`. Le
  24/09/2026 à 09:15 UTC, l'admission de **BBGC — Bridge Bank Group Côte d'Ivoire**
  (48e valeur, OPV de 10 M d'actions à 6 750 FCFA souscrite à 142 %) a fait violer
  cette clé étrangère. Comme `upsertActions` envoie le lot **en une seule requête**,
  UN code inconnu a rejeté **les 47 autres lignes** : 25 runs perdus, toute la
  séance sans cours intraday. `runIntraday` n'appelait que `ensureIndexInstruments`
  et portait le commentaire « Les instruments d'actions existent déjà ; pas besoin
  de les réécrire ici » — vrai pendant des mois, faux en une matinée.
- **Correctif structurel** : `ensureActionInstruments` (persistence/repository.ts)
  crée les actions manquantes **et elles seules**, en `ignoreDuplicates` sur un lot
  pré-filtré — une ligne existante n'est JAMAIS réécrite, sinon on écraserait
  secteur/pays du scrape quotidien (« secteur Inconnu »). Deux garde-fous, parce
  qu'une création automatique dans un cron non surveillé peut polluer le
  référentiel : un code doit être **3 à 5 majuscules** avec une désignation non
  vide, et **au plus 3 codes inédits par passage** — au-delà c'est le balisage de
  brvm.org qui a bougé, pas le marché qui a ouvert dix sociétés, et on refuse
  d'écrire. 14 tests.
- **La machine prouve, l'humain cure.** Le scraper ne reprend que la désignation
  publiée par brvm.org. Secteur, pays et famille comptable **restent nuls** : ils
  ne figurent pas sur la page des cours, les deviner produirait un fait faux.
  `runSecteurs` journalise déjà les actions sans secteur mappé — trou déclaré,
  comblé par la migration de curation.
- **OÙ ENREGISTRER UNE NOUVELLE VALEUR** (les huit registres, tous à 47 avant BBGC) :
  migration de curation dans `supabase/migrations/` · `scraper/src/refdata/runSecteurs.ts`
  (`SECTEURS`) · `scraper/src/notations/runNotations.ts` (`BRVM_CODES`) ·
  `scraper/src/dividends/sikafinance.ts` (alias curé) · `frontend/lib/brvmSectors.json` ·
  `frontend/lib/financials/sectors.ts` (`FAMILLE_PAR_CODE`) ·
  `frontend/app/notations/page.tsx` (`COMPANIES`) · `frontend/public/logos/` +
  `frontend/lib/brvmLogos.json`.
- **« Les 47 sociétés » était écrit en dur à sept endroits** et tous sont devenus
  faux le même matin. Désormais `NB_SOCIETES_COTEES` (`frontend/lib/universe.ts`),
  **dérivé** de `brvmSectors.json`. L'un des sept n'était pas qu'un libellé :
  `/dashboard` plafonnait ses sparklines à `10 * 47` lignes et aurait tronqué la
  48e valeur **en silence** — il lit maintenant le nombre réel de valeurs de la
  séance. ⚠️ **Un compte d'univers ne se saisit pas, il se dérive.**
- **Alias dividendes posé d'avance** : `/bridge bank group/` → BBGC. Sikafinance
  tronque à 20 caractères (« BRIDGE BANK GROUP CO ») ; le motif y survit. Le repli
  flou aurait peut-être suffi, mais c'est lui qui a mal attribué quatre exercices
  en 2026.
- **Lacunes assumées, à combler à la main** : pas de **logo** BBGC (dégradation
  propre — `ActionsTable` affiche les deux premières lettres), pas d'**identifiant
  portail** dans `runPublicationsBrowser.ts` (il ne s'invente pas), et **aucun
  fondamental** tant qu'aucune publication n'est en base — même situation que BICB,
  BOAB, CABC et SVOC.
- ⚠️ **La leçon générale** : un lot idempotent qui part en une seule requête
  transforme le rejet d'UNE ligne en perte de TOUT le lot. Partout où une clé
  étrangère pointe vers un référentiel curé, la donnée nouvelle doit pouvoir
  s'enregistrer seule — ou le référentiel devient un point de panne à chaque
  nouveauté du marché.

## 9. Bugs connus / limites

- **Calibrage scraping requis** : les sélecteurs CSS et noms de contrôles
  ASP.NET (login, sélecteur de date, GridView) dans `scraper/src/client/auth.ts`,
  `scrapers/activitesMarche.ts`, `parsers/*.ts` et `events/parser.ts` sont des
  **valeurs par défaut** basées sur les conventions WebForms. À confirmer sur le
  markup réel (voir `docs/SCRAPER.md` §4). Le mode `--mock` permet de tout
  développer sans cette dépendance.
- **OHLCV** : les sources (BDFIN, brvm.org) ne fournissent pas high/low intraday.
  Les bougies hebdo des indices (dashboard) sont construites avec open = clôture
  veille et close = valeur du jour (corps réel, sans mèches) — honnête, pas de
  high/low inventés. Les cours actions restent des courbes de clôture + volume.
- **SIGNAUX QUASI MUETS — calibrage des seuils (constaté le 2026-09-10).**
  Sur **3 533 signaux depuis le 1er juin**, 98 % sont `HOLD` : seulement 1,05 %
  dépassent `+0,6` et 0,82 % passent sous `-0,6`. Or `score_total` a une médiane
  de **0,011**, un 99e centile à **0,604** et un maximum à 0,821 — les seuils
  `BUY_THRESHOLD = 0.6` / `SELL_THRESHOLD = -0.6` de `scoring/score.ts` sont donc
  posés **au centile 99**. Mécanique en cause : le score est une moyenne pondérée
  de sous-scores bornés à ±1, et la moyenne écrase vers zéro. Depuis le 1er août :
  980 `HOLD`, 20 `BUY`, **aucun `SELL`**.
  ⚠️ **Ne pas « corriger » en abaissant le seuil sans décision produit** :
  descendre à ±0,45 rendrait ~13 % des signaux actionnables, c'est-à-dire
  fabriquerait des recommandations d'achat. Deux options, et le choix engage
  l'argent des utilisateurs : (a) recalibrer les seuils sur la distribution
  réelle, (b) assumer l'abstention et le dire. **L'option (b) a été appliquée au
  niveau du discours** — `PlatformUniverses` et `AppPreview` annoncent désormais
  que le moteur s'abstient tant que rien n'est net. La calibration reste ouverte.
- **mv_signal_inputs** ne matérialise que la dernière séance : le scoring d'une
  date passée précise est partiel (voir `docs/SCORING.md` §6).
- **Comparatif dividendes** : dépend de l'ingestion des dividendes (mock fourni).
- **Pas de typecheck complet exécuté** ici (deps non installées dans
  l'environnement de build) — seul un contrôle syntaxique esbuild a été fait.
  Lancer `npm run typecheck` dans chaque dossier après `npm install`.
- **lint** : `scraper` référence eslint mais sans fichier `eslint.config.js`
  (à ajouter si on veut lint). Non bloquant.
- **PANNE EMAIL SILENCIEUSE DE 7 SEMAINES (23/07 → 17/09/2026).** `RESEND_API_KEY`
  était invalide côté GitHub et **totalement absente de Vercel**. Conséquence :
  aucun email envoyé depuis le 23 juillet — `notifications_log` ne portait plus
  que du `telegram` et de la `console`. **`alerts.yml` affichait « success »
  pendant tout ce temps** : `dispatch` ne lève pas quand un canal refuse, il
  retombe sur la console. Découverte par accident, parce que le job d'envoi des
  dossiers, lui, **échoue bruyamment** (code 1 + `statut='echec'` + raison dans
  `dossier_envois`).
  ⚠️ **La leçon générale** : un workflow vert ne prouve pas qu'un message est
  parti. Tout nouveau canal doit journaliser son échec, pas seulement son
  succès. Vérifier la délivrabilité par la DONNÉE (`notifications_log`,
  `dossier_envois`), jamais par la couleur du run.
  ⚠️ **Piège de validation** : une clé Resend à portée « Sending access » ne
  peut PAS appeler `GET /domains` — elle y répond 401 tout en étant valide. Pour
  tester une clé sans rien envoyer : `POST /emails` avec un corps VIDE ; 401
  « API key is invalid » = mauvaise clé, 422 `missing_required_field` = bonne.
  Scripts de rotation : `~/.claude/resend-key.ps1` et `resend-vercel.ps1`.

## 10. Prochaines tâches prioritaires

1. **Brancher un provider de paiement live** (CinetPay ou PayDunya) : implémenter
   `lib/billing/<provider>.ts`, l'ajouter au registry, définir `PAYMENT_PROVIDER`,
   et faire appeler `activateSubscription` par le webhook du provider. Le flux
   manuel (intention + confirmation admin) fonctionne déjà. Voir `docs/ADMIN_BILLING.md` §4.
2. **Fondamentaux des 4 sociétés sans source** (BICB, BOAB, CABC, SVOC) : aucune
   publication d'états financiers en base → nécessite de fournir/scraper les PDF
   avant extraction (ne jamais inventer de chiffres).
3. ~~Planifier les workers~~ — **FAIT** (correction 2026-07-13 : cette entrée était
   périmée et m'a fait affirmer à tort qu'ils ne tournaient pas). `score`, `events`,
   `dividends`, `alerts`, `bdfin`, `veille`, `macro-bceao`… sont tous planifiés en
   **GitHub Actions** (`.github/workflows/*.yml`). **Toujours vérifier `ls .github/
   workflows/` plutôt que de se fier à cette liste.**
4. ~~Playwright~~ — **installé** (`e2e.yml`). Étendre la couverture si besoin.
5. Calibrer les sélecteurs **BDFIN** (auth Forms) si on réactive cette source ;
   `brvm.org` public est déjà calibré (parser + fixture de régression).
6. V3 module rapports : sentiment réel, corrélation événements/signaux.

> Cron intraday : déjà actif via **pg_cron + pg_net** (secret Vault `github_pat_brvm`
> déclenchant `intraday.yml`). L'historique des indices s'étoffe séance après séance.

## 11. Précautions avant modification

- **Ne jamais commiter de secret.** Identifiants uniquement en `.env.local` /
  secrets de plateforme. Le code lit l'environnement. Filet côté GitHub : la
  détection de secrets et le blocage au push sont actifs (2026-09-18) — un
  push contenant une clé reconnue est REFUSÉ. Ne jamais le contourner par
  « allow secret » sans avoir d'abord roté la clé.
- **Garder le frontend découplé de BRVM** : il ne lit que Supabase. Ne pas
  appeler le site BRVM depuis le frontend.
- **Préserver l'idempotence** des upsert (clés de conflit) — sinon doublons.
- **Toujours fournir un fallback mock / "aucune donnée"** : la base peut être
  vide ; chaque page le gère déjà.
- **Après toute modif** : `npm run typecheck` + `npm test` (scraper) ; vérifier
  que les pages gèrent l'état vide.
- **RLS** : ne pas exposer la clé `service_role` au frontend ; vérifier les
  policies si on ajoute une table user-scopée.
- **Discipline RLS (obligatoire, pentest 2026-07-09)** : toute nouvelle **table
  OU vue** touchant des données utilisateur = RLS activée **+ policy explicite**.
  Les **vues** ne doivent JAMAIS être en `SECURITY DEFINER` (elles contournent la
  RLS) → utiliser `security_invoker = true`. Sur les **fonctions** sensibles :
  `revoke execute … from public, anon, authenticated;` — **les trois**.
  ⚠️ **`from public` NE SUFFIT PAS** (erreur constatée en prod le 2026-07-13, corrigée
  par la migration `0093`) : Supabase applique un `ALTER DEFAULT PRIVILEGES … GRANT ALL
  ON FUNCTIONS TO anon, authenticated`, qui sont des grants **nominatifs aux rôles**.
  Révoquer `PUBLIC` (le pseudo-rôle « tout le monde ») ne retire pas un grant nominatif :
  les deux coexistent et le nominatif l'emporte. Résultat : `purge_auth_events()`,
  `api_usage_increment()` et `feature_usage_increment()` étaient appelables en `curl`
  anonyme **malgré** leur `revoke … from public`. Après CHAQUE migration : lancer le scan
  `get_advisors` (type security) **et** tester la table/vue avec la **clé anon**
  (`curl …/rest/v1/<objet>` sans login) avant de merger. Voir migrations
  `0079`/`0080` pour le modèle.
- **Cohérence colonnes** : un upsert doit refléter exactement les colonnes de la
  migration correspondante.

## 12. RGPD / Protection des données (by design)

SaaS traitant des données personnelles → conformité RGPD **by design**. Détail et
inventaire des traitements : `docs/RGPD.md`.

### Règles produit

- **Minimiser** les données collectées ; ne jamais ajouter un champ personnel sans
  finalité explicite.
- Prévoir une **durée de conservation** pour chaque table contenant des données
  personnelles.
- Identifier la **base légale** dès qu'une feature touche au marketing, au
  recrutement ou au profiling.
- Éviter les **SDK/traceurs tiers** non justifiés.
- Tout nouveau traitement prévoit : **information** utilisateur, **export**,
  **rectification**, **suppression**.
- Aucun **log** ne contient mot de passe, token, pièce d'identité ou donnée
  sensible (le logger scraper masque déjà les secrets).
- Les **cookies/traceurs non essentiels** sont bloqués sans consentement
  (`components/consent/` : `ConsentProvider`, `CookieBanner`, `CookiePreferences`).

### Règles techniques

- Proposer les changements **SQL avec impact RGPD** (nouvelle donnée perso → finalité,
  rétention, RLS owner, base légale).
- Vérifier **RLS, permissions, rétention, audit logs, secrets** à chaque feature.
- Droits utilisateur câblés : **export** `GET /api/account/export`, **suppression**
  `DELETE /api/account/delete` (doivent couvrir toute nouvelle table user-scopée).

### Mini-checklist obligatoire (toute nouvelle feature touchant des données perso)

> Données collectées · Finalité · Base légale · Conservation · Droits (accès/export/
> rectif/suppression) · Sécurité (RLS, service-role server-only, pas de secret en log).

## Agent skills

### Issue tracker

GitHub Issues (`ebouak/brvm-analyst-pro`, via `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Cinq rôles canoniques (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/` à la racine). See `docs/agents/domain.md`.

### Conseil avant décision irréversible (fable-advisor)

Avant de t'engager sur une décision **coûteuse à défaire**, consulte d'abord le
skill `fable-advisor` : architecture système ou workflow, schéma de base et
modèle de données, contrat d'API ou de webhook, choix de technologie ou de
prestataire, migration en production, suppression ou renommage de route.
Consulte-le aussi **avant de lancer une boucle, un cron ou une routine non
surveillée** — un défaut de conception s'y répète à chaque itération — et
lorsque tu es bloqué après deux tentatives réellement différentes.

Pourquoi c'est écrit ici : trancher seul une porte à sens unique est
exactement le mode d'échec que ce protocole évite, et le déclenchement ne doit
pas dépendre de mon appréciation du moment.

**Fable facture 2× Opus** (10 $/50 $ par MTok). Le protocole impose ses propres
plafonds : un consult par tâche, trois interactions Fable au maximum. Ne pas
l'utiliser pour de la génération de code — c'est un conseiller en lecture
seule, il rend un verdict, pas un livrable.
