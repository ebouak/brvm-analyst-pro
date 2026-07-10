-- ============================================================================
-- 0084_signals_score_macd.sql
-- Ajoute le sous-score MACD (momentum de fond) au moteur de signaux §9.
-- Intégré au composite pour lever la tension momentum ↔ mean-reversion (le RSI
-- est désormais pondéré par le régime de marché). Colonne nullable, sans impact
-- sur les vues/lignes existantes.
-- ============================================================================

alter table public.signals_daily
  add column if not exists score_macd numeric(10,4);

comment on column public.signals_daily.score_macd is
  'Sous-score MACD (momentum de fond), histogramme normalisé en % du cours, borné [-1,1]. Ajouté 0084.';
