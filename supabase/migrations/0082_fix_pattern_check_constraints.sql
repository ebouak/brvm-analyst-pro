-- ============================================================================
-- 0082_fix_pattern_check_constraints.sql
-- Les CHECK de 0078 ne correspondaient PAS aux valeurs produites par le code de
-- détection → tout insert de pattern réel échouait (« violates check constraint »).
-- Alignement sur le code réel :
--   pattern_type      ∈ { atr_extreme, bullish_consolidation }   → contrainte retirée
--   validation_status ∈ { VALID, QUESTIONABLE, INVALID }         (+ PENDING défaut)
--   confidence_level  ∈ { LOW, MEDIUM, HIGH }                    (déjà correct, inchangé)
-- ============================================================================

alter table public.brvm_intraday_patterns
  drop constraint if exists brvm_intraday_patterns_pattern_type_check;

alter table public.brvm_intraday_patterns
  drop constraint if exists brvm_intraday_patterns_validation_status_check;
alter table public.brvm_intraday_patterns
  add constraint brvm_intraday_patterns_validation_status_check
  check (validation_status in ('VALID','QUESTIONABLE','INVALID','PENDING'));
