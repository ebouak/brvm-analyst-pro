-- ============================================================================
-- 0065_rate_limit_hits.sql
-- Durcissement sécurité (audit 2026-07-02, suite) : anti-spam sur les
-- endpoints publics d'insertion (/api/leads, /api/contact,
-- /api/newsletter/subscribe) — aucun rate-limit n'existait jusqu'ici.
--
-- RGPD : l'IP est une donnée personnelle. Minimisation stricte — la fonction
-- de vérification (lib/server/rateLimit.ts) supprime activement les lignes
-- hors fenêtre à chaque appel : aucune IP n'est conservée au-delà de la
-- fenêtre de rate-limit (quelques minutes). Pas de lecture publique, écriture
-- service_role uniquement (les routes API l'utilisent déjà pour ces formulaires).
-- ============================================================================

create table if not exists public.rate_limit_hits (
  id          bigint generated always as identity primary key,
  route       text not null,
  ip          text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_rate_limit_hits_route_ip_time
  on public.rate_limit_hits (route, ip, created_at);

comment on table public.rate_limit_hits is
  'Anti-spam pour endpoints publics d''insertion. Lignes hors fenêtre supprimées activement par lib/server/rateLimit.ts (minimisation RGPD — IP jamais conservée au-delà de la fenêtre active). Écriture service_role uniquement.';

alter table public.rate_limit_hits enable row level security;
-- Aucune policy : deny-all pour anon/authenticated. service_role bypass la RLS.
