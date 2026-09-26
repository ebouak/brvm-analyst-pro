-- ============================================================================
-- 0142_brief_email_et_campagne.sql
--
-- De quoi rendre honnête la campagne d'annonce de la nouvelle landing.
--
-- 1. `notification_prefs.brief_email`
--    La campagne invite à recevoir le brief quotidien par email. Or
--    `notification_prefs` portait `alerts_email`, `dossiers_email` et
--    `brief_telegram` — mais AUCUN `brief_email`. Un bouton promettant un
--    envoi quotidien n'avait donc nulle part où s'enregistrer : on aurait
--    demandé un consentement qu'on était incapable de conserver. La colonne
--    est `not null default false` — décochée, comme toutes ses voisines : un
--    opt-in qui vaut oui par défaut n'est pas un opt-in.
--
-- 2. `campagne_envois`
--    Journal d'envoi, avec une clé naturelle `(campagne, email)`. C'est ce
--    qui rend une campagne « unique » réellement unique : relancer le
--    workflow, deux fois par erreur ou après une panne à mi-parcours,
--    n'écrit rien à ceux qui ont déjà reçu. Sans ce garde-fou, « envoi
--    unique » n'est qu'une intention — et le même défaut avait été traité
--    de la même façon pour `dossier_envois` (migration 0132).
--
--    La table contient une adresse email : c'est une donnée personnelle.
--    D'où RLS activée, aucune policy de lecture pour `anon` ni
--    `authenticated`, révocation NOMINATIVE des deux rôles (un `revoke from
--    public` seul ne retire pas les grants nominatifs posés par Supabase —
--    défaut constaté en production le 2026-07-13, corrigé par la 0093), et
--    une rétention explicite.
-- ============================================================================

-- ── 1. Le consentement manquant ─────────────────────────────────────────────
alter table public.notification_prefs
  add column if not exists brief_email boolean not null default false;

comment on column public.notification_prefs.brief_email is
  'Consentement à recevoir le brief de clôture quotidien par email. Décoché par défaut ; posé uniquement par l''utilisateur depuis /parametres/alertes.';

-- ── 2. Le journal de campagne ───────────────────────────────────────────────
create table if not exists public.campagne_envois (
  id          bigserial primary key,
  campagne    text not null,               -- identifiant court, ex. 'landing-2026-09'
  email       text not null,               -- destinataire (donnée personnelle)
  user_id     uuid references auth.users(id) on delete cascade,
  statut      text not null default 'envoye'
              check (statut in ('envoye', 'echec', 'saute')),
  raison      text,                        -- message d'échec, ou motif du saut
  envoye_le   timestamptz not null default now(),

  -- LA garantie du « une seule fois » : relancer ne réécrit pas.
  constraint campagne_envois_unique unique (campagne, email)
);

comment on table public.campagne_envois is
  'Journal des campagnes email ponctuelles. La clé (campagne, email) garantit qu''un relancement n''envoie rien à qui a déjà reçu. Rétention 24 mois.';

create index if not exists campagne_envois_campagne_idx
  on public.campagne_envois (campagne, envoye_le desc);

-- ── 3. Fermeture ────────────────────────────────────────────────────────────
alter table public.campagne_envois enable row level security;

-- Aucune policy : seul le service_role (le worker d'envoi) écrit et lit.
-- Les trois révocations sont nominatives ET explicites — voir l'en-tête.
revoke all on public.campagne_envois from public;
revoke all on public.campagne_envois from anon;
revoke all on public.campagne_envois from authenticated;
revoke all on sequence public.campagne_envois_id_seq from public;
revoke all on sequence public.campagne_envois_id_seq from anon;
revoke all on sequence public.campagne_envois_id_seq from authenticated;

-- ── 4. Rétention ────────────────────────────────────────────────────────────
-- Une adresse email conservée sans limite est une donnée personnelle gardée
-- sans finalité. 24 mois suffisent à prouver qu'on n'a pas réécrit à
-- quelqu'un ; au-delà, la campagne n'a plus de raison d'exister.
-- (À rattacher à `purge_rgpd_retention()` lors de sa prochaine révision.)
comment on column public.campagne_envois.envoye_le is
  'Horodatage de l''envoi. Rétention 24 mois — purge à rattacher à purge_rgpd_retention().';

-- Après application : vérifier à la clé anon que `campagne_envois` répond
-- 401/42501, et que `notification_prefs.brief_email` existe bien.
