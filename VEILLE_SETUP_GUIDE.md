# BRVM Veille Intelligente — Quick Setup Guide

## What Was Built

A production-ready intelligent monitoring system with:

✅ **6 Source Fetchers**
- GitHub (issues/PRs in BRVM repos)
- Twitter/X (market news)
- Stack Overflow (technical solutions)
- YouTube (trading tutorials)
- RSS Feeds (financial news)
- LinkedIn (competitor intelligence)

✅ **Database Schema** (migration 0076)
- `brvm_veille_digest` — aggregated findings
- `brvm_veille_alerts` — critical events
- `brvm_veille_job_runs` — monitoring/metrics

✅ **Admin Dashboard**
- `/admin/veille-brvm` — digest viewer + alerts
- `/admin/agent-reach-experimental` — optional Agent Reach console

✅ **CLI Integration**
- `npm run veille` — fetch today's digest
- `npm run veille [date]` — backfill specific date
- `npm run veille --mock` — demo mode (no APIs needed)

✅ **API Endpoints** (admin-only)
- `GET /api/admin/veille/digest`
- `GET /api/admin/veille/alerts`
- `POST /api/admin/veille/alerts/[id]/acknowledge`
- `POST /api/admin/agent-reach` (experimental)

---

## Installation & First Run

### Step 1: Apply Database Migration

```bash
cd supabase
supabase db push
# Applies migration 0076_brvm_veille_tables.sql
```

Or manually via Supabase SQL editor:
```
Copy entire 0076_brvm_veille_tables.sql into the editor and run.
```

### Step 2: (Optional) Add API Keys

If you want live data from APIs, add to `scraper/.env.local`:

```bash
# Optional — all fallback to mock if not set
GITHUB_TOKEN=ghp_xxxx
TWITTER_BEARER_TOKEN=Bearer xxxxx
YOUTUBE_API_KEY=AIzaxxxxx
LINKEDIN_API_KEY=xxxxx
```

Without these, the system automatically uses mock data (perfect for testing!).

### Step 3: Test Locally

```bash
cd scraper

# Test with mock data (no API calls)
npm run veille --mock
# Output: ✅ Complete BRVM Veille digest with mock data stored

# Test for specific date
npm run veille 2026-07-07 --mock

# View results in Supabase:
# - supabase.co → brvm_veille_digest
# - supabase.co → brvm_veille_alerts
# - supabase.co → brvm_veille_job_runs
```

### Step 4: Check Admin Dashboard

Visit **http://localhost:3000/admin/veille-brvm** to see:
- Digest findings grouped by source
- Critical alerts (if any)
- Job run metrics
- Statistics

---

## File Structure

```
brvm-analyst-pro/
├── scraper/src/veille/
│   ├── types.ts                      # TypeScript interfaces
│   ├── repository.ts                 # Supabase persistence
│   ├── orchestrator.ts               # Coordinates all fetchers
│   └── fetchers/
│       ├── github-fetcher.ts
│       ├── twitter-fetcher.ts
│       ├── stackoverflow-fetcher.ts
│       ├── youtube-fetcher.ts
│       ├── rss-fetcher.ts
│       └── linkedin-fetcher.ts
├── scraper/src/runners/
│   └── runVeille.ts                  # CLI runner
├── frontend/app/admin/
│   ├── veille-brvm/
│   │   └── page.tsx                  # Main dashboard
│   └── agent-reach-experimental/
│       └── page.tsx                  # Optional console
├── frontend/components/admin/
│   ├── VeilleDigestTable.tsx
│   ├── VeilleAlertsPanel.tsx
│   └── AgentReachConsole.tsx
├── frontend/app/api/admin/
│   ├── veille/
│   │   ├── digest/route.ts
│   │   ├── alerts/route.ts
│   │   └── alerts/[id]/acknowledge/route.ts
│   └── agent-reach/route.ts
├── frontend/lib/admin/
│   └── veille.ts                     # Server-side data fetching
├── supabase/migrations/
│   └── 0076_brvm_veille_tables.sql   # Database schema
└── docs/
    └── VEILLE_SYSTEM.md              # Complete documentation
```

---

## NPM Scripts

### Already Added to `scraper/package.json`

```json
{
  "scripts": {
    "veille": "tsx src/index.ts veille"
  }
}
```

### Usage

```bash
npm run veille              # today, mock mode
npm run veille --mock       # explicit mock
npm run veille 2026-07-08   # specific date
npm run veille -- 2026-07-08 --mock  # with options
```

---

## Environment Variables

### Scraper (`scraper/.env.local`)

**Required (already set)**
```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx
```

**Optional (fallback to mock)**
```bash
GITHUB_TOKEN=ghp_xxxx
TWITTER_BEARER_TOKEN=Bearer xxxxx
YOUTUBE_API_KEY=AIzaxxxxx
LINKEDIN_API_KEY=xxxxx
```

### Frontend (`frontend/.env.local`)

Already configured:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
```

---

## How It Works (Simple Explanation)

1. **User runs** `npm run veille`
2. **Orchestrator** launches 6 fetchers in parallel
3. **Each fetcher**:
   - Uses API if key available (GitHub, Twitter, etc.)
   - Falls back to mock data if no key
4. **Results aggregated** into single digest
5. **Stored in Supabase**:
   - `brvm_veille_digest` (findings)
   - `brvm_veille_alerts` (critical items)
   - `brvm_veille_job_runs` (metrics)
6. **Admin dashboard** displays everything
7. **Monitoring** tracks success/failure/timing

---

## Key Features

### 🎯 Multi-Source Coverage

| Source | Data | Frequency |
|--------|------|-----------|
| GitHub | Issues, PRs, discussions | Real-time API |
| Twitter | Market news, announcements | Real-time API |
| Stack Overflow | Technical Q&A, solutions | Top voted |
| YouTube | Tutorials, educational | Latest videos |
| RSS | Financial news | Published feeds |
| LinkedIn | Competitor moves, insights | Mock (API partnership req'd) |

### 🚨 Alert System

**Automatic Detection**:
- Regulatory changes
- Competitor moves
- Technical vulnerabilities
- Market shocks
- Systemic risks

**Severity Levels**:
- 🔴 **HIGH** — Immediate action needed
- 🟠 **MEDIUM** — Review recommended
- 🔵 **LOW** — Informational

### 📊 Admin Controls

- Acknowledge alerts (audit trail: timestamp + user ID)
- Filter by source, date, severity
- One-click links to original sources
- Job run history and error logs

---

## Troubleshooting

### No data appearing?

1. Check migration was applied:
   ```bash
   # In Supabase SQL:
   SELECT * FROM information_schema.tables 
   WHERE table_name LIKE 'brvm_veille%';
   ```

2. Check logs:
   ```bash
   npm run veille --mock 2>&1 | tail -20
   ```

3. Verify Supabase connection:
   ```bash
   echo $SUPABASE_URL $SUPABASE_SERVICE_ROLE_KEY
   ```

### API failing?

- Without keys → automatically uses mock data ✅
- Check API key validity
- Check rate limits (Twitter: 450/15min, YouTube: 100/day free)

### Dashboard not loading?

1. Must be logged in as admin
2. Check `/admin/veille-brvm` URL
3. Verify RLS policies in migration

---

## Next: Schedule as Cron Job

Once verified working locally:

### Option A: GitHub Actions

```yaml
# .github/workflows/veille.yml
name: BRVM Veille Daily
on:
  schedule:
    - cron: '0 6 * * *'  # 6 AM UTC daily
jobs:
  veille:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd scraper && npm install && npm run veille
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

### Option B: pg_cron (Supabase)

```sql
SELECT cron.schedule(
  'veille-daily',
  '0 6 * * *',
  'SELECT net.http_post(
    url := ''https://api.example.com/trigger-veille'',
    headers := ''{"Authorization":"Bearer TOKEN"}''::jsonb
  )'
);
```

---

## Support

📖 **Full Documentation**: `docs/VEILLE_SYSTEM.md`

📋 **Project Overview**: `CLAUDE.md`

🔍 **Schema Details**: `supabase/migrations/0076_brvm_veille_tables.sql`

💬 **Questions**: See HANDOFF.md for developer context

---

## Summary

✅ **Production-Ready** — Full database schema + RLS
✅ **6 Sources** — GitHub, Twitter, SO, YouTube, RSS, LinkedIn
✅ **Admin Dashboard** — View digest + manage alerts
✅ **CLI Ready** — `npm run veille [date] [--mock]`
✅ **Monitoring** — Job runs + metrics + error tracking
✅ **Extensible** — Easy to add more sources or integrate with patterns

**No additional npm packages required** — uses built-in Node.js `fetch()` API.

Happy monitoring! 🚀
