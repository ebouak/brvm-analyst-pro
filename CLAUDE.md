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
  spread `null` si non estimable (cov ≥ 0) → composante neutre. Le carnet
  d'ordres n'étant pas publié par la BRVM, profondeur et coût d'exécution sont
  **estimés**, jamais inventés.
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

### Ajouts (passage 2026-09-08) — Flottant et volume moyen 30 j

- **`flottant` et `vol_moyen_30j` (0/335 depuis la migration `0020`) sont
  remplis** : 47 actions sur 48 (SVOC n'a pas de page richbourse — même trou
  que ses fondamentaux). Le module `runDetails` existait et écrivait déjà ces
  colonnes ; il prenait **403 sur chaque appel** (chaîne d'agent périmée) et
  n'était **planifié dans aucun workflow**.
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
- **mv_signal_inputs** ne matérialise que la dernière séance : le scoring d'une
  date passée précise est partiel (voir `docs/SCORING.md` §6).
- **Comparatif dividendes** : dépend de l'ingestion des dividendes (mock fourni).
- **Pas de typecheck complet exécuté** ici (deps non installées dans
  l'environnement de build) — seul un contrôle syntaxique esbuild a été fait.
  Lancer `npm run typecheck` dans chaque dossier après `npm install`.
- **lint** : `scraper` référence eslint mais sans fichier `eslint.config.js`
  (à ajouter si on veut lint). Non bloquant.

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
  secrets de plateforme. Le code lit l'environnement.
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
