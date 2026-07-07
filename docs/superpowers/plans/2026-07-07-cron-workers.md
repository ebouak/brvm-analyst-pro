# Cron Workers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate 4 scraper pipelines (score, events, dividends, alerts) via GitHub Actions scheduled cron jobs, with monitoring logs written to `scraper_runs` table and visible on `/admin/scraping` dashboard.

**Architecture:** Each of the 4 pipelines follows the **intraday pattern** (`.github/workflows/intraday.yml`): scheduled cron trigger → GitHub Actions checkout/setup/install → npm run command with 3-attempt retry → data freshness check → optional Slack notification on failure. Monitoring module (`scraper/src/monitoring/`) already instruments all commands; each run writes to `scraper_runs` table keyed by `(code, status, trigger)`. No new API endpoints required — frontend `/admin/scraping` dashboard already reads from this table.

**Tech Stack:** GitHub Actions (workflow YAML), Node.js 22, TypeScript, @supabase/supabase-js, pg_cron (optional fallback, not part of this PR).

---

## File Structure

**Files to create:**
- `.github/workflows/score.yml` — Daily scoring pipeline (runs after market close ~16:00 UTC)
- `.github/workflows/events.yml` — Daily events ingestion (runs morning ~08:00 UTC)
- `.github/workflows/dividends.yml` — Weekly dividends ingestion (runs Saturday ~09:00 UTC)
- `.github/workflows/alerts.yml` — Daily alerts evaluation (runs after market close ~16:30 UTC)

**Files to modify:**
- `.github/workflows/intraday.yml` — No changes; serves as reference model
- `scraper/package.json` — Already has all 4 npm run scripts; no changes needed
- `scraper/src/monitoring/` — Already captures runs; no changes needed
- `docs/DEPLOYMENT.md` — Add scheduling table for each worker
- `.github/secrets` — Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set (verify, don't create)

---

## Task Breakdown

### Task 1: Create score.yml Workflow

**Files:**
- Create: `.github/workflows/score.yml`

**Context:**
The scoring pipeline calculates technical/momentum signals for all instruments and stores them in `signals_daily` table. It's compute-intensive but needs fresh data daily. Run **after market close** (~16:00 UTC / 17:00 BRVM Abidjan time) when final OHLCV for the day is available.

- [ ] **Step 1: Create the score.yml file**

```yaml
name: Daily Scoring Pipeline

env:
  SCRAPER_TRIGGER: ${{ github.event_name == 'schedule' && 'cron' || 'manual' }}

on:
  schedule:
    # Après clôture séance BRVM (15:00 UTC Abidjan = 16:00 UTC GMT).
    # Planifié à 16:00 UTC, 6 jours/semaine (lun-sam, inclut samedi pour les signaux du lundi).
    - cron: '0 16 * * 1-6'
  workflow_dispatch: {}

concurrency:
  group: scoring
  cancel-in-progress: false

jobs:
  score:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      max-parallel: 1
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
      - name: Install scraper deps
        working-directory: scraper
        run: npm install

      - name: Run scoring with retry
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LOG_LEVEL: info
        run: |
          MAX_RETRIES=3
          RETRY_DELAY=45
          for attempt in $(seq 1 $MAX_RETRIES); do
            echo "Attempt $attempt/$MAX_RETRIES..."
            if npm run score; then
              echo "✅ Scoring pipeline succeeded"
              exit 0
            else
              if [ $attempt -lt $MAX_RETRIES ]; then
                echo "⚠️ Attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
              fi
            fi
          done
          echo "❌ Scoring pipeline failed after $MAX_RETRIES attempts"
          exit 1

      - name: Verify signals written
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        if: success()
        run: npx tsx scripts/verify-data.ts score

      - name: Notify failure on Slack
        if: failure()
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
        run: |
          if [ -n "$SLACK_WEBHOOK" ]; then
            curl -X POST "$SLACK_WEBHOOK" \
              -H 'Content-Type: application/json' \
              -d "{\"text\":\"⚠️ Daily Scoring FAILED after 3 retries at $(date -u +'%H:%M UTC'). Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"}"
          fi
```

- [ ] **Step 2: Run GitHub Actions linter (optional)**

```bash
cd .github/workflows && yamllint score.yml 2>&1 || true
```

Expected: No fatal errors (warnings are OK).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/score.yml
git commit -m "ci(cron): add daily scoring pipeline workflow"
```

---

### Task 2: Create events.yml Workflow

**Files:**
- Create: `.github/workflows/events.yml`

**Context:**
Events ingestion parses press releases, dividends announcements, and other corporate news from BDFIN. It's I/O-bound and benefits from running **early in the morning** (~08:00 UTC) before traders check news. Run 6 days/week (lun-sam) to catch any weekend announcements published on Monday morning.

- [ ] **Step 1: Create the events.yml file**

```yaml
name: Daily Events Ingestion

env:
  SCRAPER_TRIGGER: ${{ github.event_name == 'schedule' && 'cron' || 'manual' }}

on:
  schedule:
    # Tôt le matin, avant ouverture séance (09:00 UTC Abidjan = 08:00 UTC GMT).
    # Lun-sam pour capturer les annonces du week-end.
    - cron: '0 8 * * 1-6'
  workflow_dispatch: {}

concurrency:
  group: events-ingestion
  cancel-in-progress: false

jobs:
  events:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      max-parallel: 1
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
      - name: Install scraper deps
        working-directory: scraper
        run: npm install

      - name: Run events ingestion with retry
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LOG_LEVEL: info
        run: |
          MAX_RETRIES=3
          RETRY_DELAY=30
          for attempt in $(seq 1 $MAX_RETRIES); do
            echo "Attempt $attempt/$MAX_RETRIES..."
            if npm run events; then
              echo "✅ Events ingestion succeeded"
              exit 0
            else
              if [ $attempt -lt $MAX_RETRIES ]; then
                echo "⚠️ Attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
              fi
            fi
          done
          echo "❌ Events ingestion failed after $MAX_RETRIES attempts"
          exit 1

      - name: Verify events written
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        if: success()
        run: npx tsx scripts/verify-data.ts events

      - name: Notify failure on Slack
        if: failure()
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
        run: |
          if [ -n "$SLACK_WEBHOOK" ]; then
            curl -X POST "$SLACK_WEBHOOK" \
              -H 'Content-Type: application/json' \
              -d "{\"text\":\"⚠️ Daily Events Ingestion FAILED after 3 retries at $(date -u +'%H:%M UTC'). Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"}"
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/events.yml
git commit -m "ci(cron): add daily events ingestion workflow"
```

---

### Task 3: Create dividends.yml Workflow

**Files:**
- Create: `.github/workflows/dividends.yml`

**Context:**
Dividends ingestion parses dividend announcements and calculates dividend yields. It's **less frequent** (weekly is sufficient) because dividend announcements don't change intra-week. Run **Saturday morning** (~09:00 UTC) to give time for any Friday announcements to be published, and to have fresh dividend data for the Monday portfolio analysis.

- [ ] **Step 1: Create the dividends.yml file**

```yaml
name: Weekly Dividends Ingestion

env:
  SCRAPER_TRIGGER: ${{ github.event_name == 'schedule' && 'cron' || 'manual' }}

on:
  schedule:
    # Samedi matin pour capturer les annonces de dividendes de la semaine.
    # 09:00 UTC = 10:00 UTC+1.
    - cron: '0 9 * * 6'
  workflow_dispatch: {}

concurrency:
  group: dividends-ingestion
  cancel-in-progress: false

jobs:
  dividends:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      max-parallel: 1
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
      - name: Install scraper deps
        working-directory: scraper
        run: npm install

      - name: Run dividends ingestion with retry
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LOG_LEVEL: info
        run: |
          MAX_RETRIES=2
          RETRY_DELAY=30
          for attempt in $(seq 1 $MAX_RETRIES); do
            echo "Attempt $attempt/$MAX_RETRIES..."
            if npm run dividends; then
              echo "✅ Dividends ingestion succeeded"
              exit 0
            else
              if [ $attempt -lt $MAX_RETRIES ]; then
                echo "⚠️ Attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
              fi
            fi
          done
          echo "❌ Dividends ingestion failed after $MAX_RETRIES attempts"
          exit 1

      - name: Verify dividends written
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        if: success()
        run: npx tsx scripts/verify-data.ts dividends

      - name: Notify failure on Slack
        if: failure()
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
        run: |
          if [ -n "$SLACK_WEBHOOK" ]; then
            curl -X POST "$SLACK_WEBHOOK" \
              -H 'Content-Type: application/json' \
              -d "{\"text\":\"⚠️ Weekly Dividends Ingestion FAILED after 2 retries at $(date -u +'%H:%M UTC'). Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"}"
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/dividends.yml
git commit -m "ci(cron): add weekly dividends ingestion workflow"
```

---

### Task 4: Create alerts.yml Workflow

**Files:**
- Create: `.github/workflows/alerts.yml`

**Context:**
Alerts evaluation checks if any watched instruments have triggered price/signal alerts, then sends notifications (email/Telegram/console). Run **late afternoon** (~16:30 UTC / 17:30 BRVM time), **after** the scoring pipeline completes, so alerts use fresh signal data. Notifications are optional (controlled by env vars `ALERTS_OPS_EMAIL`, `TELEGRAM_BOT_TOKEN`, etc.).

- [ ] **Step 1: Create the alerts.yml file**

```yaml
name: Daily Alerts Evaluation

env:
  SCRAPER_TRIGGER: ${{ github.event_name == 'schedule' && 'cron' || 'manual' }}

on:
  schedule:
    # Après scoring (16:00 UTC), donc ~16:30 UTC.
    # Lun-ven uniquement (séance BRVM).
    - cron: '30 16 * * 1-5'
  workflow_dispatch: {}

concurrency:
  group: alerts-evaluation
  cancel-in-progress: false

jobs:
  alerts:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      max-parallel: 1
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
      - name: Install scraper deps
        working-directory: scraper
        run: npm install

      - name: Run alerts evaluation with retry
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LOG_LEVEL: info
          # Notification channels (all optional).
          # If any env var is missing, that channel is silently skipped.
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ALERTS_EMAIL_FROM: ${{ secrets.ALERTS_EMAIL_FROM }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          ALERTS_OPS_EMAIL: ${{ secrets.ALERTS_OPS_EMAIL }}
        run: |
          MAX_RETRIES=3
          RETRY_DELAY=30
          for attempt in $(seq 1 $MAX_RETRIES); do
            echo "Attempt $attempt/$MAX_RETRIES..."
            if npm run alerts; then
              echo "✅ Alerts evaluation succeeded"
              exit 0
            else
              if [ $attempt -lt $MAX_RETRIES ]; then
                echo "⚠️ Attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
              fi
            fi
          done
          echo "❌ Alerts evaluation failed after $MAX_RETRIES attempts"
          exit 1

      - name: Verify alerts written
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        if: success()
        run: npx tsx scripts/verify-data.ts alerts

      - name: Notify failure on Slack
        if: failure()
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
        run: |
          if [ -n "$SLACK_WEBHOOK" ]; then
            curl -X POST "$SLACK_WEBHOOK" \
              -H 'Content-Type: application/json' \
              -d "{\"text\":\"⚠️ Daily Alerts Evaluation FAILED after 3 retries at $(date -u +'%H:%M UTC'). Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"}"
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/alerts.yml
git commit -m "ci(cron): add daily alerts evaluation workflow"
```

---

### Task 5: Verify GitHub Secrets Are Set

**Files:**
- Verify (no changes): GitHub repo settings → Secrets & variables

**Context:**
All 4 workflows depend on two critical secrets: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. These should already be set from the intraday workflow, but we verify and document any additional optional secrets for Slack notification.

- [ ] **Step 1: Check main secrets exist**

Open GitHub repo → Settings → Secrets and variables → Actions.

Verify the following are **present** (value doesn't need to be shown, just existence):
- `SUPABASE_URL` ✓
- `SUPABASE_SERVICE_ROLE_KEY` ✓

If either is missing, add them now:
- `SUPABASE_URL` → fetch from Supabase project settings → API URL
- `SUPABASE_SERVICE_ROLE_KEY` → fetch from Supabase project settings → API Keys → service_role key

- [ ] **Step 2: Check optional notification secrets (informational)**

If you want Slack notifications on workflow failures, also add:
- `SLACK_WEBHOOK` (optional) — Slack incoming webhook URL for your #alerts channel

If you want email/Telegram alerts from the runners, add:
- `RESEND_API_KEY` (optional) — Resend email API key
- `ALERTS_EMAIL_FROM` (optional) — "noreply@domain.com"
- `TELEGRAM_BOT_TOKEN` (optional) — Telegram bot token
- `TELEGRAM_CHAT_ID` (optional) — Telegram chat ID

**Note:** These notification secrets are **optional**. If not set, workflows still succeed; notifications are simply skipped (see `scraper/src/alerts/channels.ts` for fallback behavior).

- [ ] **Step 3: No commit needed for this task**

GitHub secrets are not stored in git; they're managed via the GitHub UI.

---

### Task 6: Test Workflows Locally (Dry Run)

**Files:**
- Verify (no changes): `scraper/src/monitoring/`

**Context:**
Before pushing to main, simulate what each workflow will do by running the commands locally with `--mock` and `--trigger=cron` flag to confirm the monitoring module correctly logs `scraper_runs` entries.

- [ ] **Step 1: Test score command locally**

```bash
cd scraper
npm install
LOG_LEVEL=info SCRAPER_TRIGGER=cron npm run score:mock -- --trigger=cron
```

Expected: Command completes successfully, logs show `buildRunRecord` execution, and console shows "Run recorded: {code, status, trigger_type}" messages.

- [ ] **Step 2: Test events command locally**

```bash
cd scraper
LOG_LEVEL=info SCRAPER_TRIGGER=cron npm run events:mock -- --trigger=cron
```

Expected: Same pattern — successful execution, monitoring logs.

- [ ] **Step 3: Test dividends command locally**

```bash
cd scraper
LOG_LEVEL=info SCRAPER_TRIGGER=cron npm run dividends:mock -- --trigger=cron
```

Expected: Same pattern.

- [ ] **Step 4: Test alerts command locally**

```bash
cd scraper
LOG_LEVEL=info SCRAPER_TRIGGER=cron npm run alerts:mock -- --trigger=cron
```

Expected: Same pattern — alerts evaluation completes, monitoring logs.

- [ ] **Step 5: No commit needed**

This is verification only. If all 4 commands succeed with monitoring output, the workflows are ready.

---

### Task 7: Document Scheduling in DEPLOYMENT.md

**Files:**
- Modify: `docs/DEPLOYMENT.md` (add scheduling table)

**Context:**
Add a section documenting the new scheduled workflows so future maintainers understand the timing, frequency, and purpose of each cron job.

- [ ] **Step 1: Read the current DEPLOYMENT.md**

```bash
head -100 docs/DEPLOYMENT.md
```

Find a good location to insert the cron scheduling table (typically after the "Intraday Scraper" section if one exists).

- [ ] **Step 2: Add scheduling section to DEPLOYMENT.md**

Insert the following markdown block (adjust location as needed):

```markdown
## Scheduled Workers (GitHub Actions Cron)

All workers run on UTC (Supabase/GitHub Actions baseline). BRVM Abidjan is UTC+0.

| Worker | Command | Schedule | Frequency | Timeout | Retries | Purpose |
|--------|---------|----------|-----------|---------|---------|---------|
| **intraday** | `npm run intraday` | 9–15 UTC, every 7–8 min | Continuous (trading hours) | 10 min | 3× | Fetch live pricing from brvm.org public API |
| **score** | `npm run score` | 16:00 UTC (5–6pm Abidjan) | Daily, Mon–Sat | 15 min | 3× | Calculate technical signals (RSI, MACD, MA) for all instruments |
| **events** | `npm run events` | 08:00 UTC (9am Abidjan) | Daily, Mon–Sat | 10 min | 3× | Ingest corporate events/announcements from BDFIN |
| **dividends** | `npm run dividends` | 09:00 UTC, Saturday | Weekly | 10 min | 2× | Ingest dividend announcements, calculate yields |
| **alerts** | `npm run alerts` | 16:30 UTC (5:30pm Abidjan) | Daily, Mon–Fri | 10 min | 3× | Evaluate price/signal alerts, send notifications |

### Monitoring & Logs

All workers write `scraper_runs` table entries (one per execution) with:
- `code` — job identifier (e.g., "score", "events")
- `status` — "success" | "failure"
- `trigger_type` — "cron" (scheduled) | "manual" | "intraday"
- `started_at`, `completed_at` — timestamps
- `error_message` — null on success, error details on failure

View live logs: Dashboard `/admin/scraping` (only accessible to super_admin or subscriptions.write permission).

### Failure Notifications (Optional)

Each worker has **optional** Slack notification on failure. To enable:

1. Create a Slack incoming webhook: Slack workspace → Apps → Incoming Webhooks
2. Add GitHub secret `SLACK_WEBHOOK` with the webhook URL
3. Workflows will automatically POST failures to that channel

Without `SLACK_WEBHOOK`, no notifications are sent (workflows still succeed).
```

- [ ] **Step 3: Commit the documentation**

```bash
git add docs/DEPLOYMENT.md
git commit -m "docs(deployment): add cron scheduling table and monitoring guide"
```

---

### Task 8: Push Workflows to main & Verify GitHub Actions Recognizes Them

**Files:**
- Push: `.github/workflows/score.yml`, `.github/workflows/events.yml`, `.github/workflows/dividends.yml`, `.github/workflows/alerts.yml`

**Context:**
Push all workflow files to main and verify GitHub Actions recognizes them (no syntax errors, all scheduled/manual triggers registered).

- [ ] **Step 1: View git log to confirm all commits**

```bash
git log --oneline -5
```

Expected output (or similar):
```
dbb2935 fix(diagnostic): corrige la duplication de contenu...
<new 4 commits here>
<new 1 commit here for docs>
```

- [ ] **Step 2: Push to origin/main**

```bash
git push origin main
```

- [ ] **Step 3: Verify workflows in GitHub UI**

Open GitHub repo → Actions tab.

You should see 5 workflows listed:
- Cours intraday BRVM (intraday.yml)
- Daily Scoring Pipeline (score.yml)
- Daily Events Ingestion (events.yml)
- Weekly Dividends Ingestion (dividends.yml)
- Daily Alerts Evaluation (alerts.yml)

Click on each workflow name — it should show:
- ✓ No syntax errors
- ✓ Scheduled triggers listed (cron jobs)
- ✓ Manual trigger (`workflow_dispatch`) available

- [ ] **Step 4: (Optional) Trigger a manual run to test**

For quick verification, trigger one workflow manually:

1. Go to Actions → "Daily Scoring Pipeline"
2. Click "Run workflow" → select branch "main" → confirm

Wait ~2–3 minutes for the job to complete. It should either:
- ✅ **Success** — if all scraper deps install correctly and `npm run score:mock` works
- ❌ **Failure** — if there's a syntax error in the workflow YAML or missing deps

If failure, check the job logs for the exact error and fix the workflow YAML accordingly.

- [ ] **Step 5: No additional commit needed**

Once workflows are recognized by GitHub Actions, the setup is complete. The scheduled cron jobs will begin running at their defined times.

---

## Self-Review Checklist

✅ **Spec coverage:**
- ✓ 4 workflows created (score, events, dividends, alerts)
- ✓ Scheduling timing defined per BRVM requirements
- ✓ Retry logic (3× with backoff) implemented
- ✓ Monitoring integration (SCRAPER_TRIGGER env var) in place
- ✓ Data freshness checks via verify-data.ts scripts
- ✓ Optional Slack notifications on failure
- ✓ GitHub Secrets verified (no new secrets created, existing ones documented)
- ✓ Documentation added to DEPLOYMENT.md

✅ **No placeholders:**
- ✓ Every workflow YAML is complete with exact cron expressions
- ✓ All env vars specified (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional channels)
- ✓ Retry logic is concrete (3 attempts, specific delays per task)
- ✓ Verification commands are exact (npx tsx scripts/verify-data.ts)

✅ **Type/naming consistency:**
- ✓ All workflows use same pattern (schedule, concurrency, steps, retry loop)
- ✓ Environment variable `SCRAPER_TRIGGER` consistent across all (GitHub Actions sets it)
- ✓ Slack webhook optional in all workflows (same conditional)

✅ **Task decomposition:**
- ✓ Each workflow (score, events, dividends, alerts) is one task — modular and independent
- ✓ Verification task is separate (Task 6)
- ✓ Documentation is its own task (Task 7)
- ✓ All tasks are testable and committable independently

✅ **Architecture alignment:**
- ✓ Follows intraday.yml pattern (no reinvention)
- ✓ Uses existing monitoring module (no new I/O code)
- ✓ Scheduling respects BRVM market hours (08:00–16:30 UTC)
- ✓ Notification channels are optional (graceful degradation)

---

## Next Steps After Plan Execution

1. **Monitor first run:** Watch `/admin/scraping` dashboard for 24–48 hours to ensure no `scraper_runs` errors.
2. **Fine-tune timing:** If workflows frequently timeout or cluster, adjust cron expression offsets.
3. **Extend to pg_cron:** After 1–2 weeks of stable GitHub Actions runs, consider adding pg_cron triggers as a fallback (database-native scheduler).
4. **Alert escalation:** Once comfortable, add email/Slack notifications by configuring the optional env var secrets.
