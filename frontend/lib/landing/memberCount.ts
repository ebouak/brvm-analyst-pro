import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

/**
 * Nombre RÉEL de comptes WESTBOURSE, pour la carte « Communauté » de la landing.
 *
 * Pourquoi service-role : `profiles` est sous RLS owner, la clé anon utilisée
 * par le reste de la landing y voit 0 ligne. On lit donc un simple `count`
 * exact côté serveur — un agrégat, aucune donnée personnelle ne quitte le
 * serveur (`head: true` ne rapatrie aucune ligne).
 *
 * Renvoie `null` plutôt que de lever : la landing est publique et ne doit
 * jamais tomber parce qu'une variable d'environnement manque. L'appelant
 * masque alors le chiffre au lieu d'en inventer un.
 */
export async function getMemberCount(): Promise<number | null> {
  try {
    const { count, error } = await getServiceClient()
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    if (error) return null;
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
}
