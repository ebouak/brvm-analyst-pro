-- ============================================================================
-- 0166_fractionnement_snts.sql
-- Fractionnement SONATEL (SNTS) du 26/10/2026 : 1 action ancienne = 10 nouvelles.
--
-- L'INCIDENT. Le 26/10, la collecte a enregistré le cours ajusté (4 700 F) face
-- à une veille non ajustée (43 850 F) : variation calculée −89,28 % au lieu de
-- +7,18 %. La vidéo de séance, le point du soir et le brief l'ont publié.
-- Constaté dans nos propres chiffres : 43 850 / 10 = 4 385 et 4 385 × 1,0718 ≈ 4 700.
--
-- LA CORRECTION : tout l'historique s'exprime en actions d'aujourd'hui. Avant
-- le 26/10 : cours, prix, dividendes et BPA ÷ 10 ; volumes et quantités × 10.
-- La valeur (cours × quantité, capitaux échangés, valorisation) ne change pas.
--
-- NON touché, et pourquoi :
--  - brvm_instruments.shares : déjà à 1 000 000 000 (brvm.org à jour) ;
--  - dividendes 2022-2024 : déjà ajustés à la source (150, 158, 166 F) ; seuls
--    2025 (1 740) et 2021 (1 400) le sont ici, par exercice explicite ;
--  - relevés intraday et carnet DU 26/10 : déjà à l'échelle nouvelle ;
--  - valeur_echangee, valorisation : des montants, invariants ;
--  - documents datés (analyses hebdo, rapports figés) : ce sont des archives.
--
-- PRÉVENTION : registre operations_titres + trigger sur brvm_actions_daily
-- (section 3) ; côté code, verrou « variations_plausibles » avant toute
-- publication et garde sur les dividendes réimportés.
--
-- SÛRETÉ : une transaction ; copie de chaque table touchée (backup_snts_20261026_*) ;
-- idempotente — l'opération est enregistrée dans operations_titres et le bloc
-- ne s'exécute pas deux fois. Annulation : restaurer depuis les tables backup.
-- ============================================================================

begin;

-- ── 1. Registre des opérations sur titres (prévention, lu par les contrôles) ──
create table if not exists public.operations_titres (
  id          bigint generated always as identity primary key,
  code        text not null references public.brvm_instruments(code),
  date_effet  date not null,
  type        text not null check (type in ('fractionnement', 'regroupement')),
  ratio       numeric not null check (ratio > 0), -- actions nouvelles pour une ancienne
  applique_le timestamptz,
  note        text,
  unique (code, date_effet)
);
comment on table public.operations_titres is
  'Fractionnements / regroupements. Donnée de marché publique. Lu par les contrôles de publication (variation aberrante) et l''ajustement de l''historique.';
alter table public.operations_titres enable row level security;
drop policy if exists operations_titres_lecture on public.operations_titres;
create policy operations_titres_lecture on public.operations_titres for select using (true);
revoke insert, update, delete on public.operations_titres from anon, authenticated;

-- ── 2. Ajustement, une seule fois ────────────────────────────────────────────
do $$
declare
  r constant numeric := 10;
  d constant date := '2026-10-26';
begin
  if exists (select 1 from public.operations_titres where code = 'SNTS' and date_effet = d and applique_le is not null) then
    raise notice 'Fractionnement SNTS du 26/10/2026 déjà appliqué : rien à faire.';
    return;
  end if;

  -- Copies de sauvegarde (lignes SNTS uniquement)
  create table if not exists public.backup_snts_20261026_actions as select * from public.brvm_actions_daily where code = 'SNTS';
  create table if not exists public.backup_snts_20261026_quotes as select * from public.daily_quotes where instrument_code = 'SNTS';
  create table if not exists public.backup_snts_20261026_intraday as select * from public.brvm_intraday_snapshots where code = 'SNTS';
  create table if not exists public.backup_snts_20261026_carnet as select * from public.brvm_carnet_daily where code = 'SNTS';
  create table if not exists public.backup_snts_20261026_liquidite as select * from public.liquidity_daily where code = 'SNTS';
  create table if not exists public.backup_snts_20261026_dividendes as select * from public.dividends where code = 'SNTS';
  create table if not exists public.backup_snts_20261026_resultats as select * from public.income_statements where code = 'SNTS';
  create table if not exists public.backup_snts_20261026_portefeuilles as select * from public.portfolios_positions where code = 'SNTS';
  create table if not exists public.backup_snts_20261026_paper as select * from public.paper_trading_positions where code = 'SNTS';
  create table if not exists public.backup_snts_20261026_theses as select * from public.investment_theses where code = 'SNTS';
  create table if not exists public.backup_snts_20261026_backtest as select * from public.signals_backtest where code = 'SNTS';

  -- Cours de séance
  update public.brvm_actions_daily
     set cours_jour = cours_jour / r, cours_precedent = cours_precedent / r,
         ouverture = ouverture / r, plus_haut = plus_haut / r, plus_bas = plus_bas / r,
         cours_haut_52s = cours_haut_52s / r, cours_bas_52s = cours_bas_52s / r,
         volume = volume * r
   where code = 'SNTS' and date_marche < d;
  update public.brvm_actions_daily
     set cours_precedent = cours_precedent / r,
         variation_pct = round((cours_jour / (cours_precedent / r) - 1) * 100, 2)
   where code = 'SNTS' and date_marche = d and cours_precedent > 0;
  update public.brvm_actions_daily a
     set cours_haut_52s = s.haut, cours_bas_52s = s.bas
    from (
      select x.date_marche,
             (select max(b.cours_jour) from public.brvm_actions_daily b
               where b.code = 'SNTS' and b.cours_jour > 0 and b.date_marche between x.date_marche - 365 and x.date_marche) as haut,
             (select min(b.cours_jour) from public.brvm_actions_daily b
               where b.code = 'SNTS' and b.cours_jour > 0 and b.date_marche between x.date_marche - 365 and x.date_marche) as bas
        from public.brvm_actions_daily x where x.code = 'SNTS' and x.date_marche >= d
    ) s
   where a.code = 'SNTS' and a.date_marche = s.date_marche;

  update public.daily_quotes
     set close_price = close_price / r, previous_close = previous_close / r, volume = volume * r
   where instrument_code = 'SNTS' and date_marche < d;
  update public.daily_quotes
     set previous_close = previous_close / r,
         variation_pct = round((close_price / (previous_close / r) - 1) * 100, 2)
   where instrument_code = 'SNTS' and date_marche = d and previous_close > 0;

  update public.brvm_intraday_snapshots set close = close / r, volume = volume * r
   where code = 'SNTS' and date_marche < d;

  update public.brvm_carnet_daily
     set cours_achat = cours_achat / r, cours_vente = cours_vente / r, cours_reference = cours_reference / r,
         qte_achat = qte_achat * r, qte_vente = qte_vente * r
   where code = 'SNTS' and date_marche < d;

  update public.liquidity_daily
     set volume_achat = volume_achat * r, volume_vente = volume_vente * r, volume_neutre = volume_neutre * r
   where code = 'SNTS' and date_marche < d;

  -- Dividendes non encore ajustés à la source (exercices explicites)
  update public.dividends set montant = montant / r, montant_brut = montant_brut / r
   where code = 'SNTS' and exercice in (2021, 2025);

  -- Données par action des comptes publiés (toutes antérieures au fractionnement)
  update public.income_statements
     set benefice_par_action = benefice_par_action / r,
         benefice_par_action_dilue = benefice_par_action_dilue / r,
         dividende_par_action = dividende_par_action / r,
         actions_en_circulation = actions_en_circulation * r,
         actions_diluees = actions_diluees * r
   where code = 'SNTS';

  -- Portefeuilles des utilisateurs : quantité × 10, prix de revient ÷ 10
  update public.portfolios_positions set quantite = quantite * r, prix_entree = prix_entree / r
   where code = 'SNTS' and coalesce(date_entree, created_at::date) < d;

  update public.paper_trading_positions
     set num_shares = num_shares * r, entry_price = entry_price / r, exit_price = exit_price / r
   where code = 'SNTS' and entry_date < d;

  update public.investment_theses
     set cours_reference = cours_reference / r, objectif = objectif / r, cours_cloture = cours_cloture / r
   where code = 'SNTS' and created_at::date < d;

  update public.signals_backtest set cours_signal = cours_signal / r, cours_horizon = cours_horizon / r
   where code = 'SNTS' and date_signal < d;

  insert into public.operations_titres (code, date_effet, type, ratio, applique_le, note)
  values ('SNTS', d, 'fractionnement', r, now(), '1 ancienne = 10 nouvelles ; historique ajusté par 0166')
  on conflict (code, date_effet) do update set applique_le = excluded.applique_le, note = excluded.note;
end $$;

-- ── 3. Garde à l'écriture : tous les collecteurs passent par ici ─────────────
-- Cinq écrivains alimentent brvm_actions_daily (intraday, cotations, BDFIN,
-- reprise par date, backfill). Corriger chacun laisserait le sixième rouvrir
-- l'incident ; le trigger les couvre tous. Deux cas, bornés par le ratio :
--  a) le jour d'effet, une veille non ajustée (veille / cours ≈ ratio) est
--     ramenée à l'échelle nouvelle et la variation recalculée ;
--  b) une fois l'historique ajusté (applique_le), une réécriture d'une séance
--     antérieure à l'échelle ancienne (nouveau ≈ ratio × ancien) est ramenée.
-- La BRVM plafonne la variation journalière à ±7,5 % : une bande de ±40 %
-- autour du ratio ne peut pas capturer un mouvement réel.
create or replace function public.ajuster_cours_operation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  op record;
begin
  for op in select date_effet, ratio, applique_le from public.operations_titres where code = new.code loop
    if new.date_marche = op.date_effet
       and new.cours_precedent > 0 and new.cours_jour > 0
       and new.cours_precedent / new.cours_jour between op.ratio * 0.6 and op.ratio * 1.6 then
      new.cours_precedent := new.cours_precedent / op.ratio;
      new.variation_pct := round((new.cours_jour / new.cours_precedent - 1) * 100, 2);
    elsif tg_op = 'UPDATE' and op.applique_le is not null and new.date_marche < op.date_effet
       and old.cours_jour > 0 and new.cours_jour > 0
       and new.cours_jour / old.cours_jour between op.ratio * 0.98 and op.ratio * 1.02 then
      new.cours_jour := new.cours_jour / op.ratio;
      new.cours_precedent := new.cours_precedent / op.ratio;
      new.ouverture := new.ouverture / op.ratio;
      new.plus_haut := new.plus_haut / op.ratio;
      new.plus_bas := new.plus_bas / op.ratio;
      new.cours_haut_52s := new.cours_haut_52s / op.ratio;
      new.cours_bas_52s := new.cours_bas_52s / op.ratio;
      new.volume := new.volume * op.ratio;
    end if;
  end loop;
  return new;
end $$;
revoke execute on function public.ajuster_cours_operation() from public, anon, authenticated;

drop trigger if exists ajuster_cours_operation on public.brvm_actions_daily;
create trigger ajuster_cours_operation
  before insert or update on public.brvm_actions_daily
  for each row execute function public.ajuster_cours_operation();

-- Les copies de sauvegarde ne sont lisibles par personne d'autre que service_role.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'backup_snts_20261026_%' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;

-- Hors transaction : la fonction utilise REFRESH ... CONCURRENTLY.
select public.refresh_market_views();
