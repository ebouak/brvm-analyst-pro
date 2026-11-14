import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import {
  EN_TETE_RELEVE, evaluerAcces, idReleveValide, jetonRenduPlausible, type DecisionAcces,
} from '@/lib/releve/renduAutorise';

/**
 * Accès à UN relevé mensuel. DONNÉES PRIVÉES : tout échoue en FERMÉ (null →
 * `notFound()` côté page, jamais un message qui confirmerait l'existence d'un
 * relevé).
 *
 * Accès autorisé SI ET SEULEMENT SI :
 *  (a) la session est celle du propriétaire de la ligne ; OU
 *  (b) l'en-tête `x-releve-render` porte un jeton dont le SHA-256 égale
 *      `rendu_jeton_hash` (comparaison à temps constant) ET `now() <
 *      rendu_jeton_expire`. Dans ce cas le jeton est CONSOMMÉ (hash et
 *      expiration remis à null, par un UPDATE conditionnel atomique) : usage
 *      unique, y compris si deux requêtes arrivent en même temps.
 *
 * Lecture de données de portefeuille : AUCUNE ici ni dans la page. On ne lit
 * que `monthly_reports.report_json`, le document figé à la génération.
 *
 * Colonnes sélectionnées une à une : le SELECT de `rendu_jeton_*` est refusé à
 * anon et authenticated (migration 0233) ; `select('*')` échouerait.
 */
export interface ReleveAutorise {
  id: string;
  user_id: string;
  month: string;
  report_json: unknown;
  report_url: string | null;
  acces: Exclude<DecisionAcces, 'refus'>;
}

const COLONNES_PUBLIQUES = 'id, user_id, month, report_json, report_url';

export async function chargerReleveAutorise(id: string): Promise<ReleveAutorise | null> {
  if (!idReleveValide(id)) return null;

  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();

  // (a) Propriétaire : la RLS ne rend déjà que ses propres lignes ; on revérifie quand même.
  if (user) {
    const { data, error } = await sb.from('monthly_reports').select(COLONNES_PUBLIQUES).eq('id', id).maybeSingle();
    if (!error && data) {
      const decision = evaluerAcces({
        sessionUserId: user.id, ligneUserId: data.user_id,
        hashAttendu: null, expire: null, hashFourni: null, maintenant: new Date(),
      });
      if (decision === 'proprietaire') return { ...(data as Omit<ReleveAutorise, 'acces'>), acces: 'proprietaire' };
    }
  }

  // (b) Jeton de rendu du worker d'impression.
  const jeton = (await headers()).get(EN_TETE_RELEVE);
  if (!jetonRenduPlausible(jeton)) return null;
  const hashFourni = createHash('sha256').update(jeton).digest('hex');

  let admin;
  try {
    admin = getServiceClient();
  } catch {
    return null; // pas de clé service-role : on ne devine pas, on refuse
  }
  const { data: ligne, error } = await admin
    .from('monthly_reports')
    .select(`${COLONNES_PUBLIQUES}, rendu_jeton_hash, rendu_jeton_expire`)
    .eq('id', id)
    .maybeSingle();
  if (error || !ligne) return null;

  const decision = evaluerAcces({
    sessionUserId: null, ligneUserId: ligne.user_id,
    hashAttendu: ligne.rendu_jeton_hash, expire: ligne.rendu_jeton_expire,
    hashFourni, maintenant: new Date(),
  });
  if (decision !== 'jeton') return null;

  // Consommation atomique : un seul appelant obtient la ligne en retour.
  const { data: consomme, error: errConso } = await admin
    .from('monthly_reports')
    .update({ rendu_jeton_hash: null, rendu_jeton_expire: null })
    .eq('id', id)
    .eq('rendu_jeton_hash', ligne.rendu_jeton_hash)
    .gt('rendu_jeton_expire', new Date().toISOString())
    .select('id');
  if (errConso || !consomme || consomme.length !== 1) return null;

  return {
    id: ligne.id, user_id: ligne.user_id, month: ligne.month,
    report_json: ligne.report_json, report_url: ligne.report_url, acces: 'jeton',
  };
}
