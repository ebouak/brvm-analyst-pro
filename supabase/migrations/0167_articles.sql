-- ============================================================================
-- 0167_articles.sql — articles de presse générés depuis la donnée BRVM.
-- Spec : docs/superpowers/specs/2026-10-28-articles-presse-design.md
--
-- Un fait détecté en base (dividende, détachement, opération sur titres,
-- séance hors norme…) devient un article. `fait` est unique : un même fait ne
-- produit jamais deux articles, une relance du cron ne crée rien.
-- `chiffres` fige les nombres au moment de la rédaction ; l'image en est tirée.
--
-- Donnée de marché publique, aucune donnée personnelle. Lecture anonyme des
-- seuls articles publiés ; écriture réservée à service_role (scraper, admin).
-- ============================================================================

create table if not exists public.articles (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  type           text not null check (type in (
                   'dividende_annonce', 'detachement_rappel', 'paiement_rappel',
                   'operation_titres', 'seance_hors_norme',
                   'resultats', 'notation', 'theme_tendance')),
  code           text references public.brvm_instruments(code),
  fait           text not null unique,        -- type|code|clé
  statut         text not null default 'brouillon'
                   check (statut in ('brouillon', 'a_valider', 'publie', 'rejete')),
  titre          text not null,
  chapo          text not null,
  corps_md       text not null,
  chiffres       jsonb not null default '{}',
  sources        jsonb not null default '[]', -- [{label, url}]
  raison_blocage text,                        -- verrous en échec
  date_fait      date not null,
  publie_le      timestamptz,
  diffuse        jsonb,                       -- {jour, mode, whatsapp, telegram}
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.articles is
  'Articles de presse générés depuis la donnée BRVM (spec 2026-10-28). Lecture publique des seuls publiés.';

create index if not exists articles_publie_idx on public.articles (publie_le desc) where statut = 'publie';

alter table public.articles enable row level security;
drop policy if exists articles_lecture on public.articles;
create policy articles_lecture on public.articles for select using (statut = 'publie');
revoke insert, update, delete on public.articles from anon, authenticated;
