/**
 * Indice de fraîcheur des cours — calcul PUR.
 *
 * Trois entrées injectées, aucune horloge implicite ni requête : la page charge,
 * ce module décide. `maintenant` est un paramètre pour rendre les seuils testables.
 *
 * Le cron intraday tourne lundi-vendredi 09-15 GMT UNIQUEMENT (vérifié dans
 * intraday.yml). L'âge de collecte seul ne peut donc pas décider « périmé » :
 * le week-end il vaut légitimement ~48 h. On combine deux signaux, dans cet ordre.
 *
 * Voir docs/superpowers/specs/2026-07-24-indice-fraicheur-design.md
 */

export type EtatFraicheur = 'frais' | 'recent' | 'perime' | 'inconnu';

export interface Fraicheur {
  etat: EtatFraicheur;
  derniereSeance: string | null;    // date_marche max (YYYY-MM-DD)
  derniereCollecte: string | null;  // last_success_at intraday (ISO)
  ageMinutes: number | null;        // maintenant - derniereCollecte
}

const SEUIL_HEARTBEAT_MIN = 45;   // en séance, au-delà = plus « live »
const SEUIL_DECROCHAGE_MIN = 120; // en séance, au-delà = collecte vraiment arrêtée

/** La BRVM cote lundi-vendredi ~09-15 GMT. On tolère jusqu'à 16 h (fixing/retards). */
export function estEnSeance(maintenant: Date): boolean {
  const jour = maintenant.getUTCDay();     // 0=dim, 6=sam
  const heure = maintenant.getUTCHours();
  return jour >= 1 && jour <= 5 && heure >= 9 && heure < 16;
}

/** Dernier jour de semaine (lun-ven) à la date de `maintenant` ou avant. */
export function dernierJourOuvreAttendu(maintenant: Date): string {
  const d = new Date(Date.UTC(
    maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate(),
  ));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

export function computeFreshness(
  derniereCollecte: string | null,
  derniereSeance: string | null,
  maintenant: Date,
): Fraicheur {
  if (!derniereCollecte) {
    return { etat: 'inconnu', derniereSeance, derniereCollecte: null, ageMinutes: null };
  }

  const ageMinutes = Math.round((maintenant.getTime() - Date.parse(derniereCollecte)) / 60000);
  const enSeance = estEnSeance(maintenant);
  const seanceAJour = derniereSeance != null && derniereSeance >= dernierJourOuvreAttendu(maintenant);

  // Ordre de priorité (voir spec §5) :
  // 1. décrochage en séance — prime sur tout, même si la séance du jour est en base.
  // 2. heartbeat en séance OU base à jour de la dernière séance attendue.
  // 3. sinon, récent.
  let etat: EtatFraicheur;
  if (enSeance && ageMinutes > SEUIL_DECROCHAGE_MIN) {
    etat = 'perime';
  } else if ((enSeance && ageMinutes <= SEUIL_HEARTBEAT_MIN) || seanceAJour) {
    etat = 'frais';
  } else {
    etat = 'recent';
  }

  return { etat, derniereSeance, derniereCollecte, ageMinutes };
}
