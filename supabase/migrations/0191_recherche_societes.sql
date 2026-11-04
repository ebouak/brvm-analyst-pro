-- 0191 — Recherche en langage naturel parmi les sociétés (Jev / TypeSafe).
--
-- Cache par (empreinte de requête, instantané des faits) et budget journalier.
-- RGPD : ni texte de requête ni identifiant de compte. RLS activée SANS policy :
-- service_role seul. Les deux fonctions sont ATOMIQUES : un comptage de lignes
-- cédait sous requêtes simultanées (dix lectures de « 299 », dix appels payés).

create table if not exists public.recherche_societes_cache (
  empreinte          text not null,
  snapshot_id        text not null,
  etat               text not null check (etat in ('en_cours', 'prete')),
  resultat           jsonb,
  -- Probabilité qu'au moins une société corresponde (« any_relevant » de Jev).
  pertinence_globale numeric check (pertinence_globale is null or (pertinence_globale >= 0 and pertinence_globale <= 1)),
  cree_le            timestamptz not null default now(),
  primary key (empreinte, snapshot_id)
);
create index if not exists idx_recherche_societes_cache_cree_le on public.recherche_societes_cache (cree_le);
alter table public.recherche_societes_cache enable row level security;
revoke all on public.recherche_societes_cache from public, anon, authenticated;

create table if not exists public.recherche_societes_budget (
  jour   date primary key,
  appels integer not null check (appels >= 0)
);
alter table public.recherche_societes_budget enable row level security;
revoke all on public.recherche_societes_budget from public, anon, authenticated;

-- Réserve UN appel si le plafond du jour n'est pas atteint. Sûr en concurrence :
-- la mise à jour conditionnelle prend le verrou de ligne.
create or replace function public.recherche_reserver_budget(p_plafond integer, p_jour date default current_date)
returns boolean
language sql
set search_path = public, pg_temp
as $$
  with r as (
    insert into public.recherche_societes_budget as b (jour, appels)
    select p_jour, 1 where p_plafond > 0
    on conflict (jour) do update set appels = b.appels + 1 where b.appels < p_plafond
    returning 1
  )
  select exists (select 1 from r);
$$;
revoke execute on function public.recherche_reserver_budget(integer, date) from public, anon, authenticated;
grant execute on function public.recherche_reserver_budget(integer, date) to service_role;

-- Verrou par requête : vrai si l'entrée est créée, ou reprise parce qu'abandonnée
-- (en_cours depuis plus de 30 s) ou expirée (prête depuis plus de 24 h).
create or replace function public.recherche_verrouiller(p_empreinte text, p_snapshot text)
returns boolean
language sql
set search_path = public, pg_temp
as $$
  with r as (
    insert into public.recherche_societes_cache as c (empreinte, snapshot_id, etat, cree_le)
    values (p_empreinte, p_snapshot, 'en_cours', now())
    on conflict (empreinte, snapshot_id) do update
      set etat = 'en_cours', resultat = null, pertinence_globale = null, cree_le = now()
      where (c.etat = 'en_cours' and c.cree_le < now() - interval '30 seconds')
         or (c.etat = 'prete' and c.cree_le < now() - interval '24 hours')
    returning 1
  )
  select exists (select 1 from r);
$$;
revoke execute on function public.recherche_verrouiller(text, text) from public, anon, authenticated;
grant execute on function public.recherche_verrouiller(text, text) to service_role;

-- Interrupteur et éligibilité, pilotables depuis /admin/features.
insert into public.feature_flags (code, label, acces, description) values
  ('recherche_ia', 'Recherche IA des sociétés', 'free',
   'Classement des sociétés par Jev (TypeSafe). Coût par appel : quota horaire par compte et plafond global journalier dans la route.')
on conflict (code) do nothing;

-- Rétention : cache 24 h, budget 30 jours (reprise de 0184 + deux lignes).
create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  delete from public.auth_events        where created_at < now() - interval '12 months';
  delete from public.whatsapp_conversations where created_at < now() - interval '90 days';
  delete from public.whatsapp_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.telegram_conversations where created_at < now() - interval '90 days';
  delete from public.telegram_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.dossier_envois         where created_at < now() - interval '90 days';
  delete from public.formation_inscriptions i
   using public.formation_sessions s
   where s.id = i.session_id and s.debut_at < now() - interval '3 years';
  delete from public.payment_webhook_events where received_at < now() - interval '12 months';
  delete from public.contact_messages       where derniere_activite_at < now() - interval '12 months';
  delete from public.crm_signaux            where created_at < now() - interval '90 days';
  delete from public.crm_actions            where created_at < now() - interval '24 months';
  delete from public.academy_exam_sessions  where created_at < now() - interval '7 days';
  delete from public.recherche_societes_cache  where cree_le < now() - interval '24 hours';
  delete from public.recherche_societes_budget where jour < current_date - 30;
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
