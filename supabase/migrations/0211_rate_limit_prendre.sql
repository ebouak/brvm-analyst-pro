-- 0211_rate_limit_prendre.sql
-- Audit F-19 : checkRateLimit enchainait purge, comptage et insertion en trois
-- requetes sans verrou. Des appels simultanes lisaient tous le meme compte et
-- passaient tous : la limite se contournait par rafale. Cette fonction fait les
-- trois operations dans une transaction, serialisees par un verrou consultatif
-- propre a (route, ip).
--
-- Le code (lib/server/rateLimit.ts) fonctionne AVANT cette migration : si la
-- fonction n'existe pas, il journalise « rate_limit_prendre absente » et retombe
-- sur l'ancien chemin. Ordre : appliquer cette migration, rien d'autre a faire.

create or replace function public.rate_limit_prendre(
  p_route text,
  p_ip text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int;
begin
  if p_route is null or p_ip is null or p_max < 1 or p_window_seconds < 1 or p_window_seconds > 604800 then
    raise exception 'rate_limit_prendre : parametres invalides';
  end if;

  -- Un verrou par (route, ip) : deux appels concurrents pour la meme cle
  -- s'executent l'un apres l'autre ; des cles differentes ne s'attendent pas.
  perform pg_advisory_xact_lock(hashtextextended(p_route || '|' || p_ip, 0));

  -- Minimisation : purge toute la route hors fenetre (cf. 0065).
  delete from public.rate_limit_hits
   where route = p_route
     and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into n
    from public.rate_limit_hits
   where route = p_route and ip = p_ip
     and created_at >= now() - make_interval(secs => p_window_seconds);

  if n >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (route, ip) values (p_route, p_ip);
  return true;
end $$;

-- Les trois : les grants nominatifs de Supabase survivent a `revoke from public` (cf. 0093).
revoke execute on function public.rate_limit_prendre(text, text, int, int) from public, anon, authenticated;
