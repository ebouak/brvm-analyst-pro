# BRVM Analyst Pro — Scraper BDFIN

Worker Node.js (TypeScript) qui collecte les données du portail **BDFIN BRVM**
(`https://bfin.brvm.org/Activites_marche.aspx`, ASP.NET WebForms), les valide,
puis les écrit dans Supabase. Découplé du frontend (cf. §6.5, §11).

## Prérequis

- Node.js >= 20
- Un projet Supabase avec les migrations appliquées (`../supabase/migrations`)

## Installation

```bash
cd scraper
npm install
cp .env.example .env.local   # puis renseigner les secrets
```

> ⚠️ **Sécurité.** Ne mettez jamais d'identifiant en clair dans le code ou
> dans Git. Les secrets vivent uniquement dans `.env.local` (ignoré par Git)
> ou dans le gestionnaire de secrets de votre plateforme (cf. §6.6).

## Variables d'environnement

Voir `.env.example` pour la liste complète et commentée. Les essentielles :

| Variable | Rôle |
|---|---|
| `BDFIN_BASE_URL` | Base du portail (`https://bfin.brvm.org`) |
| `BDFIN_USERNAME` / `BDFIN_PASSWORD` | Identifiants BDFIN (secrets) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Cible d'écriture (clé serveur) |
| `USE_MOCK` | `true` => données fictives, aucun appel BDFIN |
| `DRY_RUN` | `true` => ne rien écrire en base |
| `QUALITY_STRICT` | `true` => rejette l'écriture si la validation échoue |

## Utilisation

```bash
# Séance courante (dernière séance publiée)
npm run scrape:daily

# Sans BDFIN, données mock (dev frontend / CI)
npm run scrape:daily:mock

# Reprise d'une date précise (cf. §6.5 / docs/RECOVERY.md)
npm run scrape:date -- 2025-05-20

# Tests des parsers
npm test

# Vérification de types
npm run typecheck
```

Codes de sortie : `0` = success/partial/mock, `1` = échec (utile pour un cron).

## Architecture

```
src/
  index.ts                 CLI (daily | date <YYYY-MM-DD>)
  config.ts                Config validée (zod), assertions de secrets
  logger.ts                Logs structurés (pino), secrets masqués
  client/
    http.ts                Axios + cookie jar (tough-cookie) — session ASP.NET
    aspnet.ts              Extraction/reconstruction __VIEWSTATE & co
    auth.ts                Flux de login Forms + détection session expirée
  scrapers/
    activitesMarche.ts     Scrape séance courante / date via postback
  parsers/
    table.ts               Mapping colonnes par libellé d'en-tête (2 passes)
    actions.ts             Tableau actions
    obligations.ts         Tableau obligations
    indices.ts             Indices (tableau ou labels)
  persistence/
    supabase.ts            Client service_role
    repository.ts          Upsert idempotent (code,date) + scrape_runs
  utils/
    parseNumber.ts         Normalisation nombres FR (espaces, virgules, %)
    dates.ts               Dates marché / parsing FR -> ISO
    retry.ts               Backoff exponentiel + jitter
    hash.ts                SHA-256 du HTML source
    validators.ts          Contrôle qualité (§6.3) + déduplication
  mock/fixtures.ts         Données mock (§6.4)
tests/                     Tests vitest + fixture HTML
```

## Pipeline d'un run

```
login → scrape (GET/POST WebForms) → parse → validate (qualité) →
upsert Supabase (idempotent) → log scrape_runs
```

En cas de source indisponible, basculez sur `--mock`. Toute exécution est
journalisée dans `scrape_runs`, y compris les échecs.

## ⚠️ Calibrage requis avant production

Les sélecteurs CSS des tableaux et les **noms des contrôles ASP.NET**
(champs de login, sélecteur de date) sont des valeurs **par défaut basées sur
les conventions WebForms**. Ils doivent être confirmés sur le markup réel.
Voir `../docs/SCRAPER.md` section « Calibrage ».
