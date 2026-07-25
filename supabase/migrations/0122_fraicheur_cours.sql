-- 0122 — Indice de fraicheur des cours : exposer la derniere collecte intraday.
--
-- scraper_sources est en RLS service-role only. Plutot que d'ouvrir toute la
-- table (qui revelerait les codes des autres sources), on ajoute une policy de
-- lecture RESTREINTE a la ligne intraday, et une vue security_invoker qui
-- n'expose que son horodatage.
--
-- Piege anticipe (rencontre sur le passeport) : une vue security_invoker
-- N'ECHAPPE PAS a la RLS de la table sous-jacente. Sans la policy ci-dessous,
-- la vue renverrait zero ligne a anon/authenticated.

drop policy if exists "fraicheur intraday lisible" on public.scraper_sources;
create policy "fraicheur intraday lisible" on public.scraper_sources
  for select using (code = 'intraday');

create or replace view public.v_fraicheur_cours
  with (security_invoker = true) as
select last_success_at as derniere_collecte_intraday
from public.scraper_sources
where code = 'intraday';

grant select on public.v_fraicheur_cours to anon, authenticated;
