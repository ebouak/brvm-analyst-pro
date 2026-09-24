-- ============================================================================
-- 0141_coherence_et_flag_lecture_seance.sql
--
-- Deux objets, une même intention : la lecture commentée d'une séance devient
-- une fonctionnalité payante, et la plateforme tient désormais le compte de
-- ses propres contradictions.
--
-- 1. Drapeau `lecture_seance`
--    Un drapeau DÉDIÉ, pas une réutilisation de `signaux` : le commentaire
--    agrège le carnet d'ordres, la lecture technique et les comptes. L'accrocher
--    à `signaux` le couperait pour un abonné qui n'a souscrit qu'aux signaux.
--    Le niveau vivant en base, l'ouvrir gratuitement pour une opération
--    marketing reste une case à cocher dans /admin/features.
--
-- 2. Table `coherence_anomalies`
--    Elle enregistre les contradictions que la plateforme s'inflige à
--    elle-même : une notation affichée en juillet 2025 alors qu'un PDF
--    d'août 2026 est listé sur la même page, une étiquette « RSI neutre »
--    démentie par son propre sous-score, un document rattaché à la mauvaise
--    société, des comptes plus vieux que les publications disponibles.
--
--    Aucune donnée personnelle — mais cette table liste nos défauts. Elle n'a
--    rien à faire dans une réponse publique : RLS activée, AUCUNE policy de
--    lecture, et révocation NOMINATIVE des deux rôles.
--    ⚠️ `revoke ... from public` NE SUFFIT PAS : Supabase pose un
--    `ALTER DEFAULT PRIVILEGES ... GRANT ALL TO anon, authenticated`, qui sont
--    des grants nominatifs. Révoquer le pseudo-rôle PUBLIC ne les retire pas.
--    (Défaut constaté en production le 2026-07-13, corrigé par la 0093.)
-- ============================================================================

-- ── 1. Le drapeau ───────────────────────────────────────────────────────────
insert into public.feature_flags (code, label, acces, description) values
  ('lecture_seance', 'Lecture commentée de la séance', 'premium',
   'Bloc « Ce que dit la séance » : bruit du marché, carnet d''ordres mis à l''échelle, lecture technique expliquée, comptes rapportés au cours, événements et ce qui a suivi. Sur /actions/[code], /societes/[code] et le tableau de bord.')
on conflict (code) do nothing;

-- ── 2. Le journal des incohérences ──────────────────────────────────────────
create table if not exists public.coherence_anomalies (
  id           bigserial primary key,
  code         text not null,                       -- instrument concerné
  regle        text not null
               check (regle in ('notation_perimee', 'etiquette_contredite',
                                'publication_mal_attribuee', 'comptes_perimes')),
  gravite      text not null
               check (gravite in ('trompeuse', 'a_surveiller')),
  -- Phrase destinée au lecteur (gravité « trompeuse ») ou à l'admin.
  message      text not null,
  -- Les champs qui ont déclenché la règle : de quoi rejuger sans relancer.
  preuve       jsonb,
  detectee_le  date not null default current_date,
  resolue_le   date,
  created_at   timestamptz not null default now(),

  -- Clé naturelle : le balayage hebdomadaire est idempotent. Relancer le job
  -- deux fois le même jour ne crée pas de doublon.
  constraint coherence_anomalies_naturelle unique (code, regle, detectee_le, message)
);

comment on table public.coherence_anomalies is
  'Contradictions détectées entre les blocs d''une fiche société (notation, publications, signal, comptes). Alimentée par le balayage hebdomadaire ; lue par /admin/coherence. Jamais exposée publiquement.';

create index if not exists coherence_anomalies_code_idx
  on public.coherence_anomalies (code, detectee_le desc);
create index if not exists coherence_anomalies_ouvertes_idx
  on public.coherence_anomalies (gravite, detectee_le desc)
  where resolue_le is null;

-- ── 3. Fermeture ────────────────────────────────────────────────────────────
alter table public.coherence_anomalies enable row level security;

-- Aucune policy de lecture : ni anon, ni authenticated. Seul le service_role
-- (qui contourne la RLS par construction) écrit et lit — le balayage du
-- scraper et la console admin, laquelle passe déjà par requirePermission.
revoke all on public.coherence_anomalies from public;
revoke all on public.coherence_anomalies from anon;
revoke all on public.coherence_anomalies from authenticated;
revoke all on sequence public.coherence_anomalies_id_seq from public;
revoke all on sequence public.coherence_anomalies_id_seq from anon;
revoke all on sequence public.coherence_anomalies_id_seq from authenticated;

-- Après application : lancer le scan `get_advisors` (type security) ET
-- vérifier à la clé anon que `curl .../rest/v1/coherence_anomalies` échoue.
-- Un objet qu'on croit fermé ne l'est que si un test le prouve.
