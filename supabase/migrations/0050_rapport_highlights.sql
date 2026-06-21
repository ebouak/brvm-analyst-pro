-- ============================================================================
-- 0050_rapport_highlights.sql — Synthèse qualitative pré-extraite des rapports
-- d'activités / rapports annuels intégrés (option B : batch LLM stocké en base).
-- Alimente la « Revue de résultats » des fiches société. Écriture par le cron
-- (service_role) ; lecture publique (données dérivées de documents publics).
-- ============================================================================

create table if not exists public.rapport_highlights (
  code           text primary key references public.brvm_instruments(code) on update cascade,
  profil         text,                                   -- 'agro' | 'telecom' | 'banque' | 'general'
  cyclique       boolean not null default false,         -- activité cyclique → lecture pluriannuelle
  synthese       text,                                   -- 1-2 phrases de synthèse d'activité
  highlights     jsonb not null default '[]'::jsonb,     -- [{ "titre": ..., "detail": ... }]
  source_libelle text,
  source_url     text,
  source_date    date,
  updated_at     timestamptz not null default now()
);

alter table public.rapport_highlights enable row level security;
drop policy if exists "lecture publique rapport_highlights" on public.rapport_highlights;
create policy "lecture publique rapport_highlights"
  on public.rapport_highlights for select using (true);
-- Pas de policy d'écriture → réservé au service_role (cron d'extraction).
