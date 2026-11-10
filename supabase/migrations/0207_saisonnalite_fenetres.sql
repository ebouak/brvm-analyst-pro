-- 0207 — Saisonnalité v2, lot 3 : fenêtres d'événement.
-- Spec docs/superpowers/specs/2026-11-10-saisonnalite-v2.md §5 F6 ; plan
-- docs/superpowers/plans/2026-11-10-saisonnalite-v2-lot3.md.
--
-- Parcours moyen de l'écart au marché (rendement total) autour d'un événement,
-- par rang de séance de −20 à +40, pour chaque valeur et pour l'ensemble du
-- marché (code = 'MARCHE', d'où l'absence de clé étrangère).
-- type_evenement : detachement | comptes_annuels | comptes_semestriels |
--   convocation_ag (date de l'AVIS, pas de l'assemblée) | retour_coupon.
-- Lignes retour_coupon : rang = horizon en séances (20, 60, 250),
--   part_positifs = part des détachements revenus au cours de la veille,
--   n = détachements observables ; moyenne et mediane sans objet (null).
--
-- Écrite par le scraper (service_role, job `saisonnalite`), lue par
-- /saisonnalite. Dérivée des cours publics : lecture publique, aucune donnée
-- personnelle.

create table if not exists public.saisonnalite_fenetres (
  code text not null,
  type_evenement text not null check (type_evenement in
    ('detachement', 'comptes_annuels', 'comptes_semestriels', 'convocation_ag', 'retour_coupon')),
  rang int not null,
  moyenne numeric,
  mediane numeric,
  part_positifs numeric check (part_positifs is null or (part_positifs >= 0 and part_positifs <= 1)),
  n int not null check (n > 0),
  maj timestamptz not null default now(),
  primary key (code, type_evenement, rang)
);

alter table public.saisonnalite_fenetres enable row level security;

drop policy if exists saisonnalite_fenetres_lecture on public.saisonnalite_fenetres;
create policy saisonnalite_fenetres_lecture on public.saisonnalite_fenetres
  for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.saisonnalite_fenetres from anon, authenticated;
