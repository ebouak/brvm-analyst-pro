-- 0208 — Saisonnalité v2, lot 4 : état du mois, bilan figé, alerte saisonnière.
-- Spec docs/superpowers/specs/2026-11-10-saisonnalite-v2.md §5 F10-F12 ;
-- plan docs/superpowers/plans/2026-11-11-saisonnalite-v2-lot4.md ; conception
-- revue par fable-advisor le 2026-11-11.
--
-- Écrites par le scraper (service_role, job `saisonnalite`). Données dérivées
-- des cours publics : lecture publique, aucune donnée personnelle dans les deux
-- tables. Les colonnes ajoutées à `alerts` restent sous sa RLS propriétaire, et
-- l'export / la suppression RGPD couvrent déjà la table.

-- ── État du mois en cours, une ligne par valeur, réécrite à chaque passage ──
create table if not exists public.saisonnalite_etat (
  code text primary key references public.brvm_instruments(code) on update cascade,
  date_seance date not null,   -- séance sur laquelle l'état a été calculé
  annee int not null,
  mois int not null check (mois between 1 and 12),
  rang int not null,           -- rang de la séance dans le mois
  rdt_en_cours numeric not null,
  q10 numeric, q25 numeric, mediane numeric, q75 numeric, q90 numeric,
  n int not null,              -- années comparables au rang courant
  etat text not null check (etat in ('au_dessus', 'dans_la_fourchette', 'en_dessous', 'trop_tot', 'historique_insuffisant')),
  etat_large text not null check (etat_large in ('au_dessus', 'dans_la_fourchette', 'en_dessous', 'trop_tot', 'historique_insuffisant')),
  verdict text not null check (verdict in ('etabli', 'indicatif', 'hasard')),
  maj timestamptz not null default now()
);
alter table public.saisonnalite_etat enable row level security;
drop policy if exists saisonnalite_etat_lecture on public.saisonnalite_etat;
create policy saisonnalite_etat_lecture on public.saisonnalite_etat for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.saisonnalite_etat from anon, authenticated;

-- ── Bilan public : profil connu AVANT le mois, puis réalisé ──
-- La première écriture fait foi : le profil n'est jamais réécrit, la règle qui
-- jugera le réalisé est figée dans la ligne. Aucune reconstitution du passé.
create table if not exists public.saisonnalite_bilans (
  code text not null references public.brvm_instruments(code) on update cascade,
  annee int not null,
  mois int not null check (mois between 1 and 12),
  profil_mediane numeric not null,
  profil_q25 numeric not null,
  profil_q75 numeric not null,
  verdict text not null check (verdict in ('etabli', 'indicatif', 'hasard')),
  n int not null check (n >= 5),
  regle text not null,
  ecrit_le timestamptz not null default now(),
  realise numeric,
  tenue boolean,               -- selon `regle` ; null = non compté (hasard)
  realise_le timestamptz,
  primary key (code, annee, mois),
  constraint bilan_realise_coherent check ((realise is null) = (realise_le is null))
);
alter table public.saisonnalite_bilans enable row level security;
drop policy if exists saisonnalite_bilans_lecture on public.saisonnalite_bilans;
create policy saisonnalite_bilans_lecture on public.saisonnalite_bilans for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.saisonnalite_bilans from anon, authenticated;

-- Le profil est immuable une fois écrit, même pour le service_role : seule la
-- première écriture fait foi.
create or replace function public.saisonnalite_bilans_profil_immuable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.profil_mediane is distinct from old.profil_mediane
     or new.profil_q25 is distinct from old.profil_q25
     or new.profil_q75 is distinct from old.profil_q75
     or new.verdict is distinct from old.verdict
     or new.n is distinct from old.n
     or new.regle is distinct from old.regle
     or new.ecrit_le is distinct from old.ecrit_le
     or (old.realise is not null and new.realise is distinct from old.realise) then
    raise exception 'saisonnalite_bilans : profil et réalisé figés une fois écrits (%, %-%)', old.code, old.annee, old.mois;
  end if;
  return new;
end $$;
revoke execute on function public.saisonnalite_bilans_profil_immuable() from public, anon, authenticated;
drop trigger if exists saisonnalite_bilans_immuable on public.saisonnalite_bilans;
create trigger saisonnalite_bilans_immuable before update on public.saisonnalite_bilans
  for each row execute function public.saisonnalite_bilans_profil_immuable();

-- ── Alerte « sortie de la fourchette saisonnière » ──
alter table public.alerts drop constraint if exists alerts_type_check;
alter table public.alerts add constraint alerts_type_check check (type in (
  'prix_au_dessus', 'prix_en_dessous', 'variation', 'signal_achat', 'signal_vente',
  'rsi_survente', 'rsi_surachat', 'dividende_proche', 'saison_hors_fourchette'
));
-- Mémoire de la dernière notification : une seule par sens et par mois.
alter table public.alerts add column if not exists dernier_etat_notifie text;
alter table public.alerts add column if not exists dernier_mois_notifie text;
