# HANDOFF.md — Reprise du projet BRVM Analyst Pro

Document de passation. Objectif : permettre à quelqu'un (ou à Claude Code)
de reprendre le travail sans contexte préalable. Compagnon de `CLAUDE.md`.

## Ce qu'est le projet

Plateforme d'analyse d'investissement sur la BRVM (UEMOA), en deux applications
découplées : un **scraper/worker Node** qui alimente **Supabase**, et un
**frontend Next.js 14** qui lit Supabase. Le cahier des charges initial (scraper,
scoring, dashboard, actions, obligations, watchlist/portefeuille) et le
« Module 6 » (rapports & événements) ont été implémentés, plus dividendes et
alertes. Reste principalement le **backtesting**.

## Comment c'est construit (le mental model)

1. Le **scraper** se connecte à BDFIN (ASP.NET WebForms : cookie jar + champs
   cachés `__VIEWSTATE`/`__EVENTVALIDATION` rejoués à chaque postback), parse
   les tableaux par libellé d'en-tête, valide la qualité, puis **upsert
   idempotent** dans Supabase et journalise dans `scrape_runs`.
2. Des commandes dédiées calculent/ingèrent par-dessus ces données :
   `score` (signaux explicables), `events` (communiqués BRVM), `dividends`,
   `alerts` (évaluation + notifications). Toutes ont un mode `--mock`.
3. Le **frontend** ne fait que lire Supabase (clé anon, RLS). La logique
   analytique (indicateurs, event-study, narration, obligations) vit dans
   `frontend/lib/` sous forme de fonctions pures réutilisées par les pages et
   les route handlers `/api`.

## Démarrer en 5 minutes (sans BDFIN réel)

```bash
# 1. Base : créer un projet Supabase, appliquer les migrations dans l'ordre
#    supabase/migrations/0001 → 0006 (CLI `supabase db push` ou éditeur SQL).

# 2. Scraper : alimenter la base avec des données mock
cd scraper && npm install && cp .env.example .env.local
#   renseigner SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (USE_MOCK=true possible)
npm run scrape:daily:mock      # actions/obligations/indices fictifs
npm run score:mock             # signaux de démonstration
npm run events:mock            # événements
npm run dividends:mock         # dividendes
npm test                       # vérifier que tout passe (32 tests)

# 3. Frontend
cd ../frontend && npm install && cp .env.example .env.local
#   renseigner NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                    # http://localhost:3000
```

> Note : `scrape:daily:mock` n'écrit en base que si `SUPABASE_*` sont fournis ;
> sinon `DRY_RUN=true` affiche seulement. Pour peupler réellement la base de
> démo, fournir les clés Supabase et laisser `--mock` faire les données.

## Carte des écrans (frontend)

| Route | Rôle |
|---|---|
| `/` | Dashboard (KPI, top movers, état marché) |
| `/actions`, `/actions/[code]`, `/actions/compare` | Marché actions, fiche, comparaison |
| `/obligations` | YTM, duration, courbe des taux, comparatif dividendes |
| `/signaux` | Signaux BUY/HOLD/SELL filtrables + « Pourquoi ? » |
| `/portefeuille` | Positions (PRU, P&L latent), watchlist, alertes (auth) |
| `/dashboard/reports` + sous-pages | Rapports instrument/secteur/événement/marché |
| `/login`, `/signup` | Auth Supabase |

## Où intervenir selon la tâche

- Changer la formule de scoring → `scraper/src/scoring/score.ts` (params en tête).
- Calibrer le scraping → `docs/SCRAPER.md` §4 + constantes dans `client/auth.ts`,
  `scrapers/activitesMarche.ts`, `parsers/*.ts`.
- Ajouter un indicateur → `frontend/lib/indicators.ts` (+ test côté scraper).
- Ajouter une page rapport → `frontend/lib/reports.ts` (builder) + route + page.
- Ajouter un canal de notification → `scraper/src/alerts/channels.ts`.

## Prochaine tâche concrète : Backtesting (non fait)

Brief pour démarrer directement :
1. `frontend/lib/backtest.ts` (fonction pure) : entrée = série de clôtures +
   tableau de signaux alignés (ou règle de signal) ; sortie = equity curve,
   rendement total/annualisé, volatilité, **max drawdown**, win rate, nombre de
   trades, comparaison **buy & hold**. Long-only : entrer à BUY, sortir à
   SELL/HOLD.
2. Test vitest sur une série connue (tendance haussière => stratégie ≈ B&H).
3. CLI `scraper/src/index.ts` commande `backtest <CODE>` : tire l'historique de
   `brvm_actions_daily`, recalcule le signal jour par jour via
   `scoring/score.ts` en fenêtre glissante, applique `backtest.ts`, affiche les
   métriques.
4. Page `/backtest` : sélection d'un titre + période, courbe d'équité (Recharts)
   et tableau de métriques. Optionnel : table `backtest_runs` pour sauvegarder.

## Ce qui manque pour une reprise 100% propre

Voir la section dédiée en fin de réponse / `CLAUDE.md` §9. En résumé :
- pas de `package-lock.json` commité (lancer `npm install` régénère) ;
- typecheck/build réels non exécutés ici (deps non installées dans l'environnement) ;
- sélecteurs BDFIN/brvm.org à calibrer sur le markup réel ;
- pas encore de CI, ni de fichier `eslint.config.js`, ni de tests frontend.
