-- ============================================================================
-- 0248_nervosite_daily.sql
-- Indice de nervosité BRVM-V : volatilité RÉALISÉE du marché large, en %
-- annualisé (la BRVM n'a pas de marché d'options, donc pas de VIX possible).
-- Une ligne par séance, calculée par le scraper (`npm run nervosite`, job
-- `nervosite` de .github/workflows/score.yml) depuis brvm_actions_daily.
--
-- Donnée de marché, aucune donnée personnelle : lecture publique (comme
-- liquidity_daily, 0111), écriture réservée au service_role.
-- ============================================================================

create table if not exists public.brvm_nervosite_daily (
  date_marche  date primary key,
  -- Indice, % annualisé. NULL tant que l'historique est insuffisant (< 250 séances).
  valeur       numeric(10,4) check (valeur is null or valeur >= 0),
  -- Composante rapide (moyenne exponentielle, lambda = 0,94), % annualisé.
  rapide       numeric(10,4) check (rapide is null or rapide >= 0),
  -- Composante lente (250 séances), % annualisé.
  lente        numeric(10,4) check (lente is null or lente >= 0),
  -- Rang 0-100 de la valeur dans l'historique connu à cette date (fenêtre croissante).
  rang         numeric(6,2) check (rang is null or (rang >= 0 and rang <= 100)),
  regime       text check (regime is null or regime in ('calme', 'normal', 'agité', 'tendu')),
  -- Titres dont le rendement entre dans la moyenne de la séance.
  n_titres     integer not null check (n_titres >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Un régime n'existe pas sans rang.
  constraint brvm_nervosite_regime_sans_rang check ((rang is null) = (regime is null))
);

alter table public.brvm_nervosite_daily enable row level security;

drop policy if exists "brvm_nervosite_daily_lecture_publique" on public.brvm_nervosite_daily;
create policy "brvm_nervosite_daily_lecture_publique"
  on public.brvm_nervosite_daily for select
  to anon, authenticated
  using (true);

-- Les grants par défaut de Supabase sont nominatifs (anon, authenticated) :
-- révoquer PUBLIC seul ne suffit pas (voir 0093). Les trois, toujours.
revoke insert, update, delete, truncate on public.brvm_nervosite_daily from public, anon, authenticated;
grant select on public.brvm_nervosite_daily to anon, authenticated;

comment on table public.brvm_nervosite_daily is
  'Indice de nervosité BRVM-V : volatilité réalisée du marché large (moyenne simple des rendements log des titres cotés), % annualisé, 100 x racine(250) x racine(1/2 variance rapide lambda 0,94 + 1/2 variance 250 séances). Rang dans l''historique connu à la date, régime par rang (calme < 25, normal < 75, agité < 90, tendu). Ni prévision ni conseil. Lecture publique, écriture service_role.';
