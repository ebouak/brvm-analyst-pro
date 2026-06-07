-- supabase/migrations/0017_notations.sql
-- Ajoute la colonne notation_json à brvm_instruments (nullable, non destructif).

alter table public.brvm_instruments
  add column if not exists notation_json jsonb;

comment on column public.brvm_instruments.notation_json
  is 'Dernière notation financière (Bloomfield, GCR, etc.) scrapée depuis richbourse.com. Ex: {"agence":"Bloomfield Investment","note":"A+","perspective":"Stable","date_notation":"2024-11-15","source_url":"https://..."}';
