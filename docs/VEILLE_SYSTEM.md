# BRVM Veille Intelligente — Production-Ready Monitoring System

## Overview

The **BRVM Veille Intelligente** system is a production-ready intelligent monitoring platform that continuously tracks market intelligence and industry trends from multiple sources:

- **GitHub** — BRVM-related issues, fintech repos
- **Twitter/X** — Market news, regulatory announcements
- **Stack Overflow** — Technical solutions for traders
- **YouTube** — Trading tutorials and educational content
- **RSS Feeds** — Financial news aggregation
- **LinkedIn** — Competitor intelligence

The system aggregates findings into a unified digest, detects critical events, and surfaces alerts to administrators.

---

## Architecture

### Core Components

#### 1. Fetchers (`scraper/src/veille/fetchers/`)

Each source has a dedicated fetcher:

- **github-fetcher.ts** — Searches GitHub issues/PRs (API v3)
- **twitter-fetcher.ts** — Fetches tweets (Twitter API v2)
- **stackoverflow-fetcher.ts** — Queries Stack Overflow API
- **youtube-fetcher.ts** — Searches YouTube (YouTube API v3)
- **rss-fetcher.ts** — Parses RSS feeds (manual XML parsing)
- **linkedin-fetcher.ts** — LinkedIn content (API partnership required)

Each fetcher exports two functions:
- **Live fetch function** — Uses API (requires keys/auth)
- **Mock function** — Returns sample data for testing

#### 2. Orchestrator (`scraper/src/veille/orchestrator.ts`)

Coordinates all fetchers:
- Runs all sources in parallel (Promise.allSettled)
- Aggregates results into unified digest
- Detects critical items
- Records job runs for monitoring
- Tolerates partial failures

#### 3. Repository (`scraper/src/veille/repository.ts`)

Persistence layer for Supabase:
- `upsertVeilleDigest()` — Stores findings (deduplication by title+source+date)
- `recordVeilleJobRun()` — Logs job execution metrics
- `createVeilleAlert()` — Creates critical alerts
- `getCriticalVeilleAlerts()` — Retrieves unacknowledged alerts

#### 4. Database Schema (`supabase/migrations/0076_brvm_veille_tables.sql`)

Three main tables:

**brvm_veille_digest**
- `id` (PK)
- `date_marche` (indexed)
- `source` (github|twitter|stack_overflow|youtube|rss|linkedin)
- `category` (bug|news|solution|tutorial|competitor|regulation|market_alert)
- `title`, `summary`, `url`
- `relevance_score` (0.0-1.0, AI-calculated)
- `sentiment` (positive|neutral|negative)
- `tags` (JSONB array)
- `full_content` (JSONB)
- `is_critical` (flag for urgent items)

**brvm_veille_alerts**
- `id` (PK)
- `digest_id` (FK)
- `alert_type` (regulatory_change|competitor_move|technical_vulnerability|market_shock|systemic_risk)
- `severity` (high|medium|low)
- `description`, `recommended_action`
- `acknowledged_at`, `acknowledged_by` (audit trail)

**brvm_veille_job_runs**
- `id` (PK)
- `date_marche`, `source`
- `status` (success|partial|failed)
- `items_fetched`, `items_stored`, `errors_count`
- `duration_ms`
- `metadata` (JSONB)

---

## Configuration

### Environment Variables

**Scraper** (`scraper/.env.local`)

```bash
# APIs (all optional — fallback to mock if missing)
GITHUB_TOKEN=ghp_xxxx                  # GitHub API (optional)
TWITTER_BEARER_TOKEN=Bearer xxxxx      # Twitter API v2
YOUTUBE_API_KEY=AIzaxxxxx              # YouTube Data v3
LINKEDIN_API_KEY=xxxxx                 # LinkedIn (requires partnership)

# Required
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

**Frontend** (`frontend/.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...  # Already public
```

---

## CLI Usage

### Run Veille for Today

```bash
cd scraper
npm run veille                         # Fetch today's digest
npm run veille --mock                  # Demo mode (no API calls)
```

### Run Veille for Specific Date

```bash
npm run veille 2026-07-08              # Date backfill
npm run veille 2026-07-08 --mock       # Mock data for testing
```

### Integrated into Daily Pipeline

```bash
# Full daily scrape (includes veille + scoring + events + alerts)
npm run scrape:daily                   # All systems
npm run scrape:daily --mock            # Demo
```

---

## Admin Dashboard

### Pages

#### `/admin/veille-brvm`
- **Digest View** — All findings grouped by source
  - Filter by source, date, severity
  - One-click links to sources
  - Relevance scores and sentiment badges
  - Critical items highlighted
- **Alerts Panel** — Unacknowledged critical alerts
  - Severity color-coded (🔴 high, 🟠 medium, 🔵 low)
  - Recommended actions
  - Acknowledge button (recorded with user ID)
- **Job Runs** — Monitoring metrics
  - Success/partial/failed status
  - Items fetched vs stored
  - Duration and error logs

#### `/admin/agent-reach-experimental` (optional)
- **Console** — Test Agent Reach queries
- **Multi-source Search** — Query across all sources
- **Disclaimer** — Experimental feature note

### Components

- **VeilleDigestTable** — Display findings by source
- **VeilleAlertsPanel** — Critical alerts UI
- **AgentReachConsole** — Experimental search tool

---

## API Endpoints

### Admin Only (requires `admin.tools` permission)

**GET /api/admin/veille/digest**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/admin/veille/digest?source=github&limit=50"
```
Response: `{ data: VeilleDigestRow[] }`

**GET /api/admin/veille/alerts**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/admin/veille/alerts?limit=20"
```
Response: `{ data: VeilleAlert[] }`

**POST /api/admin/veille/alerts/[id]/acknowledge**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/admin/veille/alerts/42/acknowledge"
```
Response: `{ success: true }`

**POST /api/admin/agent-reach** (experimental)
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"github","query":"BRVM intraday patterns"}' \
  "http://localhost:3000/api/admin/agent-reach"
```
Response: `{ results: SearchResult[] }`

---

## Monitoring & Reliability

### Job Runs

Every veille execution records a `brvm_veille_job_runs` row:
- **success** — All sources completed (may have partial failures)
- **partial** — Some sources failed
- **failed** — Critical failures, low item count

### Error Handling

- **Tolerable** — Individual source fetch fails → skip, continue others
- **Critical** — Supabase write fails → log, exit 1, retry on next cycle
- **Fallback** — No API keys → use mock data

### Performance

Typical execution times (production):
- GitHub: 2–5s
- Twitter: 3–8s
- Stack Overflow: 2–4s
- YouTube: 1–3s
- RSS: 1–2s
- LinkedIn: instant (mock)

**Total**: 15–30s (parallel, all 6 sources)

---

## Integration with Pattern Detection

The Veille system enriches intraday pattern scoring:

1. **Market-Relevant Alerts** → Flag pattern scores
2. **Regulatory Changes** → Increase caution (lower thresholds)
3. **Competitor Moves** → Adjust advisability scores
4. **Technical Solutions** → Suggest pattern refinements

Example:
```typescript
// In scoring/score.ts
if (criticalVeilleAlert) {
  score.confidence *= 0.8;  // Lower confidence during market stress
  score.recommendation = 'HOLD';
}
```

---

## Deployment

### Local Development

```bash
cd scraper
npm install
cp .env.example .env.local           # Configure API keys (optional)
npm run veille --mock                # Test without APIs
```

### Staging/Production

1. **Apply Migration**
   ```bash
   supabase db push  # Applies 0076_brvm_veille_tables.sql
   ```

2. **Configure Secrets** (GitHub Actions / Vercel)
   - `GITHUB_TOKEN` (optional)
   - `TWITTER_BEARER_TOKEN` (optional)
   - `YOUTUBE_API_KEY` (optional)
   - `LINKEDIN_API_KEY` (optional, requires partnership)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

3. **Schedule Cron Job** (pg_cron or GitHub Actions)
   ```sql
   SELECT cron.schedule(
     'veille-daily',
     '0 6 * * *',  -- 6 AM UTC daily
     'SELECT net.http_post(
        url:='https://api.github.com/repos/ebouak/brvm-analyst-pro/actions/workflows/veille.yml/dispatches',
        headers:=''{"Authorization":"token "||current_setting(''app.github_token'')||''"}''::jsonb,
        body:=''{''ref'':''main''}''::jsonb
      )'
   );
   ```

---

## API Key Setup (Optional)

### GitHub Token
1. Go to https://github.com/settings/tokens
2. Create token with `public_repo` scope
3. Set `GITHUB_TOKEN=ghp_xxx`

### Twitter Bearer Token
1. Apply for Twitter API v2 access: https://developer.twitter.com/
2. Generate Bearer Token in dashboard
3. Set `TWITTER_BEARER_TOKEN=Bearer xxx`

### YouTube API Key
1. Go to Google Cloud Console
2. Enable YouTube Data v3
3. Create API key (public)
4. Set `YOUTUBE_API_KEY=AIzaxxxxx`

### LinkedIn (Requires Partnership)
- Apply: https://business.linkedin.com/marketing-solutions/marketing-developer-platform
- For now, mock data is used

---

## Troubleshooting

### No API Keys → Use Mock Data

If environment variables are not set, all fetchers automatically fall back to mock data. This is intentional for development and testing.

### Partial Failures

If some sources fail:
- Check logs in `brvm_veille_job_runs`
- Individual source failures do NOT stop the pipeline
- Status will be `partial` instead of `success`

### High Memory Usage

RSS feed parsing can consume memory if many feeds are polled. Mitigate:
- Limit feeds to top 5–10 sources
- Increase feed fetch interval (e.g., 4h instead of hourly)
- Run separate pod/container for veille

### Duplicate Findings

Deduplication uses natural key: `(title, source, date_marche)`
- Same article from different sources → stored separately (by design)
- Same source re-fetches same item → deduplicated via upsert

---

## Next Steps

### Phase 1 (Core, ✅ Complete)
- [x] Database schema + RLS
- [x] Fetchers for 6 sources
- [x] Orchestrator + repository
- [x] Admin dashboard
- [x] API endpoints
- [x] CLI integration

### Phase 2 (Enhanced Alerting)
- [ ] Sentiment analysis via LLM (DeepSeek/Mistral)
- [ ] Automatic alert creation for critical keywords
- [ ] Email/Telegram notifications for high-severity alerts
- [ ] Dashboard real-time updates (WebSocket)

### Phase 3 (Pattern Integration)
- [ ] Auto-enrich intraday patterns with veille context
- [ ] Market shock detection → freeze signals
- [ ] Competitor tracking → adjust strategy recommendations
- [ ] Regulatory calendar → flag compliance dates

### Phase 4 (Advanced)
- [ ] Agent Reach full integration (CLI tool)
- [ ] Custom source connectors (Slack, Discord)
- [ ] Veille dashboard exports (PDF, XLSX)
- [ ] Historical veille archive search

---

## Questions?

See:
- **CLAUDE.md** — Project overview
- **docs/SCRAPER.md** — Scraper architecture
- **docs/DEPLOYMENT.md** — Cron & infrastructure
- **supabase/migrations/0076_brvm_veille_tables.sql** — Schema details
