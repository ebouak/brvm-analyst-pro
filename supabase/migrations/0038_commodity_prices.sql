-- Prix mensuels des matières premières (World Bank Pink Sheet)
CREATE TABLE IF NOT EXISTS commodity_prices (
  commodity text NOT NULL,        -- 'cocoa' | 'palm_oil' | 'sugar' | 'rubber'
  date date NOT NULL,             -- premier jour du mois (YYYY-MM-01)
  price numeric NOT NULL,
  unit text,
  source text NOT NULL DEFAULT 'worldbank_pinksheet',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commodity_prices_pkey PRIMARY KEY (commodity, date)
);

CREATE INDEX IF NOT EXISTS commodity_prices_date_idx ON commodity_prices (date);

-- RLS : lecture publique (données de marché), écriture service_role uniquement.
ALTER TABLE commodity_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commodity_prices_read" ON commodity_prices;
CREATE POLICY "commodity_prices_read"
  ON commodity_prices FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "commodity_prices_service_write" ON commodity_prices;
CREATE POLICY "commodity_prices_service_write"
  ON commodity_prices FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
