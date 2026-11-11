-- 0212 — Audit F-04, étape 1 sur 2 (EXPANSION, sans rien retirer).
--
-- Les pages publiques (fiches /societes et /actions, landing, image OG,
-- /apercu) n'ont besoin que de la DERNIÈRE note de chaque valeur. Cette
-- fonction ne renvoie que cela : une ligne par code, cinq colonnes, jamais
-- l'historique ni les sous-scores, qui restent réservés aux comptes.
--
-- Pourquoi une fonction SECURITY DEFINER et pas une vue : une vue sans
-- security_invoker contournerait la RLS en permanence et laisserait un
-- avertissement security_definer_view qu'on finirait par ignorer. La
-- fonction est bornée par sa signature : elle ne peut rien rendre d'autre.
--
-- L'étape 2 (0213) fermera la lecture anonyme des tables, APRÈS le
-- déploiement du frontend qui lit cette fonction.

create or replace function public.signaux_publics(p_code text default null)
returns table (
  code text,
  date_marche date,
  signal text,
  score_total numeric,
  confiance numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (s.code)
    s.code, s.date_marche, s.signal, s.score_total, s.confiance
  from public.signals_daily s
  where p_code is null or s.code = p_code
  order by s.code, s.date_marche desc
$$;

comment on function public.signaux_publics(text) is
  'Dernière note publique par valeur (F-04). Ni historique ni sous-scores.';

-- Supabase accorde nominativement EXECUTE à anon et authenticated : on
-- révoque les trois, puis on rouvre explicitement.
revoke execute on function public.signaux_publics(text) from public, anon, authenticated;
grant execute on function public.signaux_publics(text) to anon, authenticated, service_role;
