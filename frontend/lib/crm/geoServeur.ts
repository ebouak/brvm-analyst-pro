/**
 * Enregistre le PAYS du compte — SERVEUR uniquement (service_role). Le pays vient
 * de l'en-tête posé par Vercel, jamais d'une valeur envoyée par le client ; seul
 * le code ISO est conservé (ni IP, ni ville). Au plus une écriture par 24 h.
 */
import { getServiceClient } from '@/lib/billing/serviceClient';
import { doitMajPays, paysValide } from './geo';

export async function enregistrerPays(userId: string, entetes: Headers, maintenant: Date = new Date()): Promise<'ecrit' | 'saute' | 'inconnu' | 'erreur'> {
  // L'en-tête n'est digne de confiance que parce que Vercel l'écrase à la périphérie : hors Vercel
  // (dev local, autre hébergeur) n'importe qui pourrait l'envoyer, donc on l'ignore.
  if (!process.env.VERCEL) return 'inconnu';
  const pays = paysValide(entetes.get('x-vercel-ip-country'));
  if (!pays) return 'inconnu';
  try {
    const sb = getServiceClient();
    const { data, error } = await sb.from('profiles').select('pays_code, pays_maj_le').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.code ?? 'lecture');
    const actuel = (data as { pays_code: string | null; pays_maj_le: string | null } | null) ?? null;
    if (!actuel) return 'saute'; // pas de profil : rien à mettre à jour (aucune ligne créée ici)
    if (!doitMajPays(actuel, pays, maintenant)) return 'saute';
    const { error: e2 } = await sb.from('profiles').update({ pays_code: pays, pays_maj_le: maintenant.toISOString() }).eq('id', userId);
    if (e2) throw new Error(e2.code ?? 'écriture');
    return 'ecrit';
  } catch (e) {
    console.error('crm_geo : pays non enregistré', e instanceof Error ? e.message : e);
    return 'erreur';
  }
}
