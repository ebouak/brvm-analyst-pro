/**
 * Verdict de fraîcheur des cours intraday — fonction PURE, testée.
 *
 * POURQUOI CE MODULE EXISTE. L'ancien watchdog mesurait la DERNIÈRE ÉCRITURE,
 * quelle qu'elle soit, dans `brvm_actions_daily`. Or d'autres jobs écrivent
 * dans cette table (post-clôture, daily-brvm, range52…), et GitHub exécute les
 * cron planifiés par paquets, aux MÊMES minutes que ces jobs. Résultat mesuré
 * le 2026-09-18 : le watchdog voyait « mise à jour il y a 0 min » à chaque
 * passage, alors que l'intraday était tombé de 32 à 4 exécutions par jour
 * depuis le 12/09 (jeton du déclencheur pg_cron expiré). Il ne voyait jamais
 * les trous de 9 h à 14 h, et restait vert.
 *
 * On mesure désormais la seule chose qui compte : l'heure du dernier passage
 * INTRADAY RÉUSSI (`v_fraicheur_cours`, alimentée par `markSourceSuccess` du
 * seul job intraday). Aucun autre job ne peut la rafraîchir par accident.
 *
 * La fenêtre de séance suit le cron de `intraday.yml` (09:03 → 15:55 UTC, du
 * lundi au vendredi), élargie pour laisser passer le premier et le dernier
 * passage. Hors séance, un écart n'est pas une anomalie : les cours ne bougent
 * pas. Un jour férié (`market_calendar.is_trading_day = false`) non plus.
 */

export const SEUIL_PERIME_MIN = 30;
/** Fenêtre de séance, en minutes depuis minuit UTC : 09:35 → 16:10. */
export const DEBUT_SEANCE_MIN_UTC = 9 * 60 + 35;
export const FIN_SEANCE_MIN_UTC = 16 * 60 + 10;

export type VerdictFraicheur = 'fraiche' | 'perimee' | 'hors-seance' | 'ferie';

export interface EntreeFraicheur {
  /** Horodatage ISO du dernier passage intraday réussi, ou null s'il n'existe pas. */
  derniereCollecte: string | null;
  maintenant: Date;
  /** Vrai si `market_calendar` déclare aujourd'hui non ouvré. */
  jourFerie: boolean;
}

export interface ResultatFraicheur {
  verdict: VerdictFraicheur;
  /** Âge en minutes de la dernière collecte (null si aucune collecte connue). */
  ageMinutes: number | null;
  message: string;
}

export function enSeance(maintenant: Date): boolean {
  const jour = maintenant.getUTCDay(); // 0 = dimanche, 6 = samedi
  if (jour === 0 || jour === 6) return false;
  const minutes = maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes();
  return minutes >= DEBUT_SEANCE_MIN_UTC && minutes <= FIN_SEANCE_MIN_UTC;
}

export function evaluerFraicheurIntraday(e: EntreeFraicheur): ResultatFraicheur {
  const ageMinutes = e.derniereCollecte
    ? Math.floor((e.maintenant.getTime() - new Date(e.derniereCollecte).getTime()) / 60000)
    : null;

  if (e.jourFerie) {
    return { verdict: 'ferie', ageMinutes, message: 'Jour férié BRVM : aucune fraîcheur attendue.' };
  }
  if (!enSeance(e.maintenant)) {
    return { verdict: 'hors-seance', ageMinutes, message: 'Hors séance : un écart de collecte est normal.' };
  }
  // En séance, l'ABSENCE de collecte connue est une anomalie, pas un état neutre.
  if (ageMinutes === null) {
    return { verdict: 'perimee', ageMinutes, message: 'Aucune collecte intraday enregistrée.' };
  }
  if (ageMinutes > SEUIL_PERIME_MIN) {
    return {
      verdict: 'perimee',
      ageMinutes,
      message: `Dernière collecte intraday il y a ${ageMinutes} min (seuil ${SEUIL_PERIME_MIN} min).`,
    };
  }
  return { verdict: 'fraiche', ageMinutes, message: `Dernière collecte intraday il y a ${ageMinutes} min.` };
}
