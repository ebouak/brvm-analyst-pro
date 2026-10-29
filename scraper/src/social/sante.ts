import { getSupabase } from '../persistence/supabase.js';
import { sendTelegramText } from '../alerts/channels.js';

/**
 * Contrôle quotidien des comptes de publication (cron sante-llm.yml, 06:30
 * UTC). LinkedIn n'a PAS de jeton de rafraîchissement : sans reconnexion, il
 * meurt au 60e jour. L'alerte se RÉPÈTE chaque jour à partir de J-10 — un
 * message unique se perd, et l'expiration silencieuse est exactement la
 * panne que ce contrôle doit empêcher.
 */
export interface EtatJeton {
  reseau: string;
  actif: boolean;
  expire_le: string | null;
  refresh_expire_le: string | null;
}

export const SEUIL_JOURS = 10;
const JOUR = 86_400_000;

/** Messages d'alerte (vide = rien à signaler). Fonction PURE, testée. */
export function evaluerReseaux(jetons: EtatJeton[], enCoursAnciens: number, maintenant: Date): string[] {
  const out: string[] = [];
  for (const j of jetons) {
    if (!j.actif) continue;
    // LinkedIn : seul le jeton d'accès compte. TikTok : le jeton d'accès se renouvelle, c'est le rafraîchissement qui meurt.
    const echeance = j.reseau === 'linkedin' ? j.expire_le : j.refresh_expire_le;
    if (!echeance) continue;
    const jours = Math.floor((new Date(echeance).getTime() - maintenant.getTime()) / JOUR);
    if (jours < 0) out.push(`${j.reseau} : connexion EXPIRÉE, plus rien ne part. Reconnectez depuis /admin/reseaux.`);
    else if (jours <= SEUIL_JOURS) out.push(`${j.reseau} : la connexion expire dans ${jours} jour(s). Reconnectez depuis /admin/reseaux.`);
  }
  if (enCoursAnciens > 0) {
    out.push(`${enCoursAnciens} publication(s) restée(s) « en_cours » depuis plus d'une heure : vérifiez sur le réseau si elles sont parties, puis corrigez le statut.`);
  }
  return out;
}

export async function runSanteReseaux(): Promise<{ alertes: string[] }> {
  const sb = getSupabase();
  const { data, error } = await sb.from('social_tokens').select('reseau, actif, expire_le, refresh_expire_le');
  if (error) {
    // Table absente = fonctionnalité pas encore activée : rien à surveiller.
    if (error.code === '42P01' || error.code === 'PGRST205') return { alertes: [] };
    throw new Error(`social_tokens : ${error.message}`);
  }
  const ilYaUneHeure = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await sb.from('publications_sociales').select('cible_id', { count: 'exact', head: true }).eq('statut', 'en_cours').lt('lance_le', ilYaUneHeure);
  const alertes = evaluerReseaux((data ?? []) as EtatJeton[], count ?? 0, new Date());
  if (alertes.length > 0) {
    await sendTelegramText({ subject: 'Réseaux sociaux : action requise', body: alertes.join('\n'), operateur: true });
  }
  return { alertes };
}
