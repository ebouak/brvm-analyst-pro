-- Create brvm_communiques table
CREATE TABLE IF NOT EXISTS brvm_communiques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_hash TEXT NOT NULL UNIQUE,
  titre TEXT NOT NULL,
  date_publication DATE NOT NULL,
  emetteur TEXT,
  categorie TEXT,
  source_url TEXT NOT NULL,
  document_url TEXT,
  resume TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on date for queries
CREATE INDEX IF NOT EXISTS idx_brvm_communiques_date ON brvm_communiques(date_publication DESC);

-- Create index on emetteur for filtering
CREATE INDEX IF NOT EXISTS idx_brvm_communiques_emetteur ON brvm_communiques(emetteur);

-- Enable RLS
ALTER TABLE brvm_communiques ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Public read communiques" ON brvm_communiques
  FOR SELECT USING (true);

-- Service role write policy
CREATE POLICY "Service role write communiques" ON brvm_communiques
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

---

-- Create brvm_bulletins table
CREATE TABLE IF NOT EXISTS brvm_bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_hash TEXT NOT NULL UNIQUE,
  date_bulletin DATE NOT NULL,
  numero TEXT,
  source_url TEXT NOT NULL,
  document_url TEXT,
  resume TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on date for queries
CREATE INDEX IF NOT EXISTS idx_brvm_bulletins_date ON brvm_bulletins(date_bulletin DESC);

-- Enable RLS
ALTER TABLE brvm_bulletins ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Public read bulletins" ON brvm_bulletins
  FOR SELECT USING (true);

-- Service role write policy
CREATE POLICY "Service role write bulletins" ON brvm_bulletins
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
