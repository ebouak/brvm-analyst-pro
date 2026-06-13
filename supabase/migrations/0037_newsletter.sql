-- Newsletter subscribers (double opt-in)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  confirm_token uuid NOT NULL DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'landing', -- 'landing' | 'app' | 'signup'
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email)
);

-- RLS: lecture interdite côté public, insertion autorisée (formulaire)
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_insert" ON newsletter_subscribers;
CREATE POLICY "newsletter_insert"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);

-- Service role seul peut lire/modifier (workers, confirmations)
DROP POLICY IF EXISTS "newsletter_service_all" ON newsletter_subscribers;
CREATE POLICY "newsletter_service_all"
  ON newsletter_subscribers FOR ALL
  USING (auth.role() = 'service_role');

-- Index pour les tokens de confirmation
CREATE INDEX IF NOT EXISTS newsletter_subscribers_token_idx
  ON newsletter_subscribers (confirm_token);
