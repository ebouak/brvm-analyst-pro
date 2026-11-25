/**
 * Arrêt des rappels de progression Academy depuis un e-mail — SERVEUR uniquement.
 *
 * Le jeton (`academy_reminder_logs.jeton_arret`, 0272) désigne la personne sans
 * exposer son identifiant ni son adresse. L'arrêt pose
 * `notification_prefs.academy_relances = false`, la même case que
 * /parametres/alertes : une seule source de vérité, que la route d'envoi relit.
 *
 * Appelé par la page à bouton (/academy/rappels/arret) et par l'URL « un clic »
 * (POST /api/academy/rappels/arret, RFC 8058).
 */
import { getServiceClient } from '@/lib/billing/serviceClient';
import { estJetonArret } from './relanceProgression';

export type IssueArret = 'fait' | 'inconnu' | 'erreur';

export async function arreterRappelsAcademy(jeton: unknown): Promise<IssueArret> {
  // Jeton mal formé : inutile d'interroger la base.
  if (!estJetonArret(jeton)) return 'inconnu';
  const svc = getServiceClient();

  const { data, error } = await svc
    .from('academy_reminder_logs')
    .select('user_id')
    .eq('jeton_arret', jeton)
    .maybeSingle();
  if (error) {
    console.error('[academy-rappels] lecture du jeton impossible :', error.message);
    return 'erreur';
  }
  // Inconnu ou purgé (conservation 6 mois) : on ne prétend pas avoir arrêté.
  if (!data?.user_id) return 'inconnu';

  // service_role : le verrou 0162 ne s'applique pas, et seule la colonne
  // academy_relances est écrite — aucune liaison WhatsApp/Telegram n'est touchée.
  const { error: errMaj } = await svc
    .from('notification_prefs')
    .upsert({ user_id: data.user_id, academy_relances: false }, { onConflict: 'user_id' });
  if (errMaj) {
    console.error('[academy-rappels] enregistrement du retrait impossible :', errMaj.message);
    return 'erreur';
  }
  return 'fait';
}
