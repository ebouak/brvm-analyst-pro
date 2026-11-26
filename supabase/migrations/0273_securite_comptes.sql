-- ============================================================================
-- 0273_securite_comptes.sql
-- Sécurité des comptes : plafond d'appareils Premium, détection du partage et
-- des abus, décisions d'administration, rapport quotidien.
--
-- POURQUOI : le journal des connexions (0092) n'a JAMAIS enregistré une
-- connexion — la connexion par code se fait dans le navigateur, seule la
-- déconnexion passait par le serveur (10 lignes en tout au 2026-11-26). Rien ne
-- permettait de voir qu'un compte Premium servait à plusieurs personnes.
--
-- DÉCISIONS DE L'EXPLOITANT (2026-11-26) : Premium plafonné à 3 appareils
-- connectés en même temps, ACTIF tout de suite ; comptes gratuits sans plafond,
-- seulement la détection des inscriptions groupées ; rapport quotidien Telegram.
--
-- RGPD : finalité = sécurité des comptes et prévention de la fraude ; base
-- légale = intérêt légitime (considérant 47). Aucune empreinte de navigateur :
-- seuls le navigateur déclaré (user-agent, déjà conservé par Supabase), un
-- PRÉFIXE d'adresse (/24 ou /48, jamais l'adresse complète) et le pays (en-tête
-- Vercel). Conservation : 6 mois (12 pour les décisions, qui servent en cas de
-- contestation). Aucune sanction automatique : le plafond est une règle
-- d'usage annoncée, toute autre mesure est une décision humaine tracée.
--
-- Toutes les tables : RLS sans policy (service_role seul). Toutes les
-- fonctions : execute retiré à public, anon ET authenticated (cf. 0093).
-- ============================================================================

begin;

-- ── 1. Journal des connexions : pays et session ─────────────────────────────
alter table public.auth_events add column if not exists pays text;
alter table public.auth_events add column if not exists session_id uuid;
comment on column public.auth_events.pays is
  'Code pays ISO (en-tête Vercel x-vercel-ip-country), à la connexion.';
comment on column public.auth_events.session_id is
  'Session Supabase ouverte par cette connexion : une seule ligne sign_in par session.';
create unique index if not exists auth_events_session_evenement_uidx
  on public.auth_events (event, session_id);

-- ── 2. Réglages (une seule ligne) ───────────────────────────────────────────
create table if not exists public.securite_reglages (
  id       boolean primary key default true check (id),
  plafond  smallint not null default 3 check (plafond between 1 and 10),
  mode     text not null default 'actif' check (mode in ('off', 'simulation', 'actif')),
  maj_le   timestamptz not null default now(),
  maj_par  uuid references auth.users(id) on delete set null
);
comment on table public.securite_reglages is
  'Plafond d''appareils Premium. mode : off (rien), simulation (journalise sans fermer), actif.';
insert into public.securite_reglages (id, plafond, mode) values (true, 3, 'actif')
on conflict (id) do nothing;
alter table public.securite_reglages enable row level security;

-- ── 3. Sessions vues (instantané horaire de auth.sessions) ──────────────────
-- auth.sessions oublie une session dès qu'elle est fermée : sans cet instantané,
-- impossible de dire combien d'appareils un compte a utilisés en 30 jours.
create table if not exists public.securite_sessions (
  session_id   uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  user_agent   text,
  reseau       text,
  pays         text,
  premiere_vue timestamptz not null,
  derniere_vue timestamptz not null,
  fermee_at    timestamptz,
  fermee_par   text check (fermee_par in ('plafond', 'admin', 'utilisateur', 'disparue'))
);
create index if not exists securite_sessions_user_idx on public.securite_sessions (user_id, derniere_vue desc);
create index if not exists securite_sessions_vue_idx on public.securite_sessions (derniere_vue desc);
comment on table public.securite_sessions is
  'Sessions observées (navigateur, préfixe réseau /24 ou /48, pays). Sécurité des comptes, 6 mois.';
alter table public.securite_sessions enable row level security;

-- ── 4. Fermetures de session (plafond, admin, utilisateur) ──────────────────
create table if not exists public.securite_revocations (
  id                bigserial primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  session_id        uuid not null,
  user_agent        text,
  derniere_activite timestamptz,
  motif             text not null check (motif in ('plafond', 'admin', 'utilisateur')),
  simulee           boolean not null default false,
  notifie           text check (notifie in ('non_requis', 'envoye', 'echec', 'incertain')),
  created_at        timestamptz not null default now()
);
create index if not exists securite_revocations_user_idx on public.securite_revocations (user_id, created_at desc);
create index if not exists securite_revocations_date_idx on public.securite_revocations (created_at desc);
comment on table public.securite_revocations is
  'Sessions fermées et pourquoi. simulee = calculée en mode simulation, rien n''a été fermé. 6 mois.';
alter table public.securite_revocations enable row level security;

-- ── 5. Signaux quotidiens (seulement les comptes hors « normal ») ───────────
create table if not exists public.securite_signaux (
  user_id    uuid not null references auth.users(id) on delete cascade,
  jour       date not null,
  niveau     text not null check (niveau in ('surveiller', 'suspect')),
  raisons    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, jour)
);
create index if not exists securite_signaux_jour_idx on public.securite_signaux (jour desc);
comment on table public.securite_signaux is
  'Signaux calculés chaque jour, chaque raison avec son chiffre. Aide à la décision, jamais une sanction. 6 mois.';
alter table public.securite_signaux enable row level security;

-- ── 6. Décisions d'administration ───────────────────────────────────────────
create table if not exists public.securite_decisions (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('legitime', 'deconnexion', 'avertissement', 'suspension', 'levee')),
  motif      text not null check (char_length(motif) between 3 and 500),
  jusqu_au   timestamptz,
  auteur     uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists securite_decisions_user_idx on public.securite_decisions (user_id, created_at desc);
comment on table public.securite_decisions is
  'Décisions humaines (légitime, déconnexion, avertissement, suspension du Premium, levée). 12 mois.';
alter table public.securite_decisions enable row level security;

-- ── 7. Rapport quotidien (verrou d'envoi, sans donnée personnelle) ──────────
create table if not exists public.securite_rapports (
  jour       date primary key,
  statut     text not null check (statut in ('envoi', 'envoye', 'echec')),
  contenu    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  envoye_at  timestamptz
);
comment on table public.securite_rapports is
  'Un rapport Telegram par jour : verrou contre le double envoi. Compteurs seulement. 6 mois.';
alter table public.securite_rapports enable row level security;

-- ── 8. Lecture des sessions vivantes ────────────────────────────────────────
-- Préfixe réseau calculé ICI : l'adresse complète ne quitte jamais la base.
create or replace function public.securite_lire_sessions(p_user uuid default null)
returns table (
  session_id  uuid,
  user_id     uuid,
  user_agent  text,
  reseau      text,
  cree_le     timestamptz,
  activite    timestamptz,
  est_premium boolean,
  exempte     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.user_id,
    left(s.user_agent, 400),
    case
      when s.ip is null then null
      when family(s.ip) = 4 then host(network(set_masklen(s.ip, 24))) || '/24'
      else host(network(set_masklen(s.ip, 48))) || '/48'
    end,
    s.created_at,
    greatest(
      s.created_at,
      coalesce(s.updated_at, s.created_at),
      coalesce(s.refreshed_at at time zone 'UTC', s.created_at)
    ),
    coalesce(p.is_premium, false),
    -- Exemptés du plafond : comptes d'administration et comptes de test e2e.
    exists (select 1 from public.admin_user_roles r where r.user_id = s.user_id)
      or coalesce(u.raw_app_meta_data ->> 'qa_e2e', '') in ('true', '1')
  from auth.sessions s
  join auth.users u on u.id = s.user_id
  left join public.profiles p on p.id = s.user_id
  where (p_user is null or s.user_id = p_user)
    and (s.not_after is null or s.not_after > now());
$$;

-- ── 9. Fermeture de sessions (et journal, dans la même transaction) ─────────
create or replace function public.securite_fermer_sessions(p_sessions uuid[], p_motif text)
returns table (revocation_id bigint, session_id uuid, user_id uuid, user_agent text, activite timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_motif not in ('plafond', 'admin', 'utilisateur') then
    raise exception 'securite_fermer_sessions : motif inconnu (%)', p_motif;
  end if;
  if coalesce(cardinality(p_sessions), 0) = 0 then
    return;
  end if;
  -- Garde-fou : un défaut de sélection ne doit jamais vider toutes les sessions.
  if cardinality(p_sessions) > 50 then
    raise exception 'securite_fermer_sessions : % sessions demandées, plafond 50', cardinality(p_sessions);
  end if;

  return query
  with sup as (
    delete from auth.sessions s
     where s.id = any(p_sessions)
    returning
      s.id as sid,
      s.user_id as uid,
      left(s.user_agent, 400) as ua,
      greatest(s.created_at, coalesce(s.updated_at, s.created_at),
               coalesce(s.refreshed_at at time zone 'UTC', s.created_at)) as act
  ), journal as (
    insert into public.securite_revocations (user_id, session_id, user_agent, derniere_activite, motif)
    select sup.uid, sup.sid, sup.ua, sup.act, p_motif from sup
    returning id as rid, session_id as rsid
  ), marque as (
    update public.securite_sessions ss
       set fermee_at = now(), fermee_par = p_motif
      from sup
     where ss.session_id = sup.sid
    returning ss.session_id
  )
  select journal.rid, sup.sid, sup.uid, sup.ua, sup.act
    from sup join journal on journal.rsid = sup.sid;
end;
$$;

-- ── 10. Instantané horaire ──────────────────────────────────────────────────
create or replace function public.securite_instantane()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vues    integer;
  v_fermees integer;
begin
  insert into public.securite_sessions as ss
    (session_id, user_id, user_agent, reseau, premiere_vue, derniere_vue)
  select l.session_id, l.user_id, l.user_agent, l.reseau, l.cree_le, l.activite
    from public.securite_lire_sessions(null) l
  on conflict (session_id) do update
    set derniere_vue = greatest(ss.derniere_vue, excluded.derniere_vue),
        user_agent   = coalesce(excluded.user_agent, ss.user_agent),
        reseau       = coalesce(excluded.reseau, ss.reseau);
  get diagnostics v_vues = row_count;

  -- Sessions disparues (déconnexion, expiration) : on garde leur trace, datée.
  update public.securite_sessions ss
     set fermee_at = now(), fermee_par = 'disparue'
   where ss.fermee_at is null
     and not exists (select 1 from auth.sessions s where s.id = ss.session_id);
  get diagnostics v_fermees = row_count;

  return jsonb_build_object('vues', v_vues, 'fermees', v_fermees);
end;
$$;

-- ── 11. Comptes (création, Premium, exemption) pour le calcul des signaux ───
create or replace function public.securite_comptes()
returns table (user_id uuid, cree_le timestamptz, est_premium boolean, exempte boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.created_at,
    coalesce(p.is_premium, false),
    exists (select 1 from public.admin_user_roles r where r.user_id = u.id)
      or coalesce(u.raw_app_meta_data ->> 'qa_e2e', '') in ('true', '1')
  from auth.users u
  left join public.profiles p on p.id = u.id;
$$;

-- ── 11 bis. Suspension du Premium, pour SOI-MÊME (middleware des pages /premium) ─
-- Le middleware lit avec la session de l'utilisateur, pas avec la clé service :
-- securite_decisions lui est fermée (et doit le rester : le motif est interne).
-- Cette fonction ne rend qu'un booléen, et seulement pour auth.uid().
create or replace function public.premium_suspendu_moi()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select d.type = 'suspension' and (d.jusqu_au is null or d.jusqu_au > now())
      from public.securite_decisions d
     where d.user_id = auth.uid()
       and d.type in ('suspension', 'levee')
     order by d.created_at desc
     limit 1
  ), false);
$$;
revoke execute on function public.premium_suspendu_moi() from public, anon;
grant  execute on function public.premium_suspendu_moi() to authenticated;

revoke execute on function public.securite_lire_sessions(uuid)              from public, anon, authenticated;
revoke execute on function public.securite_fermer_sessions(uuid[], text)    from public, anon, authenticated;
revoke execute on function public.securite_instantane()                     from public, anon, authenticated;
revoke execute on function public.securite_comptes()                        from public, anon, authenticated;
grant  execute on function public.securite_lire_sessions(uuid)              to service_role;
grant  execute on function public.securite_fermer_sessions(uuid[], text)    to service_role;
grant  execute on function public.securite_instantane()                     to service_role;
grant  execute on function public.securite_comptes()                        to service_role;

-- ── 12. Rétention : purge RGPD étendue ──────────────────────────────────────
-- Définition de production (pg_get_functiondef, 2026-11-26) + les lignes 0273.
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
  delete from public.whatsapp_conversations where user_id is null and created_at < now() - interval '30 days';
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
  delete from public.whatsapp_aiguillages      where created_at < now() - interval '90 days';
  delete from public.jev_budget                where jour < current_date - 30;
  -- Appels vocaux (0250) : la voix est passée chez un sous-traitant américain,
  -- la transcription ne vit que 30 jours ; les métadonnées 12 mois.
  update public.appels_vocaux
     set transcription = null, transcription_purgee_le = now(), maj_le = now()
   where transcription is not null and cree_le < now() - interval '30 days';
  delete from public.appels_vocaux          where cree_le < now() - interval '12 months';
  -- Compteur d'acquisition (0251) : agrégé, sans donnée personnelle, 24 mois.
  delete from public.acquisition_compteurs  where jour < current_date - interval '24 months';
  -- Relances de progression Academy (0271/0272) : 6 mois.
  delete from public.academy_reminder_logs  where created_at < now() - interval '6 months';
  -- Sécurité des comptes (0273) : 6 mois, décisions 12 mois.
  delete from public.securite_sessions     where derniere_vue < now() - interval '6 months';
  delete from public.securite_revocations  where created_at < now() - interval '6 months';
  delete from public.securite_signaux      where jour < current_date - interval '6 months';
  delete from public.securite_rapports     where jour < current_date - interval '6 months';
  delete from public.securite_decisions    where created_at < now() - interval '12 months';
end;
$function$;

revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;

commit;
