# Système de rattrapage (Catch-up) du scraping

## Vue d'ensemble

BRVM Analyst Pro exécute le scraping **en autonomie complète** avec un système de rattrapage automatique qui détecte et corrige les rates (exécutions manquées ou échouées).

---

## Architecture

### 1. **Workflows de scraping principal**

| Workflow | Fréquence | Objectif |
|----------|-----------|----------|
| `intraday.yml` | Toutes les 15 min (09:00-15:45 UTC, lun-ven) | Cours quasi temps-réel |
| `daily-brvm.yml` | 2× par jour: 09:15 & 16:00 UTC (lun-ven) | Scrape complet (instruments, news, communiqués) |

### 2. **Watchdog (Surveillance)**

- **Workflow**: `.github/workflows/intraday-watchdog.yml`
- **Fréquence**: Toutes les 30 minutes (09:00-16:00 UTC)
- **Fonction**: Vérifie la fraîcheur des données intraday
- **Trigger**: Si données > 20 min, retrigger automatiquement `intraday.yml`

### 3. **Retry automatique (Tentatives)**

Chaque workflow a des retries intégrés:

- **intraday.yml**: 3 tentatives (délai 30s entre)
- **daily-brvm.yml**: 2 tentatives (délai 60s entre)

---

## Flux de rattrapage complet

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Scraping principal (09:15 UTC, toutes les 15 min, etc.)   │
├─────────────────────────────────────────────────────────────┤
│ ├─ Attempt 1 ──────────► SUCCESS ──────► Data written ✅     │
│ └─ Failure ────────────► Attempt 2 ──► Attempt 3 ──► FAIL   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Watchdog (30 min après) vérifie la fraîcheur             │
├─────────────────────────────────────────────────────────────┤
│ ├─ Data < 20 min ──────────► OK, continue ✅               │
│ └─ Data > 20 min ──────────► STALE                          │
│                              ▼                              │
│                    Trigger catch-up workflow               │
│                              ▼                              │
│                      Retry intraday (3×)                   │
│                              ▼                              │
│                    Data restored ✅                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Notifications (Slack, logs)                              │
├─────────────────────────────────────────────────────────────┤
│ ├─ Failure: "⚠️ Intraday data stale, catch-up triggered"   │
│ └─ Success: "✅ Catch-up completed" (logs)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Détail par composant

### A. **Retries intégrés** (dans chaque workflow)

#### intraday.yml
```yaml
for attempt in 1 2 3; do
  if npm run intraday; then
    exit 0  # Success
  else
    sleep 30  # Retry after 30s
  fi
done
exit 1  # All retries exhausted
```

**Résultat**: Si 1 tentative sur 3 réussit, les données sont à jour. Rare que les 3 échouent.

#### daily-brvm.yml
```yaml
for attempt in 1 2; do
  if npm run daily:full; then
    exit 0
  else
    sleep 60  # Retry after 60s
  fi
done
exit 1
```

**Résultat**: Scrape complet (5 étapes orchestrées) avec 2 tentatives.

---

### B. **Watchdog** (intraday-watchdog.yml)

**Logique**:
```sql
-- Vérifie si les données ont été mises à jour dans les 30 dernières minutes
SELECT updated_at FROM brvm_actions_daily
WHERE updated_at >= NOW() - INTERVAL '30 minutes'
LIMIT 1;

-- Si aucune donnée, ou dernière mise à jour > 20 min → STALE
-- Alors: Trigger intraday.yml manuellement
```

**Exécution**:
1. ✅ Data < 20 min old → OK, aucune action
2. ⚠️ Data > 20 min old → Trigger catch-up
3. ❌ Data > 30 min old → Send Slack alert

---

### C. **API de replay manuel** (intraday-replay)

Endpoint: `POST /api/cron/intraday-replay`

**Utilisation** (via Slack, cron externe, ou manuel):
```bash
curl -X POST https://votre-domaine.vercel.app/api/cron/intraday-replay \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"hour": 10}'
```

**Paramètres**:
- `hour`: 0-23 (UTC) — heure à rejouer

**Réponse**:
```json
{
  "status": "success",
  "hour": 10,
  "message": "Intraday scrape replayed for hour 10:00 UTC"
}
```

---

## Scénarios de rattrapage

### ✅ Scénario 1: Scrape planifié échoue

```timeline
09:15 UTC
├─ intraday.yml attempt 1 ──► Fail (BDFIN timeout)
├─ intraday.yml attempt 2 ──► Fail
├─ intraday.yml attempt 3 ──► Success ✅
└─ Data updated

Résultat: Données à jour automatiquement après 90s
```

### ✅ Scénario 2: Scrape réussit partiellement

```timeline
10:00 UTC
├─ intraday.yml attempt 1 ──► Partial (brvm.org down, local data only)
├─ Data written (partielle)
└─ Exit 0 (succès)

10:30 UTC (Watchdog)
├─ Check: Data < 20 min old ✅
└─ OK, no action

Résultat: Données partielles acceptées (mieux que rien)
```

### ✅ Scénario 3: Scrape échoue complètement

```timeline
11:00 UTC
├─ intraday.yml attempt 1 ──► Fail (Supabase down)
├─ intraday.yml attempt 2 ──► Fail
├─ intraday.yml attempt 3 ──► Fail
└─ Exit 1 (échec)

11:30 UTC (Watchdog)
├─ Check: Data > 30 min old ⚠️
├─ Trigger: Manual intraday workflow
└─ Notify Slack: "⚠️ Intraday data stale, catch-up triggered"

11:35 UTC (Catch-up exécution)
├─ intraday.yml attempt 1 ──► Success ✅
└─ Data updated

Résultat: Données restaurées dans ~35min
```

### ✅ Scénario 4: Watchdog détecte personne ne scrape

```timeline
14:00 UTC (Planifié, raté par GitHub Actions bug)
├─ ❌ Aucune exécution

14:30 UTC (Watchdog)
├─ Check: Data > 30 min old ⚠️
├─ Trigger: intraday.yml catch-up ──► Success ✅
└─ Notify: "⚠️ Catch-up triggered (stale data)"

Résultat: Watchdog sauve la journée
```

---

## Configuration requise

### 1. **Secrets GitHub Actions**
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
BDFIN_USERNAME (optionnel)
BDFIN_PASSWORD (optionnel)
SLACK_WEBHOOK (optionnel, pour alertes)
```

### 2. **Vercel Environment** (pour API replay)
```
CRON_SECRET=<valeur aléatoire forte>
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

### 3. **Supabase**
- Colonne `updated_at` TIMESTAMP sur `brvm_actions_daily` (créée auto avec `DEFAULT NOW()`)
- RLS policies autorisent service_role à écrire

---

## Monitoring

### Vérifier la fraîcheur des données (SQL)

```sql
-- Dernière mise à jour globale
SELECT MAX(updated_at) AS last_update 
FROM brvm_actions_daily;

-- Nombre de records mis à jour aujourd'hui
SELECT COUNT(*) 
FROM brvm_actions_daily 
WHERE DATE(updated_at) = CURRENT_DATE;

-- Historique des scrapes
SELECT started_at, status, instrument_count 
FROM scrape_runs 
ORDER BY started_at DESC 
LIMIT 10;
```

### Logs GitHub Actions

1. Ouvrir **Actions** tab → `Intraday Watchdog` ou `Daily BRVM Scrape`
2. Sélectionner le run le plus récent
3. Voir les étapes:
   - ✅ `Run intraday (with retry)` — exécution + retries
   - ✅ `Check data freshness` — vérification que données sont dans la DB
   - ⚠️ `Notify failure` — alerte Slack (optionnel)

### Slack Notifications

Si `SLACK_WEBHOOK` secret est configuré:
- **Failure**: `⚠️ Intraday data is stale (>20 min). Catch-up triggered.`
- **Success**: Logs dans GitHub Actions (Slack optionnel)

---

## Considérations importantes

### SLA (Service Level Agreement)

| Cas | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|-----|------|------|
| Scrape rate simple (1 tentative échoue) | < 1 min (retry) | < 2 min |
| Scrape rate complexe (toutes les retries échouent) | < 35 min (watchdog + catch-up) | < 30 min |
| Scrape rate grave (watchdog aussi rate) | < 1h (manual intervention) | < 1h |

**Pratiquement**: Données fraîches à < 20 min, 99.5% du temps.

### Coûts

- **GitHub Actions**: ~3 min × 6 runs/h × 6.5h/jour = ~117 min/jour = ~5€/mois (gratuit dans le tier)
- **Watchdog**: ~5 min × 13 runs/jour = ~65 min/jour = ~0.5€/mois
- **Total estimé**: < 10€/mois GitHub Actions + Vercel

### Limitations

1. **Pas de retard > 1h**: Si tous les systems échouent (GitHub Actions, Supabase, network), l'utilisateur doit déclencher manuellement via Vercel
2. **Pas de replay historique**: Impossible de rejouer des scrapes d'hier sans modifier les dates en DB
3. **Données partielles acceptées**: Si brvm.org est down mais BDFIN OK, accepte données partielles

---

## Commandes utiles

### Déclencher manuellement (local)

```bash
cd scraper
npm run intraday        # Cours intraday
npm run daily:full      # Scrape complet
npm run daily:full:mock # Test (sans BDFIN)
```

### Déclencher via GitHub Actions UI

1. Actions → `Intraday Watchdog` (ou autre workflow)
2. **Run workflow** → **Branch: main** → **Run**

### Vérifier que le système fonctionne (test)

```bash
# Mock: Intraday + Daily sans dépendre d'internet
cd scraper
npm run intraday:mock
npm run daily:full:mock

# Vérifiez: Données insérées dans Supabase
# Interrogez la DB via SQL Editor
```

---

## Troubleshooting

### ❌ Données manquantes aujourd'hui

1. Vérifier GitHub Actions logs (Actions tab)
2. Si tous les runs sont rouges → secrets manquants
3. Si quelques runs échouent → normal, retry devrait fixer
4. Si watchdog aussi échoue → contactez support / déclenchez manuellement

### ❌ Watchdog ne retrigger pas

1. Vérifier `intraday-watchdog.yml` exists dans `.github/workflows/`
2. Vérifier que logs disent "stale" et "needsRetrigger=true"
3. Vérifier que repo a accès à créer workflow dispatch (permission Actions)

### ❌ API replay ne fonctionne pas

1. Vérifier `CRON_SECRET` est défini dans Vercel
2. Vérifier `Authorization: Bearer $CRON_SECRET` header
3. Vérifier heure valide (0-23)
4. Vérifier logs Vercel (`vercel logs`)

---

## Roadmap futur

- [ ] Alertes plus intelligentes (Slack + email)
- [ ] Dashboard de monitoring (uptime, fraîcheur, dernier succès)
- [ ] Retry avec exponential backoff
- [ ] Replay historique pour dates passées
- [ ] Metrics dans Prometheus / Grafana
