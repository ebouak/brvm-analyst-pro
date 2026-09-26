-- 0135 — Emplacement d'une vue de la landing : carrousel du hero, ou bandeau.
--
-- Pourquoi : le carrousel ne peut honnêtement porter qu'une poignée de vues
-- (NN/g : 1,07 % de clics, dont 84 % sur la première ; Baymard ; WCAG 2.2.2).
-- Vendre une 8e position y serait vendre du vide. Les bandeaux — un sous la
-- navigation, un en milieu de page, comme le fait sikafinance.com avec GPT —
-- montrent UNE création par chargement, tirée au sort à poids égal : tout
-- annonceur actif est vu, et la rotation ne dépend pas du rang.
--
-- RGPD : aucune donnée personnelle ajoutée (emplacement = valeur technique).
-- RLS : inchangée — lecture publique des seules lignes actives et en fenêtre,
-- écriture réservée à la service_role (console admin).

alter table public.landing_slides
  add column if not exists placement text not null default 'hero';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.landing_slides'::regclass and conname = 'landing_slides_placement_check'
  ) then
    alter table public.landing_slides
      add constraint landing_slides_placement_check check (placement in ('hero', 'billboard'));
  end if;
end $$;

comment on column public.landing_slides.placement is
  'hero = diapositive du carrousel (plafonné, quelques vues) ; billboard = bandeau pleine largeur, une création tirée au sort par chargement.';

-- L''index des vues actives sert les deux surfaces : on y ajoute l''emplacement.
drop index if exists public.landing_slides_actives_idx;
create index if not exists landing_slides_actives_idx
  on public.landing_slides (placement, position, starts_at)
  where is_active;
