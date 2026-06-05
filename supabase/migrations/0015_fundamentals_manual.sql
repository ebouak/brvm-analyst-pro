-- ============================================================================
-- Colonnes pour l'analyse fondamentale : nombre d'actions (PER, P/B, capi) +
-- marquage des corrections manuelles (non écrasées par l'extraction auto).
-- ============================================================================

alter table public.brvm_instruments
  add column if not exists shares bigint,
  add column if not exists shares_source text;  -- 'sikafinance' | 'derive' | 'pdf' | 'manual'

alter table public.fundamentals
  add column if not exists is_manual boolean not null default false;

comment on column public.brvm_instruments.shares is 'Nombre d''actions en circulation (pour PER, P/B, capitalisation)';
comment on column public.fundamentals.is_manual is 'true = saisie manuelle, prioritaire sur extraction auto';
