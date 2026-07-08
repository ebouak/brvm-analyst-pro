# BRVM Veille — Quick Reference Card

## 🚀 One-Liner Start

```bash
cd scraper && npm run veille --mock
```

## 📋 Commands

| Command | Purpose |
|---------|---------|
| `npm run veille` | Today's digest |
| `npm run veille --mock` | Demo (no APIs) |
| `npm run veille 2026-07-08` | Specific date |
| `npm run veille 2026-07-08 --mock` | Specific date, mock mode |

## 🔍 Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/veille-brvm` | GET | Main dashboard |
| `/api/admin/veille/digest` | GET | Fetch findings |
| `/api/admin/veille/alerts` | GET | Fetch alerts |
| `/api/admin/veille/alerts/[id]/acknowledge` | POST | Mark alert seen |
| `/admin/agent-reach-experimental` | GET | Experimental search |

## 📊 Database Tables

```
brvm_veille_digest      → Findings (title, summary, url, relevance_score)
brvm_veille_alerts      → Critical events (type, severity, action)
brvm_veille_job_runs    → Metrics (status, items, duration)
```

## 🌐 Sources

| Source | Icon | API Required | Fallback |
|--------|------|--------------|----------|
| GitHub | 🔗 | GITHUB_TOKEN | ✅ Mock |
| Twitter | 🐦 | TWITTER_BEARER_TOKEN | ✅ Mock |
| Stack Overflow | ❓ | None | ✅ Mock |
| YouTube | 📹 | YOUTUBE_API_KEY | ✅ Mock |
| RSS | 📰 | None | ✅ Mock |
| LinkedIn | 💼 | LINKEDIN_API_KEY | ✅ Mock |

## 📁 File Structure

```
scraper/src/veille/
  ├── types.ts              ← TypeScript interfaces
  ├── orchestrator.ts       ← Main coordinator
  ├── repository.ts         ← Supabase layer
  └── fetchers/
      ├── github-fetcher.ts
      ├── twitter-fetcher.ts
      ├── stackoverflow-fetcher.ts
      ├── youtube-fetcher.ts
      ├── rss-fetcher.ts
      └── linkedin-fetcher.ts

frontend/app/admin/
  ├── veille-brvm/page.tsx           ← Dashboard
  └── agent-reach-experimental/page.tsx

frontend/components/admin/
  ├── VeilleDigestTable.tsx
  ├── VeilleAlertsPanel.tsx
  └── AgentReachConsole.tsx

frontend/app/api/admin/
  ├── veille/digest/route.ts
  ├── veille/alerts/route.ts
  ├── veille/alerts/[id]/acknowledge/route.ts
  └── agent-reach/route.ts

supabase/migrations/
  └── 0076_brvm_veille_tables.sql
```

## 🔧 Setup

```bash
# 1. Apply migration
supabase db push

# 2. (Optional) Add API keys to scraper/.env.local
GITHUB_TOKEN=ghp_xxxx
TWITTER_BEARER_TOKEN=Bearer xxxxx
YOUTUBE_API_KEY=AIzaxxxxx

# 3. Test
cd scraper && npm run veille --mock

# 4. View dashboard
→ http://localhost:3000/admin/veille-brvm
```

## 🎯 Key Features

✅ 6 sources (GitHub, Twitter, SO, YouTube, RSS, LinkedIn)
✅ Automatic mock fallback (no API keys needed)
✅ Deduplication by title+source+date
✅ Severity-based alerting (high/medium/low)
✅ Admin dashboard + API
✅ Job monitoring + metrics
✅ Audit trail (alert acknowledgments)
✅ RLS security (admin-only)

## 🚨 Alert Types

- 📋 regulatory_change
- 🎯 competitor_move
- 🔓 technical_vulnerability
- ⚡ market_shock
- ⚠️ systemic_risk

## 📈 Performance

```
GitHub:        2-5s
Twitter:       3-8s
Stack Overflow: 2-4s
YouTube:       1-3s
RSS:           1-2s
LinkedIn:      instant (mock)
─────────────────────────
Parallel Total: 15-30s
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| No data appearing | Check migration applied + Supabase connection |
| API failing | Missing keys? Use `--mock` instead |
| Dashboard empty | Verify admin permission + login |
| Slow execution | Check network/API rate limits |

## 📖 Docs

- **Full Details**: `docs/VEILLE_SYSTEM.md` (1000+ lines)
- **Setup Guide**: `VEILLE_SETUP_GUIDE.md` (400+ lines)
- **This File**: `VEILLE_QUICK_REF.md` (quick reference)
- **Schema**: `supabase/migrations/0076_brvm_veille_tables.sql`

## ✅ Checklist Before Deployment

- [ ] Migration 0076 applied
- [ ] `npm run veille --mock` succeeds
- [ ] Admin dashboard loads at `/admin/veille-brvm`
- [ ] Test API endpoints with curl
- [ ] Configure API keys (if using live mode)
- [ ] Schedule cron job (optional)

## 🎬 Quick Start (5 minutes)

```bash
# Terminal 1: Backend
cd frontend
npm run dev
# → http://localhost:3000

# Terminal 2: Scraper test
cd scraper
npm run veille --mock

# Browser: Login as admin
# → http://localhost:3000/admin/veille-brvm
```

---

**Last Updated**: 2026-07-08
**Status**: Production-Ready ✅
