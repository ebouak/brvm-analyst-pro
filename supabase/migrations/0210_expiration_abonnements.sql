-- 0210_expiration_abonnements.sql
-- Audit F-16 : les abonnements manuels et CinetPay n'expirent jamais.
-- `renews_at` est calculé à l'activation (activate.ts) mais JAMAIS appliqué : un
-- client ayant payé un mois reste Premium indéfiniment. Seuls les pass Chariow
-- expirent (expirer_pass_chariow, 0146).
--
-- CETTE MIGRATION NE PLANIFIE RIEN. Elle crée la fonction ; l'exploitant décide
-- de la date de première exécution APRÈS avoir prévenu les abonnés concernés :
-- l'appliquer rétroactivement coupe des clients actuels. Avant de planifier,
-- lancer à blanc la requête de dénombrement ci-dessous.
--
--   select count(*) from public.subscriptions s
--     join public.subscription_plans pl on pl.id = s.plan_id
--    where coalesce(s.source, '') <> 'chariow' and s.status = 'active'
--      and s.renews_at is not null and s.renews_at < now() and pl.code <> 'free';
--
-- Schéma vérifié (0041, 0146) : subscriptions(status text sans CHECK — valeurs
-- documentées trialing/active/past_due/canceled/expired —, renews_at, expired_at,
-- source). Aucune contrainte à modifier. Les abonnements du plan `free` ont
-- renews_at NULL et sont exclus.
--
-- Le verrou de paiement (statut `processing` de billing_transactions) n'exige AUCUNE
-- migration : billing_transactions.status est un `text` libre, sans CHECK.

create or replace function public.expirer_abonnements()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int := 0;
  r record;
begin
  for r in
    update public.subscriptions s
       set status = 'expired', expired_at = now()
      from public.subscription_plans pl
     where pl.id = s.plan_id
       and pl.code <> 'free'
       and coalesce(s.source, '') <> 'chariow'
       and s.status = 'active'
       and s.renews_at is not null
       and s.renews_at < now()
    returning s.user_id
  loop
    n := n + 1;
    -- Premium retiré seulement si plus AUCUN abonnement payant actif ne le justifie.
    update public.profiles p
       set is_premium = false, updated_at = now()
     where p.id = r.user_id
       and not exists (
         select 1 from public.subscriptions s2
           join public.subscription_plans pl2 on pl2.id = s2.plan_id
          where s2.user_id = r.user_id and s2.status = 'active' and pl2.code <> 'free');
  end loop;
  return n;
end $$;

-- Les trois : Supabase accorde par défaut les fonctions à anon et authenticated
-- (grants nominatifs) — révoquer PUBLIC seul ne suffit pas (cf. 0093).
revoke execute on function public.expirer_abonnements() from public, anon, authenticated;
