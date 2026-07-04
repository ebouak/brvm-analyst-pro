-- supabase/migrations/0068_paper_trading_leaderboard.sql
-- Leaderboard paper trading : classement public ANONYMISÉ des performances papier.
--
-- RGPD (by design) :
--   Données     : alias choisi + métriques de jeu (perf %, trades) — aucun email/nom réel.
--   Finalité    : compétition sociale volontaire sur le paper trading.
--   Base légale : consentement explicite (leaderboard_optin, défaut FALSE).
--   Conservation: tant que le compte papier existe (cascade delete déjà en place).
--   Droits      : opt-out à tout moment (toggle) ; suppression de compte = retrait.
--   Sécurité    : RLS owner-only inchangée sur les tables ; exposition publique
--                 UNIQUEMENT via la RPC ci-dessous (security definer) qui filtre
--                 les opt-in et ne renvoie jamais user_id/account_id.

alter table public.paper_trading_accounts
  add column if not exists leaderboard_optin boolean not null default false,
  add column if not exists leaderboard_alias text
    constraint paper_leaderboard_alias_len
    check (leaderboard_alias is null or char_length(trim(leaderboard_alias)) between 3 and 24);

comment on column public.paper_trading_accounts.leaderboard_optin is
  'Consentement explicite à apparaître dans le classement public anonymisé (défaut false).';
comment on column public.paper_trading_accounts.leaderboard_alias is
  'Alias public choisi (3-24 car.). Si null, un alias neutre est dérivé (Investisseur XXXX).';

-- Classement public : top N des comptes opt-in ayant au moins une position.
-- security definer : lit les tables malgré la RLS, mais ne sort que des champs
-- anonymes agrégés. Jamais de user_id, ni de capital en valeur absolue.
create or replace function public.get_paper_leaderboard(limit_n int default 20)
returns table (
  rank bigint,
  alias text,
  pnl_pct numeric,
  positions_total bigint,
  positions_closed bigint,
  win_rate numeric,
  since date
)
language sql
security definer
stable
set search_path = public
as $$
  select
    row_number() over (order by a.pnl_pct desc, a.created_at asc) as rank,
    coalesce(
      nullif(trim(a.leaderboard_alias), ''),
      'Investisseur ' || upper(substr(md5(a.id::text), 1, 4))
    ) as alias,
    round(coalesce(a.pnl_pct, 0), 2) as pnl_pct,
    count(p.id) as positions_total,
    count(p.id) filter (where p.status = 'closed') as positions_closed,
    round(
      100.0 * count(p.id) filter (where p.status = 'closed' and p.pnl > 0)
      / nullif(count(p.id) filter (where p.status = 'closed'), 0),
      1
    ) as win_rate,
    a.created_at::date as since
  from public.paper_trading_accounts a
  left join public.paper_trading_positions p on p.account_id = a.id
  where a.leaderboard_optin = true
  group by a.id
  having count(p.id) >= 1
  order by a.pnl_pct desc, a.created_at asc
  limit least(greatest(coalesce(limit_n, 20), 1), 100);
$$;

comment on function public.get_paper_leaderboard(int) is
  'Classement paper trading public anonymisé (opt-in uniquement, max 100 lignes).';

revoke all on function public.get_paper_leaderboard(int) from public;
grant execute on function public.get_paper_leaderboard(int) to anon, authenticated, service_role;
