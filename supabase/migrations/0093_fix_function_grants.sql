-- 0093 — Correctif P0 : les fonctions SECURITY DEFINER étaient appelables par anon.
--
-- CONSTAT (sondé avec la clé anon en prod, 2026-07-13) :
--   POST /rest/v1/rpc/purge_auth_events      -> 200, renvoie 0   ← purge le journal de sécurité
--   POST /rest/v1/rpc/api_usage_increment    -> 23503 (FK)       ← la permission est passée
--   POST /rest/v1/rpc/feature_usage_increment-> 23503 (FK)       ← idem
-- Les trois s'exécutent : elles n'échouent que sur une contrainte, pas sur un refus de droit.
--
-- POURQUOI le `revoke ... from public` des migrations 0090/0091/0092 n'a pas suffi :
-- Supabase pose `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon, authenticated`.
-- Ce sont des grants EXPLICITES AUX RÔLES. Révoquer PUBLIC (le pseudo-rôle « tout le monde »)
-- ne retire pas un grant nominatif : les deux coexistent, et le grant nominatif l'emporte.
-- Il faut donc révoquer sur les TROIS : public, anon, authenticated.
--
-- Ces fonctions ne doivent être appelées QUE par le service_role (routes serveur Next.js).

-- Journal d'authentification : purge de rétention (RGPD, 12 mois).
-- La plus exposée : aucun argument, donc exploitable par un simple curl anonyme.
revoke execute on function public.purge_auth_events() from public, anon, authenticated;

-- Compteur de quota API (0090).
revoke execute on function public.api_usage_increment(uuid) from public, anon, authenticated;

-- Compteur de quota par fonctionnalité (0091) — un appelant anonyme pouvait
-- brûler le quota IA d'un utilisateur dont il connaît l'identifiant.
revoke execute on function public.feature_usage_increment(uuid, text) from public, anon, authenticated;

-- Empêche la réapparition du problème sur les fonctions créées PLUS TARD dans ce schéma :
-- on annule le grant par défaut que Supabase applique aux nouvelles fonctions.
-- (N'affecte pas les fonctions existantes, d'où les revoke explicites ci-dessus.)
alter default privileges in schema public revoke execute on functions from anon, authenticated;
