-- Audit sécurité (Cloudflare) : « Anyone can insert pre-confirmed newsletter
-- subscribers via PostgREST, bypassing double opt-in ».
--
-- La policy « newsletter_insert » (0037, WITH CHECK (true)) autorisait la clé anon
-- publique à insérer des lignes avec confirmed = true (et confirm_token choisi),
-- donc à abonner n'importe quelle adresse sans confirmation (RGPD / spam au nom
-- du site) ou à polluer la table. Toutes les écritures légitimes passent par des
-- routes serveur en service_role (/api/newsletter/subscribe, inscription).
--
-- Correctif : suppression de la policy et retrait de INSERT/UPDATE/DELETE/SELECT
-- aux rôles publics. Idempotent.

drop policy if exists "newsletter_insert" on public.newsletter_subscribers;
revoke all on public.newsletter_subscribers from public, anon, authenticated;
