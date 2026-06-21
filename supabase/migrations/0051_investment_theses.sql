-- ============================================================================
-- 0051_investment_theses.sql — Thèses d'investissement de l'utilisateur
-- (skill thesis-tracker). Une thèse par (user, valeur) : la conviction de
-- l'utilisateur + son raisonnement, suivie dans le temps. Donnée PERSONNELLE
-- → RLS owner strict, cascade à la suppression du compte, couverte par
-- l'export et la suppression RGPD.
-- ============================================================================

create table if not exists public.investment_theses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  code            text not null references public.brvm_instruments(code) on update cascade,
  stance          text not null check (stance in ('achat', 'conserver', 'vente')),
  cours_reference numeric(18,4),                 -- cours au moment de la rédaction
  objectif        numeric(18,4),                 -- objectif de cours (optionnel)
  horizon         text check (horizon in ('court', 'moyen', 'long')),
  these           text not null,                 -- raisonnement (≤ 2000 car. côté app)
  points          jsonb not null default '[]'::jsonb, -- points-clés à suivre
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists idx_theses_user on public.investment_theses (user_id);

alter table public.investment_theses enable row level security;

drop policy if exists "theses_owner_all" on public.investment_theses;
create policy "theses_owner_all" on public.investment_theses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
