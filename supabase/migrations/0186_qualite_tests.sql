-- 0186 — Qualité & Tests : résultats Playwright importés par la CI.
-- Spec : docs/superpowers/specs/2026-11-03-qualite-tests-design.md
-- Idempotente.
--
-- Accès : même modèle que les tables admin de 0041 (scraper_runs…) — RLS
-- activée SANS policy pour anon/authenticated, privilèges retirés : seul le
-- service_role lit et écrit. Le contrôle admin se fait côté serveur
-- (requirePermission('qa.read') + 2FA), comme pour /admin/scraping.
-- La CI n'a JAMAIS la clé service_role : elle passe par /api/qa/ingest/*,
-- protégé par un secret dédié qui ne permet que d'écrire des résultats.
--
-- RGPD : aucune donnée personnelle. Le compte de test est un compte
-- d'exploitation ; les e-mails présents dans une erreur sont masqués avant
-- stockage (lib/qa/nettoyer.ts). Conservation : pièces jointes 30 jours,
-- exécutions 180 jours (purge à chaque import, par la route).

-- 1. Exécutions --------------------------------------------------------------
create table if not exists public.qa_runs (
  id                 uuid primary key default gen_random_uuid(),
  ci_fournisseur     text not null default 'github' check (ci_fournisseur in ('github')),
  ci_run_id          text not null check (ci_run_id ~ '^[0-9]{1,20}$'),
  ci_tentative       int  not null default 1 check (ci_tentative between 1 and 100),
  ci_url             text check (ci_url like 'https://github.com/%'),
  workflow           text check (char_length(workflow) <= 200),
  branche            text check (char_length(branche) <= 200),
  commit_sha         text not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  environnement      text not null check (environnement in ('ci', 'preview', 'production')),
  base_url           text check (char_length(base_url) <= 300),
  statut             text not null default 'en_cours'
                     check (statut in ('en_cours', 'termine', 'interrompu', 'erreur_infra')),
  motif              text check (char_length(motif) <= 500),
  debut_at           timestamptz not null default now(),
  fin_at             timestamptz,
  duree_ms           int check (duree_ms >= 0),
  nb_reussis         int not null default 0 check (nb_reussis >= 0),
  nb_echoues         int not null default 0 check (nb_echoues >= 0),
  nb_intermittents   int not null default 0 check (nb_intermittents >= 0),
  nb_ignores         int not null default 0 check (nb_ignores >= 0),
  playwright_version text check (char_length(playwright_version) <= 40),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Idempotence : une exécution CI (et chaque relance GitHub) = une ligne.
  constraint qa_runs_ci_unique unique (ci_fournisseur, ci_run_id, ci_tentative),
  constraint qa_runs_fin_si_close check (statut = 'en_cours' or fin_at is not null)
);
create index if not exists qa_runs_debut_idx on public.qa_runs (debut_at desc);
create index if not exists qa_runs_env_debut_idx on public.qa_runs (environnement, debut_at desc);

-- 2. Résultats : statut FINAL d'un scénario dans une exécution --------------
create table if not exists public.qa_resultats (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.qa_runs(id) on delete cascade,
  test_cle      text not null check (test_cle ~ '^[0-9a-f]{64}$'), -- sha256(fichier|titres|projet)
  module        text not null check (module ~ '^[a-z0-9-]{1,60}$'),
  fichier       text not null check (char_length(fichier) <= 300),
  titre         text not null check (char_length(titre) <= 500),
  projet        text check (char_length(projet) <= 100),
  statut_final  text not null check (statut_final in ('reussi', 'echoue', 'intermittent', 'ignore')),
  duree_ms      int check (duree_ms >= 0),
  nb_tentatives int not null default 0 check (nb_tentatives >= 0),
  constraint qa_resultats_unique unique (run_id, test_cle)
);
create index if not exists qa_resultats_run_idx on public.qa_resultats (run_id, statut_final);
create index if not exists qa_resultats_module_idx on public.qa_resultats (module, statut_final);
create index if not exists qa_resultats_cle_idx on public.qa_resultats (test_cle);

-- 3. Tentatives : chaque essai, relances comprises ---------------------------
create table if not exists public.qa_tentatives (
  id           uuid primary key default gen_random_uuid(),
  resultat_id  uuid not null references public.qa_resultats(id) on delete cascade,
  numero       int  not null check (numero between 0 and 20), -- 0 = premier essai
  statut       text not null check (statut in ('passed', 'failed', 'timedOut', 'skipped', 'interrupted')),
  debut_at     timestamptz,
  duree_ms     int check (duree_ms >= 0),
  erreur       text check (char_length(erreur) <= 4000), -- NETTOYÉE côté serveur
  constraint qa_tentatives_unique unique (resultat_id, numero)
);

-- 4. Références des pièces jointes (bucket PRIVÉ qa-artefacts) --------------
-- Le chemin commence par « <ci_run_id>-<ci_tentative>/ » : connu de la CI
-- AVANT l'import, ce qui permet de reprendre un téléversement interrompu.
create table if not exists public.qa_artefacts (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.qa_runs(id) on delete cascade,
  tentative_id  uuid references public.qa_tentatives(id) on delete cascade,
  type          text not null check (type in ('capture', 'trace', 'video', 'rapport_html')),
  chemin        text not null check (chemin ~ '^[0-9]{1,20}-[0-9]{1,3}/[A-Za-z0-9._-]{1,120}$'),
  content_type  text not null check (content_type in ('image/png', 'application/zip', 'video/webm')),
  statut        text not null default 'attendu' check (statut in ('attendu', 'televerse', 'purge')),
  created_at    timestamptz not null default now(),
  constraint qa_artefacts_chemin_unique unique (chemin)
);
create index if not exists qa_artefacts_run_idx on public.qa_artefacts (run_id);
create index if not exists qa_artefacts_tentative_idx on public.qa_artefacts (tentative_id);
create index if not exists qa_artefacts_purge_idx on public.qa_artefacts (created_at) where statut <> 'purge';

-- 5. Accès : service_role seul ----------------------------------------------
alter table public.qa_runs       enable row level security;
alter table public.qa_resultats  enable row level security;
alter table public.qa_tentatives enable row level security;
alter table public.qa_artefacts  enable row level security;
revoke all on public.qa_runs, public.qa_resultats, public.qa_tentatives, public.qa_artefacts
  from public, anon, authenticated;

-- 6. Import atomique et idempotent ------------------------------------------
-- Appelée par /api/qa/ingest/fin (service_role) avec un JSON validé et
-- NETTOYÉ par lib/qa/normaliser.ts. Une exécution déjà close n'est jamais
-- réimportée : rejouer le même envoi ne crée aucune ligne. Le verrou de ligne
-- sérialise deux envois concurrents de la même exécution.
create or replace function public.qa_importer_run(p jsonb)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_run uuid;
  v_statut text;
  r jsonb; t jsonb; a jsonb;
  v_res uuid;
  v_tent uuid;
begin
  insert into qa_runs (ci_fournisseur, ci_run_id, ci_tentative, ci_url, workflow, branche,
                       commit_sha, environnement, base_url, debut_at)
  values ('github', p->>'ci_run_id', (p->>'ci_tentative')::int, p->>'ci_url', p->>'workflow',
          p->>'branche', p->>'commit_sha', p->>'environnement', p->>'base_url',
          coalesce((p->>'debut_at')::timestamptz, now()))
  on conflict on constraint qa_runs_ci_unique do nothing;

  select id, statut into v_run, v_statut from qa_runs
   where ci_fournisseur = 'github' and ci_run_id = p->>'ci_run_id'
     and ci_tentative = (p->>'ci_tentative')::int
   for update;

  if v_statut <> 'en_cours' then
    return jsonb_build_object('run_id', v_run, 'deja_importe', true);
  end if;

  for r in select * from jsonb_array_elements(coalesce(p->'resultats', '[]'::jsonb)) loop
    insert into qa_resultats (run_id, test_cle, module, fichier, titre, projet, statut_final, duree_ms, nb_tentatives)
    values (v_run, r->>'test_cle', r->>'module', r->>'fichier', r->>'titre', r->>'projet',
            r->>'statut_final', (r->>'duree_ms')::int,
            jsonb_array_length(coalesce(r->'tentatives', '[]'::jsonb)))
    returning id into v_res;

    for t in select * from jsonb_array_elements(coalesce(r->'tentatives', '[]'::jsonb)) loop
      insert into qa_tentatives (resultat_id, numero, statut, debut_at, duree_ms, erreur)
      values (v_res, (t->>'numero')::int, t->>'statut', (t->>'debut_at')::timestamptz,
              (t->>'duree_ms')::int, t->>'erreur')
      returning id into v_tent;

      for a in select * from jsonb_array_elements(coalesce(t->'artefacts', '[]'::jsonb)) loop
        insert into qa_artefacts (run_id, tentative_id, type, chemin, content_type)
        values (v_run, v_tent, a->>'type', a->>'chemin', a->>'content_type')
        on conflict on constraint qa_artefacts_chemin_unique do nothing;
      end loop;
    end loop;
  end loop;

  for a in select * from jsonb_array_elements(coalesce(p->'artefacts_run', '[]'::jsonb)) loop
    insert into qa_artefacts (run_id, type, chemin, content_type)
    values (v_run, a->>'type', a->>'chemin', a->>'content_type')
    on conflict on constraint qa_artefacts_chemin_unique do nothing;
  end loop;

  update qa_runs set
    statut             = p->>'statut',
    motif              = p->>'motif',
    debut_at           = coalesce((p->>'debut_at')::timestamptz, debut_at),
    fin_at             = coalesce((p->>'fin_at')::timestamptz, now()),
    duree_ms           = (p->>'duree_ms')::int,
    playwright_version = p->>'playwright_version',
    nb_reussis       = (select count(*) from qa_resultats where run_id = v_run and statut_final = 'reussi'),
    nb_echoues       = (select count(*) from qa_resultats where run_id = v_run and statut_final = 'echoue'),
    nb_intermittents = (select count(*) from qa_resultats where run_id = v_run and statut_final = 'intermittent'),
    nb_ignores       = (select count(*) from qa_resultats where run_id = v_run and statut_final = 'ignore'),
    updated_at       = now()
  where id = v_run;

  return jsonb_build_object('run_id', v_run, 'deja_importe', false);
end;
$$;
revoke execute on function public.qa_importer_run(jsonb) from public, anon, authenticated;

-- 7. Bucket privé des pièces jointes ----------------------------------------
-- public = false, AUCUNE policy storage.objects : lecture par URL signée
-- (5 min) délivrée par /api/admin/qa/artefacts/[id], dépôt par URL signée
-- délivrée à la CI par /api/qa/ingest/fin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qa-artefacts', 'qa-artefacts', false, 52428800, array['image/png', 'application/zip', 'video/webm'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 8. Permission RBAC ---------------------------------------------------------
insert into public.admin_permissions (code, label) values ('qa.read', 'Voir qualité & tests')
on conflict (code) do nothing;
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p on p.code = 'qa.read'
where r.code in ('super_admin', 'data_admin')
on conflict do nothing;
