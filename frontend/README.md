# BRVM Analyst Pro — Frontend (Next.js 14)

Interface d'analyse BRVM. Lit **uniquement Supabase** (jamais BDFIN
directement, cf. cahier des charges §11). Thème dark orienté finance (§10).

## Stack

- Next.js 14 (App Router) + TypeScript
- TailwindCSS (palette `#0f1117` / `#00c853` / `#f44336`, JetBrains Mono)
- Supabase Auth + base via `@supabase/ssr` (clé **anon**, soumise à la RLS)
- Recharts (graphiques — à brancher dans les modules à venir)

## Installation

```bash
cd frontend
npm install
cp .env.example .env.local   # renseigner URL + clé anon Supabase
npm run dev                  # http://localhost:3000
```

> ⚠️ Ne mettez **jamais** la clé `service_role` côté frontend. Seule la clé
> `anon` (publique, limitée par la RLS) est utilisée ici.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon (publique) |

## Structure

```
app/
  layout.tsx          Layout + sidebar
  page.tsx            Dashboard (KPI, top hausses/baisses, état marché)
  login/              Connexion (server actions) + signup/
lib/
  supabase/           Clients navigateur / serveur / middleware (SSR)
  types.ts            Types DB
  format.ts           Formatage FR / FCFA
components/
  Sidebar, KpiCard, TopMovers
middleware.ts         Rafraîchissement de session Supabase
```

## État d'avancement

Livré : config, thème, auth (login/signup + middleware), dashboard lisant
Supabase avec fallback si la base est vide.

À venir (modules du cahier des charges §5.2–5.6) : marché actions
(tableau filtrable, fiche instrument, OHLCV, RSI/MACD/MA), marché obligataire
(YTM, duration, courbe des taux), page Signaux (lecture `signals_daily` avec
bloc « Pourquoi ce signal ? »), watchlist & portefeuille (P&L, alertes — RLS
déjà en place côté base).

## Pré-requis base de données

Appliquer les migrations `../supabase/migrations` (tables + vues + RLS) et
alimenter via le scraper (`../scraper`, `npm run scrape:daily` ou `--mock`).
