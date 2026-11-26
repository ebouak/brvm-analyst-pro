-- ============================================================================
-- Migration 0274 (déposée sous le numéro 0272, déjà pris ; appliquée en production le 2026-11-26) : Orchestrateur Admin Ops & Escalade Telegram -> Voix
--   - ops_command_runs : trace, confirmations (niveau 1/2) & correlation GitHub
--   - ops_incidents    : incidents critiques, prise en charge, silencieux & voix
--   - ops_settings     : reglages operatoires (delai escalade, brief, chat IDs)
--
-- Securite : RLS activee, aucune policy pour anon/authenticated -> service_role
-- uniquement (meme modele que 0041_admin_billing_rbac.sql et 0250_appels_vocaux.sql).
-- ============================================================================

-- 1. Historique et verrouillage des commandes / confirmations Ops
create table if not exists public.ops_command_runs (
  id                   uuid primary key default gen_random_uuid(),
  chat_id              bigint not null,
  source               text not null default 'telegram'
                         check (source in ('telegram', 'admin_ui', 'cron')),
  commande             text not null,
  args                 jsonb not null default '{}'::jsonb,
  statut               text not null
                         check (statut in (
                           'en_attente_confirmation',
                           'en_cours',
                           'succes',
                           'echec',
                           'annule',
                           'expire'
                         )),
  niveau_risque        smallint not null default 0 check (niveau_risque in (0, 1, 2)),
  workflow_fichier     text,
  correlation_id       text unique,
  telegram_message_id  bigint,
  resultat             jsonb,
  erreur               text,
  cree_le              timestamptz not null default now(),
  maj_le               timestamptz not null default now(),
  expire_le            timestamptz
);

create index if not exists idx_ops_command_runs_chat_date
  on public.ops_command_runs (chat_id, cree_le desc);

create index if not exists idx_ops_command_runs_statut_date
  on public.ops_command_runs (statut, cree_le desc);

create index if not exists idx_ops_command_runs_workflow_date
  on public.ops_command_runs (workflow_fichier, cree_le desc);

comment on table public.ops_command_runs is
  'Historique, confirmations a 2 niveaux et suivi de correlation GitHub de l''orchestrateur Ops.';

-- 2. Incidents critiques et escalade differee Telegram -> Appel vocal
create table if not exists public.ops_incidents (
  id                      uuid primary key default gen_random_uuid(),
  type_alerte             text not null,
  cle_fenetre             text not null,
  gravite                 text not null check (gravite in ('critique', 'haute', 'moyenne')),
  titre                   text not null,
  detail                  text,
  statut                  text not null default 'ouvert'
                            check (statut in ('ouvert', 'pris_en_charge', 'resolu', 'silencie')),
  telegram_chat_id        bigint,
  telegram_message_id     bigint,
  escalade_vocale_at      timestamptz,
  escalade_declenchee_at  timestamptz,
  escalade_annulee        boolean not null default false,
  silencie_jusqua         timestamptz,
  cause_racine            text,
  correctif               text,
  cree_le                 timestamptz not null default now(),
  resolu_le               timestamptz,
  unique (type_alerte, cle_fenetre)
);

create index if not exists idx_ops_incidents_escalade
  on public.ops_incidents (statut, escalade_vocale_at);

comment on table public.ops_incidents is
  'Incidents d''exploitation avec fenetre de prise en charge Telegram avant appel vocal.';

-- 3. Parametres de l''orchestrateur et de la console d''administration
create table if not exists public.ops_settings (
  cle          text primary key,
  valeur       jsonb not null,
  description  text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);

comment on table public.ops_settings is
  'Parametres editables de la console admin et de l''orchestrateur Ops.';

insert into public.ops_settings (cle, valeur, description) values
  ('escalade_vocale_delai_min', '5'::jsonb, 'Delai en minutes avant escalade vocale si un incident critique n''est pas pris en charge sur Telegram.'),
  ('brief_matin_heure_utc', '"07:30"'::jsonb, 'Heure UTC cible du briefing matinal fondateur envoye sur Telegram Ops.'),
  ('mode_maintenance_note', '""'::jsonb, 'Note interne de maintenance ou contexte operatoire actif.'),
  ('admin_telegram_chat_ids', '[]'::jsonb, 'Liste additionnelle de chat_id Telegram autorises pour le bot Ops (en complement de TELEGRAM_OPS_ADMIN_CHAT_IDS).')
on conflict (cle) do nothing;

-- 4. RLS stricte : service_role uniquement
alter table public.ops_command_runs enable row level security;
alter table public.ops_incidents    enable row level security;
alter table public.ops_settings     enable row level security;
