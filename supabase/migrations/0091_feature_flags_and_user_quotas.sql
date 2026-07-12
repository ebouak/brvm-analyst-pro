-- ============================================================================
-- 0091_feature_flags_and_user_quotas.sql
--
-- 1) FEATURE FLAGS — piloter depuis l'admin l'accès à une fonctionnalité :
--    gratuite / premium / désactivée, sans redéployer. Sert aussi de kill switch
--    (couper une feature qui coûte trop cher ou qui dysfonctionne, en direct).
--
-- 2) QUOTAS UTILISATEUR — les endpoints LLM (diagnostic IA, assistant) brûlent
--    des tokens payants. Aujourd'hui un compte premium peut en lancer 500 et
--    vider le budget : la garde vérifie « premium », jamais « combien ».
--    Le compteur est journalier et PERSISTANT (même leçon que l'API : un
--    compteur en mémoire ne survit pas au serverless).
-- ============================================================================

-- ── 1. Feature flags ────────────────────────────────────────────────────────
create table if not exists public.feature_flags (
  code         text primary key,             -- ex. 'diagnostic_ia'
  label        text not null,                -- libellé humain (console admin)
  acces        text not null default 'premium'
               check (acces in ('free', 'premium', 'disabled')),
  -- Quota journalier par utilisateur (null = illimité). C'est le garde-fou des
  -- fonctions coûteuses.
  quota_free   integer check (quota_free is null or quota_free >= 0),
  quota_premium integer check (quota_premium is null or quota_premium >= 0),
  description  text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null
);

comment on table public.feature_flags is
  'Pilotage des fonctionnalités depuis l''admin : free | premium | disabled (kill switch), + quotas journaliers par utilisateur.';

-- Lecture publique : le frontend doit savoir si une feature est ouverte.
-- (Aucun secret ici — seulement l''état d''ouverture d''une fonctionnalité.)
alter table public.feature_flags enable row level security;

drop policy if exists "feature_flags_read_all" on public.feature_flags;
create policy "feature_flags_read_all" on public.feature_flags
  for select using (true);
-- Écriture : service_role uniquement (console admin) — pas de policy write.

-- Seed des fonctions coûteuses / gatées actuelles.
insert into public.feature_flags (code, label, acces, quota_free, quota_premium, description) values
  ('diagnostic_ia', 'Diagnostic IA', 'premium', 0, 10,
   'Analyse sell-side générée par LLM. Coût réel en tokens : quota par jour et par utilisateur.'),
  ('assistant_ia', 'Assistant IA', 'premium', 0, 30,
   'Chat d''assistance. Coût en tokens par message.'),
  ('backtest', 'Backtest de stratégie', 'free', 5, null,
   'Calcul local (pas de coût LLM) — quota léger pour éviter les abus.'),
  ('paper_trading', 'Paper Trading', 'premium', 0, null, 'Portefeuille virtuel.'),
  ('dcf', 'Valorisation DCF', 'premium', 0, null, 'Modèle DCF complet.')
on conflict (code) do nothing;

-- ── 2. Consommation par utilisateur et par feature ──────────────────────────
create table if not exists public.feature_usage (
  user_id      uuid not null references auth.users(id) on delete cascade,
  feature_code text not null references public.feature_flags(code) on delete cascade,
  jour         date not null default current_date,
  compteur     integer not null default 0,
  primary key (user_id, feature_code, jour)
);

comment on table public.feature_usage is
  'Consommation journalière par utilisateur et fonctionnalité. Persistant : c''est ce qui rend le quota réel (un compteur en mémoire ne survit pas au serverless).';

alter table public.feature_usage enable row level security;

-- L'utilisateur peut voir SA consommation (afficher « 3/10 diagnostics
-- aujourd'hui ») ; l'écriture reste service_role.
drop policy if exists "feature_usage_read_own" on public.feature_usage;
create policy "feature_usage_read_own" on public.feature_usage
  for select using (auth.uid() = user_id);

-- Incrément atomique : deux appels simultanés ne doivent pas s'écraser.
create or replace function public.feature_usage_increment(
  p_user_id uuid,
  p_feature text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.feature_usage (user_id, feature_code, jour, compteur)
  values (p_user_id, p_feature, current_date, 1)
  on conflict (user_id, feature_code, jour)
  do update set compteur = public.feature_usage.compteur + 1
  returning compteur into v_count;
  return v_count;
end;
$$;

-- SECURITY DEFINER : EXECUTE est accordé à PUBLIC par défaut. Sans ce revoke,
-- n'importe qui pourrait incrémenter le compteur d'un tiers via /rest/v1/rpc
-- (et donc l'empêcher d'utiliser sa propre feature).
revoke execute on function public.feature_usage_increment(uuid, text) from public;
