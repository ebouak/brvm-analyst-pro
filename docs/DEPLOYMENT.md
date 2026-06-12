# Deployment Guide — BRVM Analyst Pro

This document describes how to deploy and schedule the scraper's daily data collection pipeline.

## Overview

The scraper operates in **two modes**:

1. **Manual / On-Demand**: Run individual commands (e.g., `npm run scrape:daily` in the `scraper` directory).
2. **Scheduled / Automated**: Use GitHub Actions cron jobs or Vercel Cron to orchestrate multi-step daily pipelines.

The **primary pipeline** is `daily:full`, which orchestrates 5 sequential steps:
1. BDFIN Instruments (reference data)
2. BDFIN Market (trades, prices, volumes)
3. Communiqués (official announcements)
4. Bulletins (market reports)
5. News (BRVM.org articles)

---

## GitHub Actions Setup (Recommended)

### Prerequisites

- GitHub repository with Actions enabled.
- Secrets stored in **Settings → Secrets → Actions**.

### Required Secrets

Add these secrets to your GitHub Actions environment:

| Secret | Value | Notes |
|--------|-------|-------|
| `SUPABASE_URL` | `https://your-project.supabase.co` | PostgreSQL endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Service role API key (backend only) |
| `OBSCURA_CDP_URL` | `http://...` | (Optional) Chrome DevTools Protocol for headless browser |

**⚠️ Security**: Never commit these secrets. Use GitHub's **Settings** UI only.

### Workflow File Example

Create `.github/workflows/scraper-daily.yml`:

```yaml
name: Daily Scraper Pipeline

on:
  schedule:
    # 06:00 UTC = 07:00 CET = 08:00 CEST
    - cron: '0 6 * * 1-5'  # Monday to Friday
  workflow_dispatch:        # Manual trigger in Actions tab

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: scraper/package-lock.json

      - name: Install dependencies
        working-directory: scraper
        run: npm ci

      - name: Run daily:full pipeline
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          OBSCURA_CDP_URL: ${{ secrets.OBSCURA_CDP_URL }}
          LOG_LEVEL: info
        run: |
          npm run scrape:daily:full 2>&1 | tee scraper.log

      - name: Upload logs on failure
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: scraper-logs
          path: scraper/scraper.log
          retention-days: 7

      - name: Notify on failure (optional)
        if: failure()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"⚠️ Daily scraper failed. Check: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}"}'
```

### npm Script

In `scraper/package.json`, add:

```json
{
  "scripts": {
    "scrape:daily:full": "tsx src/index.ts daily:full"
  }
}
```

---

## Vercel Cron Alternative

If you prefer **Vercel** for scheduling (e.g., serverless functions):

### Setup

1. Install Vercel CLI: `npm install -g vercel`
2. Deploy the scraper as an **API route** in the frontend project:

```typescript
// frontend/app/api/cron/daily-full/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Verify Vercel's cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { runDailyFull } = await import('../../runners/runDailyFull.js');
    const result = await runDailyFull();

    return NextResponse.json({
      status: result.status,
      summary: result.summary,
      errors: result.errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
```

3. In `vercel.json`, configure cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-full",
      "schedule": "0 6 * * 1-5"
    }
  ]
}
```

4. Redeploy: `vercel deploy --prod`

---

## Manual Execution

### Single Step

Run individual components:

```bash
cd scraper

# Scrape instruments (reference data)
npm run scrape:details SNTS ETIT

# Scrape market data for a specific date
npm run scrape:date -- 2025-06-10

# Score signals
npm run score

# Ingest events/news
npm run events
npm run news
```

### Full Pipeline

```bash
cd scraper
npm run scrape:daily:full

# With a specific date:
npm run scrape:daily:full 2025-06-10
```

---

## Monitoring

### Checking Logs

#### GitHub Actions

1. Open **Actions** tab → select the workflow run
2. Expand the **"Run daily:full pipeline"** step
3. Logs are printed in real-time; failures are flagged

#### Console / Local

```bash
# Mock mode (no external dependencies)
npm run scrape:daily:full --mock

# Real mode with verbose logging
LOG_LEVEL=debug npm run scrape:daily:full
```

### Structured Output

The CLI returns JSON on success:

```json
{
  "startedAt": "2025-06-10T06:15:30.000Z",
  "finishedAt": "2025-06-10T06:22:45.000Z",
  "status": "success",
  "results": {
    "bdfinInstruments": { "status": "success", "count": 48 },
    "bdfinMarket": { "status": "success", "actions": 45, "obligations": 15 },
    "communiques": { "status": "success", "count": 3 },
    "bulletins": { "status": "success", "count": 1 },
    "news": { "status": "success" }
  },
  "errors": [],
  "summary": {
    "totalSteps": 5,
    "successfulSteps": 5,
    "failedSteps": 0
  }
}
```

Exit codes:
- **0** = Success or Partial completion
- **1** = Failed (all steps failed)

### Database Verification

Check that data was written:

```sql
-- PostgreSQL via Supabase SQL Editor

-- Market data (actions & obligations)
SELECT MAX(date_marche) FROM brvm_actions_daily;
SELECT COUNT(*) FROM brvm_obligations_daily WHERE date_marche = CURRENT_DATE;

-- Reference data
SELECT COUNT(*) FROM instruments;

-- Recent events
SELECT COUNT(*) FROM events WHERE DATE(created_at) = CURRENT_DATE;

-- Check scrape_runs for audit trail
SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 5;
```

---

## Troubleshooting

### Common Issues

#### 1. **"SUPABASE_URL not found" or "SERVICE_ROLE_KEY missing"**

**Cause**: Secrets not configured in GitHub Actions.

**Fix**:
```bash
# GitHub CLI
gh secret set SUPABASE_URL --body "https://xxxx.supabase.co"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "eyJhbGc..."
```

#### 2. **"Obscura browser failed to connect"**

**Cause**: `OBSCURA_CDP_URL` is not set, or headless browser is unreachable.

**Fix**:
- For **BDFIN only**: Configure `OBSCURA_CDP_URL` secret.
- For **public data only**: Comment out BDFIN steps in the workflow (instruments & market).
- **Fallback**: The pipeline continues without BDFIN data; other steps (communiqués, bulletins, news) proceed.

#### 3. **"Timeout after 30 minutes"**

**Cause**: One step is hanging (e.g., slow network, infinite loop).

**Fix**:
```yaml
# Increase timeout in workflow
timeout-minutes: 45

# Or run steps in parallel (not recommended if they share DB writes)
```

#### 4. **"Duplicate key violation" in DB**

**Cause**: A step ran twice on the same date, and idempotence keys are incorrect.

**Fix**:
- Check that upsert conditions in `scraper/src/persistence/*.ts` use correct conflict keys.
- Verify schema migrations match insert columns.
- Example for actions:
  ```sql
  INSERT INTO brvm_actions_daily (code, date_marche, ...)
  ON CONFLICT (code, date_marche) DO UPDATE SET ...
  ```

#### 5. **"News or Communiqués scraper fails consistently"**

**Cause**: BRVM.org or mediacentre.brvm.org layout has changed.

**Fix**:
1. Check the source HTML (open in browser, inspect).
2. Update parsers in `scraper/src/parsers/` and `scraper/src/scrapers/`.
3. Add a test fixture to prevent regression:
   ```bash
   # Capture current HTML
   curl https://mediacentre.brvm.org > fixture.html
   # Add to tests/fixtures/ and test against it
   ```

#### 6. **"Memory leak" or "process hangs"**

**Cause**: Browser (Obscura) or HTTP pool not closing.

**Fix**:
- Ensure `browser.close()` is always called (in `finally` block).
- Check for unclosed database connections: `await client.end()`.

---

## Alerting & Notifications

### Email Notification (Optional)

Configure via environment variables:

```bash
RESEND_API_KEY=re_xxxx
ALERTS_EMAIL_FROM=scraper@example.com
ALERTS_EMAIL_TO=admin@example.com
```

In the workflow:

```yaml
- name: Send failure email
  if: failure()
  env:
    RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
  run: |
    npm run alerts --mock  # or custom notification script
```

### Slack Integration

```yaml
- name: Notify Slack on failure
  if: failure()
  env:
    SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
  run: |
    curl -X POST $SLACK_WEBHOOK \
      -H 'Content-Type: application/json' \
      -d '{
        "text": "Scraper failed at '${{ job.status }}'",
        "details": "Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
      }'
```

---

## Rollback & Recovery

If a day's data is corrupted:

### 1. Identify the bad date
```sql
SELECT date_marche, COUNT(*) FROM brvm_actions_daily 
GROUP BY date_marche ORDER BY date_marche DESC LIMIT 5;
```

### 2. Delete (if necessary)
```sql
DELETE FROM brvm_actions_daily WHERE date_marche = '2025-06-09';
DELETE FROM brvm_obligations_daily WHERE date_marche = '2025-06-09';
DELETE FROM events WHERE DATE(created_at) = '2025-06-09';
```

### 3. Re-run for that date
```bash
npm run scrape:daily:full 2025-06-09
```

---

## Performance Tuning

### Typical Execution Time

| Step | Duration | Notes |
|------|----------|-------|
| BDFIN Instruments | 30s | Headless browser + parsing |
| BDFIN Market | 2–5m | Depends on trading volume |
| Communiqués | 10–20s | BRVM.org scrape |
| Bulletins | 5–10s | Static page parse |
| News | 5–10s | Feed parsing |
| **Total** | **3–7 minutes** | Can be faster with parallel execution |

### Optimization Tips

1. **Parallel execution** (use GitHub Actions matrix):
   ```yaml
   strategy:
     matrix:
       step: [instruments, market, communiques, bulletins, news]
   ```
   (⚠️ Requires careful DB locking; not recommended.)

2. **Caching**:
   ```yaml
   - uses: actions/cache@v3
     with:
       path: scraper/node_modules
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   ```

3. **Reduce logging overhead**:
   ```bash
   LOG_LEVEL=warn npm run scrape:daily:full
   ```

---

## Checklist Before Production

- [ ] Secrets configured in GitHub (SUPABASE_URL, SERVICE_ROLE_KEY)
- [ ] Workflow file `.github/workflows/scraper-daily.yml` committed
- [ ] `npm run scrape:daily:full --mock` runs without errors
- [ ] Database migrations applied (`supabase/migrations/*` in Supabase)
- [ ] RLS policies configured (if using row-level security)
- [ ] Monitoring / alerting set up (optional: Slack, email)
- [ ] Tested with a recent real date: `npm run scrape:daily:full 2025-06-10`
- [ ] Cron schedule verified (correct timezone, business days only)

---

## References

- **CLAUDE.md** — Project overview & stack
- **SCRAPER.md** — Scraper architecture & modules
- **SCORING.md** — Signal generation
- **RECOVERY.md** — Disaster recovery & database repair
