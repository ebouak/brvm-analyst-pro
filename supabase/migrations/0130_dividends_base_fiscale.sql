-- ═══════════════════════════════════════════════════════════════════════════
-- 0130 — Base fiscale des dividendes (brut / net / inconnu)
--
-- POURQUOI. La table `dividends` mélange deux fournisseurs qui ne publient pas
-- sur la même base, sans que rien ne l'enregistre :
--
--   * richbourse.com/common/dividende/index affirme dans sa propre FAQ :
--     « Les montants affichés sont-ils bruts ou nets ? Ils sont nets : l'IRVM
--     est déjà retenu à la source. »
--   * pour NEIC, sikafinance publie 159,54 quand richbourse publie 140,40 —
--     exactement le rapport 0,88 de l'IRVM à 12 %.
--   * mais pour TRACTAFRIC, les deux publient 183,92, à l'identique.
--
-- Un écart de 12 % sur une valeur et nul sur une autre interdit de déclarer
-- qu'un fournisseur est systématiquement brut et l'autre net. Tant que la base
-- n'est pas connue ligne à ligne, tout rendement affiché est ambigu de 12 % —
-- sur un produit dont l'argument est de ne jamais inventer un chiffre, c'est
-- inacceptable.
--
-- CE QUE FAIT CETTE MIGRATION. Elle enregistre ce qu'on SAIT, et seulement
-- cela. Elle ne convertit aucun montant : normaliser au brut en divisant par
-- 0,88 produirait des valeurs fausses pour les sociétés où les deux sources
-- s'accordent déjà.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.dividends
  add column if not exists base_fiscale text;

-- « inconnu » est une valeur de plein droit, pas un trou : elle dit « la
-- source ne le précise pas », ce qui est une information utile à l'affichage.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dividends_base_fiscale_chk'
  ) then
    alter table public.dividends
      add constraint dividends_base_fiscale_chk
      check (base_fiscale is null or base_fiscale in ('brut', 'net', 'inconnu'));
  end if;
end $$;

comment on column public.dividends.base_fiscale is
  'Base du montant : brut (avant IRVM), net (IRVM retenu a la source) ou inconnu. '
  'richbourse declare ses montants nets ; sikafinance ne le precise pas. '
  'Ne jamais convertir un montant sans preuve : le rapport entre les deux '
  'sources vaut 0,88 sur certaines valeurs et 1,00 sur d''autres.';

-- ── Renseignement rétroactif, uniquement là où la source le dit ────────────
-- richbourse : affirmé explicitement sur la page scrapée.
update public.dividends
   set base_fiscale = 'net'
 where source = 'richbourse'
   and base_fiscale is null;

-- sikafinance et les communiqués BDFIN ne qualifient pas leurs montants.
-- « inconnu » est plus honnête que « brut » : la comparaison TRACTAFRIC
-- montre que la règle n'est pas uniforme.
update public.dividends
   set base_fiscale = 'inconnu'
 where source is distinct from 'richbourse'
   and base_fiscale is null;

-- ── Remplissage automatique des lignes futures ────────────────────────────
-- Un DÉCLENCHEUR plutôt qu'une modification du scraper, délibérément : si le
-- code écrivait `base_fiscale` avant que cette migration ne soit appliquée,
-- l'upsert échouerait et le cron dividendes du samedi tomberait. Ici, l'ordre
-- de déploiement n'a plus d'importance — la base se suffit à elle-même.
create or replace function public.dividends_base_fiscale_defaut()
returns trigger
language plpgsql
as $$
begin
  if new.base_fiscale is null then
    new.base_fiscale := case
      when new.source = 'richbourse' then 'net'   -- affirmé par la source
      else 'inconnu'                              -- non précisé : on le dit
    end;
  end if;
  return new;
end $$;

-- `search_path` figé : une fonction SECURITY INVOKER reste sûre, mais la
-- laisser résoudre ses noms au hasard du chemin appelant est un risque connu
-- et signalé par le scan `get_advisors`.
alter function public.dividends_base_fiscale_defaut() set search_path = public, pg_temp;

drop trigger if exists trg_dividends_base_fiscale on public.dividends;
create trigger trg_dividends_base_fiscale
  before insert or update on public.dividends
  for each row
  execute function public.dividends_base_fiscale_defaut();

-- Aucune policy à ajouter : `dividends` est en lecture publique (donnée de
-- marché, pas de donnée personnelle) et cette colonne suit le même régime.
-- La fonction n'est pas appelable directement (déclencheur seul), mais on
-- retire tout de même le droit d'exécution aux trois rôles, conformément à
-- la discipline RLS du projet — révoquer `public` seul ne suffit pas.
revoke execute on function public.dividends_base_fiscale_defaut() from public, anon, authenticated;
