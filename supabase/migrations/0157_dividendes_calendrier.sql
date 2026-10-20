-- ============================================================================
-- 0157_dividendes_calendrier.sql
-- Calendrier officiel de paiement des dividendes (BRVM) — spec
-- docs/superpowers/specs/2026-10-20-dividendes-calendrier-design.md
--
-- `montant` reste le NET pour une personne physique. On ajoute, à côté :
--   montant_brut  : brut par action quand la source le publie (lignes « (*) »
--                   du calendrier) ; NULL sinon — jamais reconstitué ;
--   taux_retenue  : retenue appliquée pour passer du brut au net (0,12 = IRVM
--                   CI personnes physiques depuis la LF 2025) ;
--   avis_brvm     : numéro de l'avis BRVM, ex. « 102-2026 BRVMDG ».
-- Additive et rejouable. Aucune donnée personnelle : la RLS existante de
-- `dividends` (lecture publique, écriture service_role) s'applique.
-- ============================================================================

alter table public.dividends
  add column if not exists montant_brut numeric,
  add column if not exists taux_retenue numeric,
  add column if not exists avis_brvm text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dividends_taux_retenue_chk') then
    alter table public.dividends
      add constraint dividends_taux_retenue_chk
      check (taux_retenue is null or (taux_retenue >= 0 and taux_retenue < 1));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dividends_montant_brut_chk') then
    alter table public.dividends
      add constraint dividends_montant_brut_chk
      check (montant_brut is null or montant_brut >= montant);
  end if;
end $$;

comment on column public.dividends.montant_brut is
  'Brut par action quand la source le publie (calendrier BRVM, lignes « (*) »). NULL = non publié, jamais reconstitué.';
comment on column public.dividends.taux_retenue is
  'Retenue appliquée pour passer de montant_brut à montant (ex. 0,12). NULL quand montant_brut est NULL.';
comment on column public.dividends.avis_brvm is
  'Numéro de l''avis BRVM de paiement, ex. « 102-2026 BRVMDG ».';
