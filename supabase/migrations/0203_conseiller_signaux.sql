-- Conseiller Premium : signal « tendance longue », une ligne par valeur et par séance.
-- Protocole : docs/conseiller/PREREG-signal-tendance-longue.md.
-- Cette table est le REGISTRE D'ÉPOQUE du test confirmatoire : le job du soir écrit
-- la séance du jour, rien ne réécrit le passé. Données de marché uniquement.
create table if not exists public.conseiller_signaux (
  date_marche    date             not null,
  code           text             not null references public.brvm_instruments(code) on update cascade,
  etat           text             not null check (etat in ('a_eviter', 'favorable', 'neutre', 'pas_de_signal')),
  score          double precision check (score is null or (score >= -1 and score <= 1)),
  eligible       boolean          not null,
  perf_120       double precision,
  perf_250       double precision,
  rang_120       double precision,
  rang_250       double precision,
  presence_60    double precision,
  effectif       integer          not null,
  revision       boolean          not null,
  moteur_version text             not null,
  created_at     timestamptz      not null default now(),
  primary key (date_marche, code)
);
create index if not exists idx_conseiller_signaux_revision on public.conseiller_signaux (date_marche desc) where revision;

comment on table public.conseiller_signaux is
  'Signal tendance longue du Conseiller (Premium). Registre d''époque du test confirmatoire : ne jamais réécrire une séance passée.';
comment on column public.conseiller_signaux.revision is 'Vrai à la première séance du mois civil : état affiché aux abonnés jusqu''à la révision suivante.';
comment on column public.conseiller_signaux.created_at is 'Preuve d''époque : une ligne écrite plus de 4 jours après sa séance est écartée du test.';

-- Donnée Premium : RLS activée SANS aucune policy. Ni anon ni authenticated ne lisent
-- la table ; le frontend la lit côté serveur (service_role) après contrôle d'accès.
alter table public.conseiller_signaux enable row level security;
revoke all on public.conseiller_signaux from public, anon, authenticated;

-- Interrupteur d'affichage, COUPÉ par défaut. L'ouvrir (« premium ») depuis
-- /admin/features est une décision de l'exploitant, après avis juridique.
insert into public.feature_flags (code, label, acces, description) values
  ('conseiller_signal', 'Conseiller : signal tendance longue', 'disabled',
   'Affiche sur les cartes du Conseiller l''état « À éviter / Favorable / Neutre » du signal tendance longue. Signal général, non personnalisé. À ouvrir en « premium » seulement après avis juridique.')
on conflict (code) do nothing;
