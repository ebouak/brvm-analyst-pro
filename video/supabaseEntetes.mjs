/**
 * En-têtes d'authentification Supabase pour les appels `fetch` bruts du worker.
 *
 * POURQUOI UNE FONCTION ET NON UN LITTÉRAL. Les deux familles de clés Supabase
 * exigent des en-têtes INCOMPATIBLES — mesuré le 2026-09-18 sur ce projet :
 *
 *   - clé héritée (JWT `eyJ…`) : `apikey` SEUL fait retomber la requête au rôle
 *     ANONYME. La RLS masque alors les lignes (REST renvoie 0 ligne) et le
 *     Storage privé répond 400 « headers must have authorization ». Il faut
 *     `apikey` ET `Authorization: Bearer`.
 *   - nouvelle clé (`sb_secret_…`, `sb_publishable_…`) : ce n'est pas un JWT.
 *     Envoyée en `Authorization: Bearer`, elle est rejetée (« Invalid JWT »),
 *     même accompagnée d'un `apikey` valide. Il faut `apikey` SEUL.
 *
 * Choisir la forme d'après la clé permet de basculer d'une famille à l'autre
 * en changeant la seule variable d'environnement, sans redéployer le code au
 * même instant — et donc sans fenêtre d'interruption.
 */
export function entetesSupabase(cle) {
  if (!cle) return {};
  if (cle.startsWith('sb_')) return { apikey: cle };
  return { apikey: cle, Authorization: `Bearer ${cle}` };
}
