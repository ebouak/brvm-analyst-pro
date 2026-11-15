-- 0245 — Agrégats bancaires : observations sourcées étendues, file de relecture.
-- Spec : docs/superpowers/specs/2026-11-15-agregats-bancaires-design.md (§4).
-- Plan : docs/superpowers/plans/2026-11-15-agregats-bancaires-1-extraction.md.
--
-- ⚠️ ORDRE D'APPLICATION : APRÈS le déploiement en production du frontend qui
-- lit indicateur_source en service_role (app/actions/[code]/financials/page.tsx,
-- même PR). Appliquée avant, la page financials perdrait ses libellés
-- d'absence (« non trouvé dans les documents consultés »…) jusqu'au déploiement,
-- car la lecture publique disparaît ici.
--
-- indicateur_source (0147) reçoit les agrégats du compte de résultat et du
-- bilan bancaire. Une ligne = une valeur (ou une absence constatée) dans UN
-- document. Les montants sont stockés dans la devise PUBLIÉE, à l'unité près :
-- unite = 'fcfa' en général, 'usd' pour un document publié en dollars (ETIT,
-- décision de l'exploitant du 2026-11-15 : affiché en USD, jamais converti).
-- L'unité imprimée (milliers, millions…) est gardée dans unite_source pour
-- comparer deux documents à la précision la moins fine.
--
-- AUCUNE LECTURE PUBLIQUE (changement par rapport à 0147) : extraits et pages
-- servent la relecture, le site lit la valeur retenue dans lignes_specifiques
-- et sa source dans sources_specifiques. Écriture service_role seule.
-- Aucune donnée personnelle : données de marché et documents publiés.

-- 1. Indicateurs autorisés (contrainte de colonne nommée par Postgres).
alter table public.indicateur_source drop constraint if exists indicateur_source_indicateur_check;
alter table public.indicateur_source add constraint indicateur_source_indicateur_check check (indicateur in (
  -- 0147, inchangés
  'solvabilite_total', 'ratio_cet1', 'ratio_tier1', 'ratio_levier', 'ratio_liquidite',
  'creances_souffrance_brutes', 'taux_creances_souffrance', 'couverture_creances_souffrance',
  'taux_creances_restructurees', 'taux_sinistralite',
  -- compte de résultat (flux cumulés depuis le début de l'exercice)
  'pnb', 'produits_interets', 'charges_interets', 'marge_interets', 'commissions_nettes',
  'charges_exploitation', 'resultat_brut_exploitation', 'cout_du_risque', 'resultat_net',
  -- bilan (encours à la date d'arrêté)
  'total_bilan', 'credits_clientele', 'depots_clientele', 'fonds_propres'));

-- 2. Période, extrait, document, unité imprimée, état de contrôle.
alter table public.indicateur_source
  add column if not exists periode text not null default 'exercice'
    check (periode in ('exercice', 'S1', 'T1', 'T3')),
  add column if not exists extrait text check (extrait is null or length(extrait) <= 600),
  add column if not exists publication_id uuid references public.publications(id) on delete set null,
  add column if not exists unite_source text
    check (unite_source in ('unites', 'milliers', 'millions', 'milliards', 'pct')),
  add column if not exists devise_source text,
  add column if not exists controle text not null default 'ok'
    check (controle in ('ok', 'a_relire', 'valide', 'rejete')),
  add column if not exists controle_motif text;

comment on column public.indicateur_source.periode is
  'exercice = 12 mois au 31/12 ; S1, T1, T3 = cumul depuis le début de l''exercice (date_arrete au 30/06, 31/03, 30/09).';
comment on column public.indicateur_source.controle is
  'ok = contrôles passés ; a_relire = un contrôle a échoué, rien n''est retenu ; valide = confirmé en relecture ; rejete = écarté en relecture.';
comment on column public.indicateur_source.extrait is
  'Passage du document où la valeur a été lue (600 caractères au plus), pour la relecture.';
comment on column public.indicateur_source.devise_source is
  'Devise déclarée par le document (FCFA, USD…). Un montant USD est stocké en USD (unite = usd), sans conversion.';

create index if not exists idx_indicateur_source_document on public.indicateur_source (document_url);
create index if not exists idx_indicateur_source_controle on public.indicateur_source (controle) where controle = 'a_relire';

-- 3. File de relecture : une ligne par (valeur, période, périmètre) bloquée.
create table if not exists public.indicateur_relecture (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  indicateur      text not null,
  periode         text not null check (periode in ('exercice', 'S1', 'T1', 'T3')),
  date_arrete     date not null,
  perimetre       text not null check (perimetre in ('individuel', 'consolide', 'non_precise')),
  raison          text not null check (raison in ('contradiction', 'controle')),
  detail          text not null,
  observations    uuid[] not null,
  statut          text not null default 'ouverte' check (statut in ('ouverte', 'validee', 'corrigee', 'rejetee')),
  valeur_corrigee numeric,
  traite_le       timestamptz,
  cree_le         timestamptz not null default now()
);
comment on table public.indicateur_relecture is
  'Agrégats bancaires bloqués (contradiction entre documents ou contrôle en échec). Traités dans /admin/agregats, la décision s''applique immédiatement ; l''auteur est journalisé dans admin_audit_logs, pas ici.';
create unique index if not exists indicateur_relecture_ouverte
  on public.indicateur_relecture (code, indicateur, date_arrete, perimetre) where statut = 'ouverte';

-- 4. Source de chaque valeur retenue, à côté de lignes_specifiques.
--    { "<clé>": { "document_url", "document_libelle", "page", "perimetre", "unite", "observation" } }
alter table public.income_statements add column if not exists sources_specifiques jsonb;
alter table public.balance_sheets   add column if not exists sources_specifiques jsonb;
comment on column public.income_statements.sources_specifiques is
  'Document, page, périmètre et unité (fcfa, usd, pct) de chaque clé de lignes_specifiques retenue par la sélection des agrégats bancaires.';
comment on column public.balance_sheets.sources_specifiques is
  'Document, page, périmètre et unité (fcfa, usd, pct) de chaque clé de lignes_specifiques retenue par la sélection des agrégats bancaires.';

-- 5. RLS : fermer la lecture publique, service_role seul.
alter table public.indicateur_source enable row level security;
drop policy if exists "indicateur_source lecture publique" on public.indicateur_source;
-- PUBLIC seul ne suffit pas : Supabase pose des grants nominatifs (leçon de 0093).
revoke all on public.indicateur_source from public, anon, authenticated;

alter table public.indicateur_relecture enable row level security;
revoke all on public.indicateur_relecture from public, anon, authenticated;

notify pgrst, 'reload schema';
