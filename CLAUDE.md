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

1. **Activer le cron intraday en prod** : ajouter les secrets repo GitHub
   `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Settings → Secrets → Actions).
   Le workflow `.github/workflows/intraday.yml` existe déjà ; sans secrets il
   échoue à l'écriture mais ne corrompt rien. L'historique des indices s'étoffera
   séance après séance → active RSI(14)/MACD sur les graphiques hebdo.
2. **Fondamentaux des 4 sociétés sans source** (BICB, BOAB, CABC, SVOC) : aucune
   publication d'états financiers en base → nécessite de fournir/scraper les PDF
   avant extraction (ne jamais inventer de chiffres).
3. Planifier les autres workers (cron) : `score`, `events`, `dividends`, `alerts`,
   refresh des vues — même mécanique GitHub Actions que l'intraday.
4. Tests d'intégration frontend (Playwright). `npm run build` Next est désormais
   exécuté à chaque passage (vert).
5. Calibrer les sélecteurs **BDFIN** (auth Forms) si on réactive cette source ;
   `brvm.org` public est déjà calibré (parser + fixture de régression).
6. V3 module rapports : sentiment réel, corrélation événements/signaux.

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
- **Cohérence colonnes** : un upsert doit refléter exactement les colonnes de la
  migration correspondante.
