-- Contrôle des dates de détachement (lecture seule).
-- Pour chaque dividende > 0 daté d'une ex-date, compare la baisse du cours entre
-- la veille (dernière séance avant l'ex-date) et le jour (première séance à partir
-- de l'ex-date) au montant détaché. Même règle que controleExDate
-- (frontend/lib/dossier/suivi.ts) : baisse < moitié du dividende = « à vérifier ».
-- Ne corrige rien. Usage : supabase db query --linked -f scraper/scripts/controle-ex-dates.sql
with d as (
  select code, exercice, montant::numeric as montant, ex_date, source
  from public.dividends
  where ex_date is not null and montant > 0
),
m as (
  select d.*,
    (select a.date_marche from public.brvm_actions_daily a
      where a.code = d.code and a.date_marche < d.ex_date and a.cours_jour > 0
      order by a.date_marche desc limit 1) as veille_date,
    (select a.cours_jour from public.brvm_actions_daily a
      where a.code = d.code and a.date_marche < d.ex_date and a.cours_jour > 0
      order by a.date_marche desc limit 1) as veille,
    (select a.date_marche from public.brvm_actions_daily a
      where a.code = d.code and a.date_marche >= d.ex_date and a.cours_jour > 0
      order by a.date_marche asc limit 1) as jour_date,
    (select a.cours_jour from public.brvm_actions_daily a
      where a.code = d.code and a.date_marche >= d.ex_date and a.cours_jour > 0
      order by a.date_marche asc limit 1) as jour
  from d
)
select code, exercice, ex_date, source, montant, veille_date, veille, jour_date, jour,
       (veille - jour) as baisse,
       round(((veille - jour) / montant)::numeric, 2) as baisse_sur_dividende
from m
where veille is not null and jour is not null
  and jour_date - ex_date <= 7
  and (veille - jour) / montant < 0.5
order by ex_date desc, code;
