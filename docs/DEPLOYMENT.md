# Déploiement & monitoring

## 1. Base de données (Supabase)

Appliquez les migrations dans l'ordre :

```bash
# via Supabase CLI
supabase db push
# ou manuellement, dans l'éditeur SQL, exécuter dans l'ordre :
#   0001_init.sql  → tables + contraintes + triggers
#   0002_views.sql → vues matérialisées + refresh_market_views()
#   0003_rls.sql   → Row Level Security (lecture publique marché, privé user)
#   0004_cron.sql  → pg_cron (optionnel, voir ci-dessous)
```

## 2. Scraper — options de planification

### Option A (recommandée) : cron externe appelant le worker Node

Le worker tourne mieux en environnement Node complet (cookie jar, axios).
Planifiez-le via **GitHub Actions** ou **Vercel Cron** :

`.github/workflows/scrape.yml` (exemple) :

```yaml
name: scrape-bdfin
on:
  schedule:
    - cron: '0 18 * * 1-5'   # 18h00 UTC, lun-ven (après clôture BRVM)
  workflow_dispatch:
    inputs:
      date: { description: 'Date à reprendre (YYYY-MM-DD)', required: false }
jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd scraper && npm ci
      - run: |
          cd scraper
          if [ -n "${{ inputs.date }}" ]; then
            npm run scrape:date -- "${{ inputs.date }}"
          else
            npm run scrape:daily
          fi
        env:
          BDFIN_BASE_URL: ${{ secrets.BDFIN_BASE_URL }}
          BDFIN_USERNAME: ${{ secrets.BDFIN_USERNAME }}
          BDFIN_PASSWORD: ${{ secrets.BDFIN_PASSWORD }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

> Tous les secrets vont dans **GitHub → Settings → Secrets and variables →
> Actions**. Jamais dans le repo.

### Option B : pg_cron + Edge Function

`0004_cron.sql` planifie un `net.http_post` vers une Edge Function
`scrape-daily`. Cette piste est viable si vous portez la logique de scraping
en Deno (Edge Functions). Tenez compte des limites de durée d'exécution.

## 3. Rafraîchissement des vues

Après chaque run, rafraîchissez les vues matérialisées :

```sql
select public.refresh_market_views();
```

`0004_cron.sql` le planifie à 18h05 UTC. Vous pouvez aussi l'appeler depuis le
worker après l'upsert (via une RPC Supabase) si vous préférez le couplage.

## 4. Frontend (Vercel)

Le frontend Next.js ne lit QUE Supabase (jamais BDFIN directement, §11).
Variables côté frontend : `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé anon, soumise à la RLS). La clé
`service_role` ne doit JAMAIS être exposée au frontend.

## 5. Monitoring (§12.8)

Indicateurs à surveiller, tous dérivés de `scrape_runs` :

```sql
-- Dernier run par jour, statut et comptages
select date_marche, status, nb_actions, nb_obligations, nb_indices,
       finished_at, message_erreur
from scrape_runs
order by created_at desc
limit 30;

-- Alerte : aucun run "success" aujourd'hui
select count(*) = 0 as manque_run_du_jour
from scrape_runs
where date_marche = current_date and status = 'success';

-- Alerte : chute anormale du nombre d'actions (markup cassé ?)
select date_marche, nb_actions
from scrape_runs
where status in ('success','partial')
order by created_at desc limit 10;
```

Recommandations :
- Faites échouer le job CI (exit code 1) si le run échoue → notification
  GitHub/Vercel native.
- Branchez une alerte (email/Slack/Telegram, cf. §6.8) sur `status='failed'`
  ou `nb_actions` anormalement bas.
- Surveillez `hash_source` identique plusieurs jours → séance non publiée ou
  scraping figé.

## 6. Planification des workers complémentaires

En plus du scraping de séance, planifier (cron externe ou pg_cron + Edge) :

```yaml
# Exemples de cadence (UTC, jours ouvrés)
score:      "10 18 * * 1-5"   # après le scraping de séance
events:     "30 18 * * 1-5"   # ingestion des communiqués/avis
dividends:  "40 18 * * 1-5"   # dérivation depuis les événements
alerts:     "*/30 9-17 * * 1-5"  # évaluation fréquente en séance
```

Chaque commande (`npm run score`, `events`, `dividends`, `alerts`) renvoie un
code de sortie exploitable par le planificateur. Les notifications d'alertes
utilisent les canaux configurés (`RESEND_API_KEY`, `TELEGRAM_*`) avec repli
console. Le journal `notifications_log` permet l'audit et l'anti-spam
(`alerts.declenchee_le`).
