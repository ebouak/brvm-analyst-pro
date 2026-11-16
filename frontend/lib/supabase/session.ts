import 'server-only';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from './server';

/**
 * Utilisateur de la requête en cours, lu UNE fois par rendu.
 *
 * `auth.getUser()` n'est pas une lecture locale : c'est un aller-retour vers
 * Supabase Auth. Avant ce module, une fiche action en faisait environ huit
 * (layout, cinq `canAccess`, `getData`, `getAdminContext`), en plus du
 * middleware. `cache()` de React les fusionne en un seul par rendu serveur
 * (règle 3 de l'audit de performance). Hors rendu (route handler, action
 * serveur), `cache` appelle simplement la fonction : le comportement reste
 * celui d'avant.
 *
 * La vérification reste `getUser()` (validée par le serveur Auth), pas une
 * simple lecture du cookie : rien n'est relâché côté sécurité.
 */
export const utilisateurCourant = cache(async (): Promise<User | null> => {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  return user ?? null;
});

export interface ProfilCourant {
  is_premium: boolean | null;
  onboarding_done: boolean | null;
  mode_debutant: boolean | null;
}

/**
 * Ligne `profiles` de l'utilisateur courant, une fois par rendu : le layout
 * (premium, onboarding, mode débutant) et `getEntitlements` (premium) la
 * lisaient chacun de leur côté, et `getEntitlements` autant de fois que la
 * page appelait `canAccess`.
 */
export const profilCourant = cache(async (): Promise<ProfilCourant | null> => {
  const user = await utilisateurCourant();
  if (!user) return null;
  const { data } = await createClient()
    .from('profiles')
    .select('is_premium, onboarding_done, mode_debutant')
    .eq('id', user.id)
    .maybeSingle();
  return (data as ProfilCourant | null) ?? null;
});
