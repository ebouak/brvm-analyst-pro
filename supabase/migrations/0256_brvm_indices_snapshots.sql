-- ============================================================================
-- 0256_brvm_indices_snapshots.sql
-- Relevés des INDICES pendant la séance, pour tracer leur courbe du jour.
--
-- Pourquoi : brvm_indices_daily ne garde qu'UNE ligne par indice et par séance,
-- écrasée à chaque passage de la collecte intraday (toutes les 15 min). La
-- courbe du jour d'un indice n'avait donc aucune donnée : on ne la reconstitue
-- pas (ce serait inventer), on la relève désormais, sur le modèle exact de
-- brvm_intraday_snapshots (0081) pour les actions.
--
-- Écriture : uniquement la collecte (service_role), en ajout, non bloquante.
-- Lecture : publique, comme les indices eux-mêmes (donnée de marché publiée).
-- Données personnelles : aucune. Rétention : aucune purge, comme 0081
-- (≈ 15 indices × 30 relevés par séance, quelques centaines de lignes par jour).
-- Les courbes commencent à la première séance collectée après cette migration.
-- ============================================================================

create table if not exists public.brvm_indices_snapshots (
  id            bigserial primary key,
  code          text not null,
  date_marche   date not null,
  captured_at   timestamptz not null default now(),
  valeur        numeric(20,4),
  variation_pct numeric(12,4),
  created_at    timestamptz not null default now()
);

create index if not exists idx_indices_snapshots_code_date
  on public.brvm_indices_snapshots (code, date_marche, captured_at);

alter table public.brvm_indices_snapshots enable row level security;

drop policy if exists "indices_snapshots_public_read" on public.brvm_indices_snapshots;
create policy "indices_snapshots_public_read"
  on public.brvm_indices_snapshots for select using (true);

-- Les clés publiques ne peuvent rien écrire (pas de policy d'écriture, et les
-- droits sont retirés explicitement : Supabase les accorde par défaut).
revoke insert, update, delete, truncate on public.brvm_indices_snapshots from anon, authenticated;
