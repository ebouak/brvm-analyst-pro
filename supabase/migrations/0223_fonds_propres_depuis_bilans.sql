-- 0223 — Fonds propres des fondamentaux repris des bilans extraits (2026-11-13).
--
-- Constat : la valorisation lit `fundamentals.equity`. Pour 22 lignes, ce champ
-- était vide alors que le bilan annuel extrait du rapport officiel
-- (`balance_sheets.total_capitaux_propres`) le contenait. Cause : ces lignes
-- `fundamentals` viennent de Sika Finance (chiffre d'affaires et résultat, sans
-- fonds propres), et le job annuel (runNouvelExercice) ne complète jamais une
-- ligne existante. Huit sociétés sortaient « non estimables : comptes trop
-- anciens » (BOAS, CBIBF, SIVC, SICC, UNXC…) faute de ce seul champ.
--
-- Règles (identiques pour le report initial et pour les déclencheurs) :
--  - on ne REMPLIT que les fonds propres vides : jamais d'écrasement ;
--  - jamais une ligne vérifiée à la main (`source = 'pdf-verified'`) ;
--  - seulement depuis un bilan ANNUEL, de même exercice, à fonds propres > 0.
--
-- Aucune donnée personnelle. Fonctions de déclencheur non appelables par l'API.

-- 1. Report initial (22 lignes au 2026-11-13).
update public.fundamentals f
   set equity = b.total_capitaux_propres,
       updated_at = now()
  from public.balance_sheets b
 where b.code = f.code
   and b.type_periode = 'annuel'
   and b.periode = f.year::text
   and f.equity is null
   and b.total_capitaux_propres is not null
   and b.total_capitaux_propres > 0
   and coalesce(f.source, '') <> 'pdf-verified';

-- 2a. Un bilan annuel arrive ou change : il complète la ligne fondamentale vide.
create or replace function public.fp_depuis_bilan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type_periode = 'annuel' and new.total_capitaux_propres is not null and new.total_capitaux_propres > 0
     and new.periode ~ '^\d{4}$' then
    update public.fundamentals
       set equity = new.total_capitaux_propres, updated_at = now()
     where code = new.code
       and year = new.periode::int
       and equity is null
       and coalesce(source, '') <> 'pdf-verified';
  end if;
  return new;
end;
$$;

drop trigger if exists fp_depuis_bilan on public.balance_sheets;
create trigger fp_depuis_bilan
  after insert or update of total_capitaux_propres on public.balance_sheets
  for each row execute function public.fp_depuis_bilan();

-- 2b. Une ligne fondamentale INSÉRÉE sans fonds propres les prend au bilan s'il existe.
--     Insertion seulement : un effacement volontaire (valeur fausse) n'est pas annulé.
create or replace function public.fp_a_l_insertion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.equity is null and coalesce(new.source, '') <> 'pdf-verified' and new.year is not null then
    select b.total_capitaux_propres into new.equity
      from public.balance_sheets b
     where b.code = new.code and b.type_periode = 'annuel' and b.periode = new.year::text
       and b.total_capitaux_propres > 0
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists fp_a_l_insertion on public.fundamentals;
create trigger fp_a_l_insertion
  before insert on public.fundamentals
  for each row execute function public.fp_a_l_insertion();

revoke execute on function public.fp_depuis_bilan() from public, anon, authenticated;
revoke execute on function public.fp_a_l_insertion() from public, anon, authenticated;
