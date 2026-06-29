-- ============================================================================
-- 0057_weekly_reports_newsletter_prefs.sql
-- ============================================================================
-- 1. Colonne status sur brvm_news (draft / published)
-- 2. Préférences newsletter par thème (par utilisateur)
-- 3. Journal des envois newsletter
-- ============================================================================

-- 1. Status sur brvm_news
ALTER TABLE public.brvm_news
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'published'));

CREATE INDEX IF NOT EXISTS idx_brvm_news_status ON public.brvm_news (status);

-- 2. Préférences newsletter par thème
-- Chaque utilisateur coche les types de contenu qu'il souhaite recevoir.
CREATE TABLE IF NOT EXISTS public.newsletter_topic_preferences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_commodity   BOOLEAN NOT NULL DEFAULT false,   -- Analyses hebdo matières premières
  daily_market       BOOLEAN NOT NULL DEFAULT false,   -- Brief quotidien marché BRVM
  signals_digest     BOOLEAN NOT NULL DEFAULT false,   -- Digest signaux opportunité
  events_digest      BOOLEAN NOT NULL DEFAULT false,   -- Événements & dividendes
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_topic_preferences_user_key UNIQUE (user_id)
);

ALTER TABLE public.newsletter_topic_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user gère ses prefs newsletter" ON public.newsletter_topic_preferences;
CREATE POLICY "user gère ses prefs newsletter"
  ON public.newsletter_topic_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role accès complet (envoi groupé)
DROP POLICY IF EXISTS "service_role newsletter_topic_prefs" ON public.newsletter_topic_preferences;
CREATE POLICY "service_role newsletter_topic_prefs"
  ON public.newsletter_topic_preferences
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_nl_topic_prefs_user ON public.newsletter_topic_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_nl_topic_commodity ON public.newsletter_topic_preferences (weekly_commodity)
  WHERE weekly_commodity = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_nl_prefs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_nl_prefs_updated_at ON public.newsletter_topic_preferences;
CREATE TRIGGER trg_nl_prefs_updated_at
  BEFORE UPDATE ON public.newsletter_topic_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_nl_prefs_updated_at();

-- 3. Journal des envois newsletter
CREATE TABLE IF NOT EXISTS public.newsletter_sends (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_type  TEXT NOT NULL,       -- 'weekly_commodity' | 'daily_market' | ...
  article_id       UUID REFERENCES public.brvm_news(id) ON DELETE SET NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipients_count INT NOT NULL DEFAULT 0,
  sent_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata         JSONB
);

ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin lit newsletter_sends" ON public.newsletter_sends;
CREATE POLICY "admin lit newsletter_sends"
  ON public.newsletter_sends
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_role newsletter_sends" ON public.newsletter_sends;
CREATE POLICY "service_role newsletter_sends"
  ON public.newsletter_sends
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_type ON public.newsletter_sends (newsletter_type);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_article ON public.newsletter_sends (article_id);
