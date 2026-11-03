-- 0187 — Tour de contrôle : photo des workflows GitHub Actions.
-- Idempotente.
--
-- Finalité : savoir, pour CHAQUE workflow du dépôt, s'il est actif, quand il
-- a tourné pour la dernière fois, avec quel résultat, et depuis combien de
-- runs il échoue. scraper_runs (0041) ne couvre que les commandes du scraper
-- enveloppées dans `monitored` ; alerts.yml, video-seance.yml, dossier.yml,
-- crm-sequences.yml… n'y apparaissent pas. Et GitHub DÉSACTIVE en silence les
-- workflows planifiés d'un dépôt public après 60 jours sans activité.
--
-- Écrite par le workflow ops-controle.yml (commande scraper `ops:workflows`,
-- jeton natif GITHUB_TOKEN en lecture, clé service_role pour l'upsert).
-- Une ligne par workflow, clé naturelle `fichier` : upsert idempotent.
--
-- Accès : même modèle que les tables admin de 0041 — RLS activée SANS policy,
-- privilèges retirés à public, anon ET authenticated (les trois : Supabase
-- pose des grants nominatifs par défaut, voir 0093). Seul le service_role lit
-- et écrit ; la page admin lit côté serveur.
--
-- RGPD : AUCUNE donnée personnelle (noms de fichiers, états, horodatages,
-- URL de runs GitHub). Pas de rétention à prévoir : une ligne par workflow,
-- écrasée à chaque collecte.

create table if not exists public.ops_workflows (
  fichier              text primary key check (char_length(fichier) between 1 and 300),
  nom                  text check (char_length(nom) <= 300),
  etat                 text not null
                       check (etat in ('active', 'disabled_manually', 'disabled_inactivity', 'deleted', 'autre')),
  crons                text[] not null default '{}',
  dernier_run_id       bigint,
  dernier_evenement    text,
  dernier_statut       text,
  derniere_conclusion  text,
  dernier_debut        timestamptz,
  derniere_fin         timestamptz,
  dernier_url          text check (dernier_url like 'https://github.com/%'),
  dernier_succes_at    timestamptz,
  echecs_consecutifs   int not null default 0 check (echecs_consecutifs >= 0),
  collecte_at          timestamptz not null
);

comment on table public.ops_workflows is
  'Tour de contrôle : état et dernier run de chaque workflow GitHub Actions (collecte ops-controle.yml). Aucune donnée personnelle. service_role seul.';

alter table public.ops_workflows enable row level security;
revoke all on public.ops_workflows from public, anon, authenticated;
