-- Migration 0076: BRVM Veille System — Digest, Alerts, Job Runs
-- Production-ready intelligent monitoring system for WESTBOURSE
-- Tracks: GitHub issues, Twitter, Stack Overflow, YouTube, RSS feeds, LinkedIn
--
-- Tables:
-- - brvm_veille_digest: aggregated findings from multiple sources
-- - brvm_veille_alerts: critical events requiring action
-- - brvm_veille_job_runs: monitoring and status tracking of veille jobs

-- Veille digest table: aggregated findings from all sources
CREATE TABLE IF NOT EXISTS public.brvm_veille_digest (
  id BIGSERIAL PRIMARY KEY,
  date_marche DATE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL CHECK (source IN ('github', 'twitter', 'stack_overflow', 'youtube', 'rss', 'linkedin')),
  category TEXT, -- 'bug' | 'news' | 'solution' | 'tutorial' | 'competitor' | 'regulation' | 'market_alert'
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  relevance_score DECIMAL(3,2) CHECK (relevance_score BETWEEN 0.0 AND 1.0), -- 0.0-1.0 (AI-calculated)
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  tags TEXT[] DEFAULT '{}',
  full_content JSONB,
  is_critical BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_date_marche FOREIGN KEY (date_marche)
    REFERENCES public.brvm_market_calendar(date)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Veille alerts table: critical events flagged for action
CREATE TABLE IF NOT EXISTS public.brvm_veille_alerts (
  id BIGSERIAL PRIMARY KEY,
  digest_id BIGINT REFERENCES public.brvm_veille_digest(id) ON DELETE CASCADE ON UPDATE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN
    ('regulatory_change', 'competitor_move', 'technical_vulnerability', 'market_shock', 'systemic_risk')),
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  description TEXT,
  recommended_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT
);

-- Veille job runs table: monitoring scraper jobs
CREATE TABLE IF NOT EXISTS public.brvm_veille_job_runs (
  id BIGSERIAL PRIMARY KEY,
  date_marche DATE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL CHECK (source IN ('github', 'twitter', 'stack_overflow', 'youtube', 'rss', 'linkedin')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  items_fetched INTEGER DEFAULT 0,
  items_stored INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  metadata JSONB
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_veille_digest_date ON public.brvm_veille_digest(date_marche DESC);
CREATE INDEX IF NOT EXISTS idx_veille_digest_source ON public.brvm_veille_digest(source);
CREATE INDEX IF NOT EXISTS idx_veille_digest_critical ON public.brvm_veille_digest(is_critical) WHERE is_critical = true;
CREATE INDEX IF NOT EXISTS idx_veille_digest_relevance ON public.brvm_veille_digest(relevance_score DESC) WHERE is_critical = true;
CREATE INDEX IF NOT EXISTS idx_veille_digest_tags ON public.brvm_veille_digest USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_veille_digest_sentiment ON public.brvm_veille_digest(sentiment);
CREATE INDEX IF NOT EXISTS idx_veille_digest_created ON public.brvm_veille_digest(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_veille_alerts_digest ON public.brvm_veille_alerts(digest_id);
CREATE INDEX IF NOT EXISTS idx_veille_alerts_severity ON public.brvm_veille_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_veille_alerts_type ON public.brvm_veille_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_veille_alerts_created ON public.brvm_veille_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_veille_alerts_acknowledged ON public.brvm_veille_alerts(acknowledged_at) WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_veille_job_runs_date ON public.brvm_veille_job_runs(date_marche DESC);
CREATE INDEX IF NOT EXISTS idx_veille_job_runs_source ON public.brvm_veille_job_runs(source);
CREATE INDEX IF NOT EXISTS idx_veille_job_runs_status ON public.brvm_veille_job_runs(status);
CREATE INDEX IF NOT EXISTS idx_veille_job_runs_timestamp ON public.brvm_veille_job_runs(timestamp DESC);

-- Enable RLS
ALTER TABLE public.brvm_veille_digest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_veille_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_veille_job_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Veille digest (public read for authenticated users, admin write)
DROP POLICY IF EXISTS "veille_digest_read_authenticated" ON public.brvm_veille_digest;
CREATE POLICY "veille_digest_read_authenticated" ON public.brvm_veille_digest
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "veille_digest_admin_write" ON public.brvm_veille_digest
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.admin_roles ar ON ur.role_id = ar.id
      WHERE ur.user_id = auth.uid()
        AND ar.name IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "veille_digest_admin_delete" ON public.brvm_veille_digest
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.admin_roles ar ON ur.role_id = ar.id
      WHERE ur.user_id = auth.uid()
        AND ar.name = 'super_admin'
    )
  );

-- RLS Policies: Veille alerts (same as digest)
DROP POLICY IF EXISTS "veille_alerts_read_authenticated" ON public.brvm_veille_alerts;
CREATE POLICY "veille_alerts_read_authenticated" ON public.brvm_veille_alerts
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "veille_alerts_admin_write" ON public.brvm_veille_alerts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.admin_roles ar ON ur.role_id = ar.id
      WHERE ur.user_id = auth.uid()
        AND ar.name IN ('super_admin', 'admin')
    )
  );

-- RLS Policies: Veille job runs (admin only)
DROP POLICY IF EXISTS "veille_job_runs_admin_read" ON public.brvm_veille_job_runs;
CREATE POLICY "veille_job_runs_admin_read" ON public.brvm_veille_job_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.admin_roles ar ON ur.role_id = ar.id
      WHERE ur.user_id = auth.uid()
        AND ar.name IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "veille_job_runs_service_role_write" ON public.brvm_veille_job_runs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.brvm_veille_digest IS
  'Aggregated findings from Veille monitoring: GitHub issues, Twitter, Stack Overflow, YouTube, RSS, LinkedIn';
COMMENT ON COLUMN public.brvm_veille_digest.relevance_score IS
  'AI-calculated relevance 0.0-1.0 for BRVM traders and investors';
COMMENT ON COLUMN public.brvm_veille_digest.is_critical IS
  'Flag for regulatory changes, competitor moves, systemic risks requiring immediate attention';

COMMENT ON TABLE public.brvm_veille_alerts IS
  'Critical events extracted from digest requiring action by admins or traders';
COMMENT ON COLUMN public.brvm_veille_alerts.severity IS
  'Alert priority: high (immediate action), medium (review), low (info)';

COMMENT ON TABLE public.brvm_veille_job_runs IS
  'Monitoring records for each Veille source fetch job (success/partial/failed)';
COMMENT ON COLUMN public.brvm_veille_job_runs.duration_ms IS
  'Execution time in milliseconds for performance tracking';
