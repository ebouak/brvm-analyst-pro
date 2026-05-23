# BRVM Analyst Pro

Plateforme d'analyse et d'aide à la décision d'investissement sur la **BRVM**
(Bourse Régionale des Valeurs Mobilières, UEMOA) : actions, obligations,
indices, signaux d'opportunité, watchlist/portefeuille, rapports & événements.

> 📌 Nouveau sur le projet ? Lisez **[CLAUDE.md](./CLAUDE.md)** (guide technique)
> et **[HANDOFF.md](./HANDOFF.md)** (reprise pas à pas).

## Architecture

Deux applications **découplées** :

- **[`scraper/`](./scraper)** — worker Node.js/TypeScript : collecte BDFIN BRVM
  (ASP.NET WebForms), scoring, ingestion événements & dividendes, évaluation
  d'alertes. Écrit dans Supabase.
- **[`frontend/`](./frontend)** — Next.js 14 (App Router) : lit **uniquement**
  Supabase (jamais BRVM directement). Thème dark finance.
- **[`supabase/migrations/`](./supabase/migrations)** — schéma PostgreSQL + vues
  + RLS + cron (0001 → 0006).
- **[`docs/`](./docs)** — documentation technique détaillée.

## Démarrage rapide

Voir [HANDOFF.md](./HANDOFF.md#démarrer-en-5-minutes-sans-bdfin-réel) pour la
procédure complète avec données mock (sans accès BDFIN réel).

```bash
# Base
supabase db push                          # applique supabase/migrations/*

# Scraper
cd scraper && npm install && cp .env.example .env.local
npm run scrape:daily:mock && npm run score:mock && npm test

# Frontend
cd ../frontend && npm install && cp .env.example .env.local
npm run dev                               # http://localhost:3000
```

## Documentation

| Doc | Contenu |
|---|---|
| [docs/SCRAPER.md](./docs/SCRAPER.md) | Scraping ASP.NET, calibrage, robustesse, sécurité |
| [docs/SCORING.md](./docs/SCORING.md) | Algorithme de scoring §9 + explicabilité |
| [docs/REPORTS.md](./docs/REPORTS.md) | Module rapports & événements, event-study, obligataire |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Migrations, planification (cron), monitoring |
| [docs/RECOVERY.md](./docs/RECOVERY.md) | Procédure de reprise / backfill |

## Sécurité

Secrets uniquement en variables d'environnement (jamais commités). La clé
Supabase `service_role` est réservée au scraper backend ; le frontend utilise la
clé `anon` soumise à la **RLS**. Voir CLAUDE.md §11.

## Statut

Voir [CLAUDE.md §8](./CLAUDE.md) (état actuel) et §10 (prochaines tâches —
notamment le **backtesting**, non encore implémenté).
