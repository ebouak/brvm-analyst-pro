-- Brief quotidien de séance (généré post-clôture, envoyé sur Telegram,
-- archivé publiquement sur /brief). Un brief par séance (idempotent).
create table if not exists public.brief_daily (
  date_marche date primary key,
  contenu     text not null,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.brief_daily is
  'Brief quotidien de séance BRVM : résumé textuel généré depuis les données du jour.';

alter table public.brief_daily enable row level security;

drop policy if exists "lecture publique brief_daily" on public.brief_daily;
create policy "lecture publique brief_daily"
  on public.brief_daily for select using (true);
-- écriture réservée au service_role (worker brief).
